import axios from 'axios';
import {
  ExpertPromoteValidationError,
  isExpertPromoteUserErrorMessage,
  normalizeToPromotePathologyGroup,
} from '@/features/expert/lib/expert-promote-validation';
import { http, getApiErrorMessage } from './client';
import type { ExpertPendingReview } from './expert-dashboard';
import { fetchExpertPendingReviews } from './expert-dashboard';
import { normalizeVisualQaReport, normalizeVisualQaSessionReport } from './normalize-visual-qa';
import type {
  Citation,
  ExpertReviewItem,
  ExpertReviewSavedDraft,
  VisualQaReport,
  VisualQaTurn,
} from './types';
import {
  isValidNormalizedBoundingBox,
  parseCustomPolygon,
  parseNormalizedBoundingBox,
  parsePercentageBoundingBox,
} from '@/lib/utils/annotations';
import { normalizeDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';

export const REVIEW_WORKFLOW_CONFLICT = 'REVIEW_WORKFLOW_CONFLICT';

/** BE has not deployed GET/PUT/DELETE `/api/expert/reviews/{id}/draft` yet — keep false to avoid 405 noise. */
export const EXPERT_REVIEW_DRAFT_API_ENABLED = false;

function normalizeReviewMessageId(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1).trim();
  return s.toLowerCase();
}

function reflectiveQuestionsToNullableString(
  rq: VisualQaReport['reflectiveQuestions'],
): string | null {
  if (rq == null) return null;
  if (Array.isArray(rq)) {
    const t = rq.map((x) => String(x).trim()).filter(Boolean).join('\n');
    return t || null;
  }
  const t = String(rq).trim();
  return t || null;
}

function parseDifferentialDiagnosesList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) {
        return p.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(/[\n;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** Gộp citation từ mọi turn + root (một số BE chỉ gắn RAG evidence trên turn đầu). Dedupe giống BE: (chunkId, medicalCaseId). */
function mergeRawCitationLists(...lists: unknown[][]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const id = String(
        row.chunkId ?? row.documentChunkId ?? row.ChunkId ?? row.id ?? row.chunkID ?? '',
      ).trim();
      const medicalCaseId = String(
        row.medicalCaseId ?? row.MedicalCaseId ?? row.caseId ?? row.CaseId ?? '',
      ).trim();
      const excerpt = String(row.sourceText ?? row.snippet ?? row.text ?? '').slice(0, 48);
      const key =
        id && medicalCaseId
          ? `${id.toLowerCase()}::${medicalCaseId.toLowerCase()}`
          : id
            ? id.toLowerCase()
            : `fall:${out.length}:${excerpt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
    }
  }
  return out;
}

function mapExpertCitation(row: unknown): Citation | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const chunkId = String(
    r.chunkId ?? r.documentChunkId ?? r.DocumentChunkId ?? r.id ?? r.chunkID ?? '',
  ).trim();
  if (!chunkId) return null;

  let sourceText = String(
    r.sourceText ??
      r.SourceText ??
      r.snippet ??
      r.preview ??
      r.text ??
      r.chunkText ??
      r.content ??
      r.excerpt ??
      '',
  ).trim();

  if (!sourceText) {
    const title = String(r.documentTitle ?? r.title ?? r.documentName ?? '').trim();
    const pageRaw = r.pageNumber ?? r.PageNumber ?? r.page ?? r.startPage;
    const page =
      pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== ''
        ? Number(pageRaw)
        : undefined;
    const bits = [
      title,
      page !== undefined && Number.isFinite(page) ? `Page ${Math.floor(page)}` : '',
    ].filter(Boolean);
    sourceText = bits.length > 0 ? bits.join(' · ') : '(No excerpt — chunk metadata only)';
  }

  const rawFlagged = r.flagged ?? r.isFlagged ?? r.hasBeenFlagged ?? r.IsFlagged;

  const referenceUrlRaw =
    r.referenceUrl ??
    r.ReferenceUrl ??
    r.href ??
    r.documentUrl ??
    r.DocumentUrl ??
    r.fileUrl ??
    r.FileUrl;

  const documentIdRaw = r.documentId ?? r.DocumentId ?? r.document_id;
  return {
    chunkId,
    sourceText,
    ...(documentIdRaw != null && String(documentIdRaw).trim()
      ? { documentId: String(documentIdRaw).trim() }
      : {}),
    referenceUrl:
      referenceUrlRaw !== undefined && referenceUrlRaw !== null && String(referenceUrlRaw).trim()
        ? String(referenceUrlRaw).trim()
        : undefined,
    pageNumber: (() => {
      const p =
        r.pageNumber ?? r.PageNumber ?? r.page ?? r.startPage ?? r.chunkOrder ?? r.ChunkOrder;
      if (p === undefined || p === null) return undefined;
      const n = Number(p);
      return Number.isFinite(n) ? n : undefined;
    })(),
    flagged: typeof rawFlagged === 'boolean' ? rawFlagged : undefined,
  };
}

function extractDicomMetadataFromRecord(r: Record<string, unknown>) {
  const candidates: unknown[] = [
    r.dicomMetadata,
    r.dicom_metadata,
    r.DicomMetadata,
    r.metadata,
    r.Metadata,
    r.studyMetadata,
    r.study_metadata,
  ];
  const session = r.session;
  if (session && typeof session === 'object') {
    const s = session as Record<string, unknown>;
    candidates.push(s.dicomMetadata, s.dicom_metadata, s.DicomMetadata, s.metadata, s.Metadata);
  }
  for (const candidate of candidates) {
    const normalized = normalizeDicomMetadata(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function mapExpertItem(row: unknown): ExpertReviewItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const answerIdRaw = String(r.answerId ?? r.AnswerId ?? r.caseAnswerId ?? r.CaseAnswerId ?? '').trim();
  const sessionId = String(
    r.sessionId ??
      r.SessionId ??
      r.visualQaSessionId ??
      r.VisualQaSessionId ??
      (answerIdRaw || undefined) ??
      r.id ??
      r.requestId ??
      '',
  ).trim();
  if (!sessionId) return null;
  const turnsRaw = r.turns ?? r.Turns ?? r.history ?? r.History;
  const hasSessionTurns = Array.isArray(turnsRaw) && turnsRaw.length > 0;
  const sessionLikeRaw = hasSessionTurns
    ? {
        sessionId,
        caseId: r.caseId ?? r.CaseId ?? null,
        imageId: r.imageId ?? r.ImageId ?? null,
        turns: turnsRaw,
      }
    : null;
  const normalizedSession = sessionLikeRaw ? normalizeVisualQaSessionReport(sessionLikeRaw) : null;
  const requestedReviewMessageId = String(
    r.requestedReviewMessageId ?? r.RequestedReviewMessageId ?? '',
  ).trim();
  const selectedUserMessageId = String(
    r.selectedUserMessageId ?? r.SelectedUserMessageId ?? '',
  ).trim();
  const selectedAssistantMessageId = String(
    r.selectedAssistantMessageId ?? r.SelectedAssistantMessageId ?? '',
  ).trim();

  const matchedTurn =
    normalizedSession?.turns.find((turn) => {
      const assistantId = normalizeReviewMessageId(turn.assistantMessageId);
      const userId = normalizeReviewMessageId(turn.userMessageId);
      const saN = normalizeReviewMessageId(selectedAssistantMessageId);
      const suN = normalizeReviewMessageId(selectedUserMessageId);
      const reqN = normalizeReviewMessageId(requestedReviewMessageId);
      if (saN && assistantId && saN === assistantId) {
        return true;
      }
      if (suN && userId && suN === userId) {
        return true;
      }
      if (reqN) {
        if (assistantId && assistantId === reqN) return true;
        if (userId && userId === reqN) return true;
      }
      return false;
    }) ?? null;
  const latestTurn = matchedTurn ?? normalizedSession?.latest ?? null;
  const allTurns: VisualQaTurn[] = normalizedSession?.turns ?? [];

  const messages = Array.isArray(r.messages) ? r.messages : [];
  const latestAssistantMessage =
    messages.length > 0
      ? [...messages]
          .reverse()
          .find((m) => {
            if (!m || typeof m !== 'object') return false;
            const mr = m as Record<string, unknown>;
            const role = String(mr.role ?? mr.Role ?? '').toLowerCase();
            return role.includes('assistant') || role === 'ai' || role === 'model';
          }) ?? null
      : null;
  const latestAssistantRecord =
    latestAssistantMessage && typeof latestAssistantMessage === 'object'
      ? (latestAssistantMessage as Record<string, unknown>)
      : null;

  const reportRaw =
    latestTurn ??
    latestAssistantRecord ??
    r.latest ??
    r.latestTurn ??
    r.report ??
    r.structuredReport ??
    r.aiReport;
  let report: VisualQaReport = normalizeVisualQaReport(reportRaw ?? r);

  if (latestTurn?.answerText?.trim()) {
    report = { ...report, answerText: latestTurn.answerText.trim() };
  } else if (latestAssistantRecord) {
    const assistantContent = String(
      latestAssistantRecord.content ??
        latestAssistantRecord.text ??
        latestAssistantRecord.answerText ??
        '',
    ).trim();
    if (assistantContent) {
      report = { ...report, answerText: assistantContent };
    }
  } else {
    const currentAnswerFlat = String(r.currentAnswerText ?? r.CurrentAnswerText ?? '').trim();
    if (currentAnswerFlat) {
      report = { ...report, answerText: currentAnswerFlat };
    }
  }
  if (r.keyImagingFindings !== undefined && r.keyImagingFindings !== null) {
    const v = String(r.keyImagingFindings).trim();
    report = { ...report, keyImagingFindings: v || null };
  }
  if (r.reflectiveQuestions !== undefined && r.reflectiveQuestions !== null) {
    const v = String(r.reflectiveQuestions).trim();
    report = { ...report, reflectiveQuestions: v || null };
  }

  const structuredDiagnosis = String(r.structuredDiagnosis ?? r.StructuredDiagnosis ?? '').trim();
  if (structuredDiagnosis) {
    report = { ...report, suggestedDiagnosis: structuredDiagnosis };
  } else {
    const caseSugg = String(r.caseSuggestedDiagnosis ?? r.CaseSuggestedDiagnosis ?? '').trim();
    if (caseSugg && report.suggestedDiagnosis?.trim() === caseSugg) {
      report = { ...report, suggestedDiagnosis: '' };
    }
  }

  const diffFromDto = parseDifferentialDiagnosesList(r.differentialDiagnoses ?? r.DifferentialDiagnoses);
  if (diffFromDto.length > 0) {
    report = { ...report, differentialDiagnoses: diffFromDto, keyFindings: diffFromDto };
  } else {
    const caseKf = String(r.caseKeyFindings ?? r.CaseKeyFindings ?? '').trim();
    const kfJoined = report.keyFindings.length > 0 ? report.keyFindings.join('\n').trim() : '';
    if (caseKf && kfJoined && kfJoined === caseKf) {
      report = { ...report, keyFindings: [], differentialDiagnoses: report.differentialDiagnoses ?? [] };
    }
  }

  const confRaw = r.aiConfidenceScore ?? r.AiConfidenceScore;
  if (typeof confRaw === 'number' && Number.isFinite(confRaw)) {
    report = { ...report, aiConfidenceScore: confRaw };
  } else if (typeof confRaw === 'string' && confRaw.trim()) {
    const n = parseFloat(confRaw);
    if (Number.isFinite(n)) report = { ...report, aiConfidenceScore: n };
  }
  const customCoordinates = parsePercentageBoundingBox(
    r.customCoordinates ??
      r.annotationCoordinates ??
      r.questionCoordinates ??
      r.coordinates,
  );
  const polyRaw = r.customPolygon ?? r.CustomPolygon;
  const dedicatedBoxRaw =
    r.customBoundingBox ?? r.CustomBoundingBox ?? r.normalizedBoundingBox ?? r.NormalizedBoundingBox;
  let customBoundingBox =
    parseNormalizedBoundingBox(dedicatedBoxRaw) ?? parseNormalizedBoundingBox(polyRaw);
  const customPolygon = customBoundingBox ? null : parseCustomPolygon(polyRaw);
  if (!customBoundingBox && latestTurn) {
    const fromTurn = latestTurn.roiBoundingBox ?? latestTurn.questionCoordinates ?? null;
    if (fromTurn && isValidNormalizedBoundingBox(fromTurn)) {
      customBoundingBox = fromTurn;
    }
  }
  const citationSource = mergeRawCitationLists(
    ...allTurns.map((t) => (Array.isArray(t.citations) ? t.citations : [])),
    Array.isArray(latestTurn?.citations) ? latestTurn.citations : [],
    Array.isArray(latestAssistantRecord?.citations) ? latestAssistantRecord.citations : [],
    Array.isArray(r.citations) ? r.citations : [],
    Array.isArray(r.Citations) ? r.Citations : [],
    Array.isArray(r.evidence) ? r.evidence : [],
    Array.isArray(r.ragCitations) ? r.ragCitations : [],
    Array.isArray(r.ragChunks) ? r.ragChunks : [],
    Array.isArray(r.RagChunks) ? r.RagChunks : [],
    Array.isArray(r.retrievedChunks) ? r.retrievedChunks : [],
  );
  const citations = citationSource
    .map(mapExpertCitation)
    .filter((item): item is Citation => item !== null);
  const sessionQuestion = latestTurn?.questionText?.trim();
  const fallbackQuestionFromMessage = (() => {
    if (messages.length === 0 || !latestAssistantRecord) return '';
    const assistantIdx = messages.findIndex((m) => m === latestAssistantMessage);
    if (assistantIdx <= 0) return '';
    for (let i = assistantIdx - 1; i >= 0; i -= 1) {
      const prev = messages[i];
      if (!prev || typeof prev !== 'object') continue;
      const pr = prev as Record<string, unknown>;
      const role = String(pr.role ?? pr.Role ?? '').toLowerCase();
      if (role.includes('user') || role.includes('student')) {
        return String(pr.content ?? pr.text ?? pr.questionText ?? '').trim();
      }
    }
    return '';
  })();
  const questionText = String(
    sessionQuestion || fallbackQuestionFromMessage || r.questionText || r.question || '',
  );

  const caseIdRaw = r.caseId ?? r.CaseId;
  const caseId =
    caseIdRaw != null && String(caseIdRaw).trim() !== '' ? String(caseIdRaw).trim() : null;
  const caseDescription = String(r.caseDescription ?? r.CaseDescription ?? '').trim() || null;
  const caseSuggestedDiagnosis =
    String(r.caseSuggestedDiagnosis ?? r.CaseSuggestedDiagnosis ?? '').trim() || null;
  const caseKeyFindings = String(r.caseKeyFindings ?? r.CaseKeyFindings ?? '').trim() || null;
  const caseTitle =
    String(r.caseTitle ?? r.CaseTitle ?? r.caseName ?? r.CaseName ?? '').trim() || null;
  const dicomMetadata = extractDicomMetadataFromRecord(r);

  const askedAtRaw =
    r.escalatedAt ??
    r.EscalatedAt ??
    r.askedAt ??
    r.AskedAt ??
    r.submittedAt ??
    r.SubmittedAt ??
    '';

  const draftFromDetail = parseExpertReviewDraftPayload(
    r.draft ?? r.savedDraft ?? r.reviewDraft ?? r.Draft ?? r.reviewNoteDraft,
  );

  return {
    sessionId,
    answerId: answerIdRaw || null,
    id: sessionId,
    studentName: String(r.studentName ?? ''),
    className: r.className !== undefined ? String(r.className) : undefined,
    questionText,
    question: questionText,
    caseId,
    caseTitle,
    caseDescription,
    caseSuggestedDiagnosis,
    caseKeyFindings,
    imageUrl:
      r.imageUrl !== undefined
        ? String(r.imageUrl)
        : r.customImageUrl !== undefined
          ? String(r.customImageUrl)
          : undefined,
    imageId: r.imageId != null ? String(r.imageId) : null,
    dicomMetadata,
    customImageUrl: r.customImageUrl != null ? String(r.customImageUrl) : null,
    promotedCaseId:
      r.promotedCaseId != null
        ? String(r.promotedCaseId)
        : r.PromotedCaseId != null
          ? String(r.PromotedCaseId)
          : null,
    customCoordinates,
    customBoundingBox,
    customPolygon,
    askedAt: String(askedAtRaw ?? ''),
    status: String(r.status ?? 'PendingExpert'),
    report,
    turns: allTurns,
    latestTurnIndex: latestTurn?.turnIndex ?? null,
    requestedReviewMessageId: requestedReviewMessageId || null,
    selectedUserMessageId: selectedUserMessageId || null,
    selectedAssistantMessageId: selectedAssistantMessageId || null,
    citations,
    keyImagingFindings: report.keyImagingFindings ?? null,
    reflectiveQuestions: reflectiveQuestionsToNullableString(report.reflectiveQuestions),
    queueSource: 'queue',
    savedDraft: draftFromDetail ?? undefined,
  };
}

/** When `/reviews/case-answer` and `/reviews/escalated` are empty but dashboard still lists pending items. */
function mapDashboardPendingToExpertItem(row: ExpertPendingReview): ExpertReviewItem | null {
  const sessionId = String(row.id ?? '').trim();
  if (!sessionId) return null;
  const report = normalizeVisualQaReport({
    answerText: row.aiAnswerSnippet,
    suggestedDiagnosis: '',
    keyFindings: [],
    differentialDiagnoses: [],
  });
  return {
    sessionId,
    answerId: null,
    id: sessionId,
    studentName: row.studentName,
    questionText: row.questionSnippet,
    question: row.questionSnippet,
    caseId: row.caseId ?? null,
    caseTitle: row.caseTitle?.trim() ? row.caseTitle : null,
    askedAt: row.submittedAt || '',
    status: 'PendingExpert',
    report,
    turns: [],
    citations: [],
    queueSource: 'dashboard-summary',
  };
}

/**
 * True when BE pair-selection metadata cannot be aligned with session turns (strict invariant).
 * If no pair IDs are present, returns false (nothing to verify client-side).
 */
export function hasExpertReviewSelectedPairMismatch(item: ExpertReviewItem): boolean {
  const req = normalizeReviewMessageId(item.requestedReviewMessageId);
  const su = normalizeReviewMessageId(item.selectedUserMessageId);
  const sa = normalizeReviewMessageId(item.selectedAssistantMessageId);
  if (!req && !su && !sa) return false;
  const turns = item.turns ?? [];
  if (turns.length === 0) return true;

  const matched = turns.find((turn) => {
    const assistantId = normalizeReviewMessageId(turn.assistantMessageId);
    const userId = normalizeReviewMessageId(turn.userMessageId);
    if (sa && assistantId && sa === assistantId) return true;
    if (su && userId && su === userId) return true;
    if (req) {
      if (assistantId && assistantId === req) return true;
      if (userId && userId === req) return true;
    }
    return false;
  });
  if (!matched) return true;
  const mUser = normalizeReviewMessageId(matched.userMessageId);
  const mAsst = normalizeReviewMessageId(matched.assistantMessageId);
  if (su && mUser && su !== mUser) return true;
  if (sa && mAsst && sa !== mAsst) return true;
  if (req && req !== mUser && req !== mAsst) {
    return true;
  }
  return false;
}

const REVIEW_LIST_ARRAY_KEYS = [
  'pendingReviews',
  'sessions',
  'reviews',
  'escalated',
  'caseAnswers',
  'queue',
] as const;

function firstArrayFromRecord(rec: Record<string, unknown>): unknown[] | null {
  for (const key of REVIEW_LIST_ARRAY_KEYS) {
    const v = rec[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/** Align envelopes with `expert-dashboard` `unwrapList` plus common Visual QA queue property names. */
function unwrapReviewList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const b = data as Record<string, unknown>;
  if (Array.isArray(b.items)) return b.items;
  if (Array.isArray(b.data)) return b.data;
  if (Array.isArray(b.results)) return b.results;
  const fromRoot = firstArrayFromRecord(b);
  if (fromRoot) return fromRoot;
  const res = b.result;
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.results)) return r.results;
    const nested = firstArrayFromRecord(r);
    if (nested) return nested;
  }
  return [];
}

/**
 * Chi tiết đầy đủ một phiên review (citations / turns) — gọi khi mở case nếu queue list thiếu RAG evidence.
 * BE có thể chưa triển khai: khi đó trả null, FE vẫn dùng bản từ queue + merge citation theo turn.
 */
export async function fetchExpertReviewDetail(sessionId: string): Promise<ExpertReviewItem | null> {
  const id = String(sessionId ?? '').trim();
  if (!id) return null;
  const unwrap = (data: unknown): unknown => {
    if (!data || typeof data !== 'object') return data;
    const o = data as Record<string, unknown>;
    if (o.data != null) return o.data;
    if (o.item != null) return o.item;
    return data;
  };
  try {
    const { data } = await http.get<unknown>(`/api/expert/reviews/${encodeURIComponent(id)}`);
    const raw = unwrap(data);
    const row = Array.isArray(raw) ? raw[0] : raw;
    return mapExpertItem(row);
  } catch {
    try {
      const { data } = await http.get<unknown>(
        `/api/expert/reviews/${encodeURIComponent(id)}/session`,
      );
      const raw = unwrap(data);
      const row = Array.isArray(raw) ? raw[0] : raw;
      return mapExpertItem(row);
    } catch {
      return null;
    }
  }
}

/** Primary queue: case-answer reviews; fallback to escalated; then dashboard pending list if both are empty. */
export type ExpertReviewQueueStatus = 'Pending' | 'History' | 'Approved' | 'Rejected';

export async function fetchExpertReviewQueue(options?: {
  status?: ExpertReviewQueueStatus;
}): Promise<ExpertReviewItem[]> {
  const status = options?.status ?? 'Pending';
  const params = status === 'Pending' ? undefined : { status };

  try {
    const { data } = await http.get<unknown>('/api/expert/reviews/case-answer', { params });
    const primary = unwrapReviewList(data)
      .map(mapExpertItem)
      .filter((x): x is ExpertReviewItem => x !== null);
    if (primary.length > 0 || status !== 'Pending') return primary;
  } catch {
    /* fall through to escalated */
  }
  try {
    const { data } = await http.get<unknown>('/api/expert/reviews/escalated', { params });
    const secondary = unwrapReviewList(data)
      .map(mapExpertItem)
      .filter((x): x is ExpertReviewItem => x !== null);
    if (secondary.length > 0 || status !== 'Pending') return secondary;
  } catch (e) {
    if (status !== 'Pending') throw new Error(getApiErrorMessage(e));
  }
  if (status !== 'Pending') return [];
  try {
    const pending = await fetchExpertPendingReviews();
    return pending
      .map(mapDashboardPendingToExpertItem)
      .filter((x): x is ExpertReviewItem => x !== null);
  } catch {
    return [];
  }
}

export interface ExpertReviewUpdatePayload {
  answerText: string;
  structuredDiagnosis: string;
  differentialDiagnoses: string[];
  reviewNote: string;
  keyImagingFindings?: string | null;
  reflectiveQuestions?: string | null;
  correctedRoiBoundingBox?: number[] | null;
  decision?: 'approve' | 'reject';
}

const reviewSubmitBody = (payload: ExpertReviewUpdatePayload) => {
  const roi = payload.correctedRoiBoundingBox;
  const roiBody =
    Array.isArray(roi) && roi.length >= 4 && roi.slice(0, 4).every((n) => Number.isFinite(n))
      ? { correctedRoiBoundingBox: roi.slice(0, 4) }
      : {};
  const decisionBody =
    payload.decision !== undefined ? { decision: payload.decision } : {};
  return {
    answerText: payload.answerText,
    structuredDiagnosis: payload.structuredDiagnosis,
    differentialDiagnoses:
      payload.differentialDiagnoses.length > 0
        ? JSON.stringify(payload.differentialDiagnoses)
        : null,
    reviewNote: payload.reviewNote,
    keyImagingFindings: payload.keyImagingFindings ?? null,
    reflectiveQuestions: payload.reflectiveQuestions ?? null,
    ...roiBody,
    ...decisionBody,
  };
};

export type ExpertReviewDraftPayload = ExpertReviewSavedDraft;

function parseDraftDifferentialList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(/[\n;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseDraftRoi(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length < 4) return undefined;
  const nums = raw.slice(0, 4).map((n) => Number(n));
  if (nums.every((n) => Number.isFinite(n))) return nums;
  return undefined;
}

/** Normalizes GET /draft or embedded draft JSON from review detail. */
export function parseExpertReviewDraftPayload(raw: unknown): ExpertReviewDraftPayload | null {
  if (raw == null) return null;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseExpertReviewDraftPayload(JSON.parse(raw));
    } catch {
      return raw.trim() ? { reviewNote: raw.trim() } : null;
    }
  }
  if (typeof raw !== 'object') return null;

  const root = raw as Record<string, unknown>;
  const row = (root.data ?? root.draft ?? root.result ?? root.savedDraft ?? root) as Record<
    string,
    unknown
  >;

  const structuredDiagnosis = String(
    row.structuredDiagnosis ?? row.StructuredDiagnosis ?? '',
  ).trim();
  const keyImagingFindingsRaw = row.keyImagingFindings ?? row.KeyImagingFindings;
  const reflectiveQuestionsRaw = row.reflectiveQuestions ?? row.ReflectiveQuestions;
  const reviewNote = String(row.reviewNote ?? row.ReviewNote ?? '').trim();
  const answerText = String(row.answerText ?? row.AnswerText ?? '').trim();
  const differentialDiagnoses = parseDraftDifferentialList(
    row.differentialDiagnoses ?? row.DifferentialDiagnoses,
  );
  const correctedRoiBoundingBox = parseDraftRoi(
    row.correctedRoiBoundingBox ?? row.CorrectedRoiBoundingBox,
  );
  const libraryTitle = String(row.libraryTitle ?? row.LibraryTitle ?? '').trim();
  const libraryCategoryId = String(row.libraryCategoryId ?? row.LibraryCategoryId ?? '').trim();
  const libraryDifficulty = String(row.libraryDifficulty ?? row.LibraryDifficulty ?? '').trim();
  const libraryClinicalDescription = String(
    row.libraryClinicalDescription ?? row.LibraryClinicalDescription ?? '',
  ).trim();
  const libraryAnatomySite = String(row.libraryAnatomySite ?? row.LibraryAnatomySite ?? '').trim();
  const tagIdsRaw = row.libraryTagIds ?? row.LibraryTagIds ?? row.tagIds ?? row.TagIds;
  const libraryTagIds = Array.isArray(tagIdsRaw)
    ? tagIdsRaw.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const hasContent =
    Boolean(structuredDiagnosis) ||
    Boolean(answerText) ||
    differentialDiagnoses.length > 0 ||
    Boolean(keyImagingFindingsRaw) ||
    Boolean(reflectiveQuestionsRaw) ||
    Boolean(reviewNote) ||
    Boolean(correctedRoiBoundingBox) ||
    Boolean(libraryTitle) ||
    Boolean(libraryClinicalDescription);

  if (!hasContent) return null;

  return {
    ...(answerText ? { answerText } : {}),
    ...(structuredDiagnosis ? { structuredDiagnosis } : {}),
    ...(differentialDiagnoses.length > 0 ? { differentialDiagnoses } : {}),
    ...(keyImagingFindingsRaw != null
      ? { keyImagingFindings: String(keyImagingFindingsRaw).trim() || null }
      : {}),
    ...(reflectiveQuestionsRaw != null
      ? { reflectiveQuestions: String(reflectiveQuestionsRaw).trim() || null }
      : {}),
    ...(reviewNote ? { reviewNote } : {}),
    ...(correctedRoiBoundingBox ? { correctedRoiBoundingBox } : {}),
    ...(libraryTitle ? { libraryTitle } : {}),
    ...(libraryCategoryId ? { libraryCategoryId } : {}),
    ...(libraryDifficulty ? { libraryDifficulty } : {}),
    ...(libraryTagIds.length > 0 ? { libraryTagIds } : {}),
    ...(libraryClinicalDescription ? { libraryClinicalDescription } : {}),
    ...(libraryAnatomySite ? { libraryAnatomySite } : {}),
  };
}

export async function fetchExpertReviewDraft(
  sessionId: string,
): Promise<ExpertReviewDraftPayload | null> {
  if (!EXPERT_REVIEW_DRAFT_API_ENABLED) return null;
  const id = String(sessionId ?? '').trim();
  if (!id) return null;
  try {
    const { data } = await http.get<unknown>(
      `/api/expert/reviews/${encodeURIComponent(id)}/draft`,
      { skipApiToast: true },
    );
    return parseExpertReviewDraftPayload(data);
  } catch (e) {
    if (
      axios.isAxiosError(e) &&
      (e.response?.status === 404 || e.response?.status === 405)
    ) {
      return null;
    }
    return null;
  }
}

const reviewDraftBody = (payload: ExpertReviewSavedDraft): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (payload.answerText !== undefined) body.answerText = payload.answerText;
  if (payload.structuredDiagnosis !== undefined) body.structuredDiagnosis = payload.structuredDiagnosis;
  if (payload.differentialDiagnoses !== undefined) {
    body.differentialDiagnoses =
      payload.differentialDiagnoses.length > 0
        ? JSON.stringify(payload.differentialDiagnoses)
        : null;
  }
  if (payload.keyImagingFindings !== undefined) body.keyImagingFindings = payload.keyImagingFindings;
  if (payload.reflectiveQuestions !== undefined) body.reflectiveQuestions = payload.reflectiveQuestions;
  if (payload.reviewNote !== undefined) body.reviewNote = payload.reviewNote;
  if (payload.libraryTitle !== undefined) body.libraryTitle = payload.libraryTitle;
  if (payload.libraryCategoryId !== undefined) body.libraryCategoryId = payload.libraryCategoryId;
  if (payload.libraryDifficulty !== undefined) body.libraryDifficulty = payload.libraryDifficulty;
  if (payload.libraryClinicalDescription !== undefined) {
    body.libraryClinicalDescription = payload.libraryClinicalDescription;
  }
  if (payload.libraryAnatomySite !== undefined) body.libraryAnatomySite = payload.libraryAnatomySite;
  if (payload.libraryTagIds !== undefined) body.libraryTagIds = payload.libraryTagIds;
  const roi = payload.correctedRoiBoundingBox;
  if (Array.isArray(roi) && roi.length >= 4 && roi.slice(0, 4).every((n) => Number.isFinite(n))) {
    body.correctedRoiBoundingBox = roi.slice(0, 4);
  }
  return body;
};

export async function putExpertReviewDraft(
  sessionId: string,
  payload: ExpertReviewDraftPayload,
): Promise<void> {
  if (!EXPERT_REVIEW_DRAFT_API_ENABLED) return;
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  const body = reviewDraftBody(payload);
  try {
    await http.put(`/api/expert/reviews/${encodeURIComponent(id)}/draft`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteExpertReviewDraft(sessionId: string): Promise<void> {
  if (!EXPERT_REVIEW_DRAFT_API_ENABLED) return;
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  try {
    await http.delete(`/api/expert/reviews/${encodeURIComponent(id)}/draft`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function resolveExpertReview(
  sessionId: string,
  payload: ExpertReviewUpdatePayload,
): Promise<void> {
  const body = reviewSubmitBody(payload);
  try {
    await http.post(`/api/expert/reviews/${sessionId}/resolve`, body, {
      headers: { 'Content-Type': 'application/json' },
      skipApiToast: true,
    });
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
      throw new Error(REVIEW_WORKFLOW_CONFLICT);
    }
    throw new Error(getApiErrorMessage(e));
  }
}

export async function postExpertResponse(
  sessionId: string,
  content: string,
  options?: { correctedRoiBoundingBox?: number[] | null },
): Promise<void> {
  const id = String(sessionId ?? '').trim();
  const message = String(content ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  if (!message) throw new Error('Feedback content is required.');
  const roi = options?.correctedRoiBoundingBox;
  const body: { content: string; correctedRoiBoundingBox?: number[] } = { content: message };
  if (Array.isArray(roi) && roi.length >= 4) {
    body.correctedRoiBoundingBox = roi.slice(0, 4);
  }
  try {
    await http.post(`/api/expert/reviews/${encodeURIComponent(id)}/respond`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
      throw new Error(REVIEW_WORKFLOW_CONFLICT);
    }
    throw new Error(getApiErrorMessage(e));
  }
}

export async function approveExpertReview(sessionId: string): Promise<void> {
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  try {
    await http.post(`/api/expert/reviews/${encodeURIComponent(id)}/approve`, {}, {
      headers: { 'Content-Type': 'application/json' },
      skipApiToast: true,
    });
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
      throw new Error(REVIEW_WORKFLOW_CONFLICT);
    }
    throw new Error(getApiErrorMessage(e));
  }
}

export interface PromoteExpertReviewPayload {
  /** Tiêu đề case thư viện — bắt buộc trước khi promote (BE có thể map sang `title` / `caseTitle`). */
  title: string;
  categoryId?: string;
  categoryName?: string;
  difficulty: string;
  /** Preferred — UUID tags from GET /api/expert/tags. */
  tagIds: string[];
  /** Fallback when tagIds unavailable (legacy BE). */
  tagNames?: string[];
  /** Clinical narrative for learners (publish form). */
  clinicalDescription?: string;
  /** Main case description / clinical context stored on case. */
  description: string;
  /** Suggested main diagnosis from expert override. */
  suggestedMainDiagnosis?: string;
  /** BE field name — differential diagnoses (newline-separated). */
  suggestedDiagnosis: string;
  differentialDiagnoses?: string[];
  /** Key imaging findings on case. */
  keyFindings: string;
  reflectiveQuestions: string;
  studentQuestion?: string;
  referencesAndCitations?: string;
  anatomySite?: string;
  boneLocation?: string;
  pathologyGroup?: string;
  /** ROI / annotation theo từng turn (JSON tuỳ BE). */
  turnAnnotations?: Array<Record<string, unknown>>;
  /** Study image from the Visual QA session — required for student-upload promote flows. */
  imageId?: string | null;
  /** Signals promote-from-student-request (BE sets caseOrigin = fromStudentRequest). */
  fromStudentRequest?: boolean;
  caseOrigin?: 'fromStudentRequest' | 'expertCreated' | string;
}

export interface PromoteExpertReviewResult {
  caseId: string | null;
  categoryName?: string;
  difficulty?: string;
  tagNames?: string[];
}

export type ApproveAndPromoteExpertReviewOptions = {
  reviewNote?: string | null;
  correctedRoiBoundingBox?: number[] | null;
};

function parsePromoteExpertReviewResult(data: unknown): PromoteExpertReviewResult {
  if (!data || typeof data !== 'object') return { caseId: null };
  const record = data as Record<string, unknown>;
  const nestedData = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null;
  const nestedResult =
    record.result && typeof record.result === 'object' ? (record.result as Record<string, unknown>) : null;
  const source = nestedData ?? nestedResult ?? record;
  const direct =
    source.promotedCaseId ??
    source.PromotedCaseId ??
    source.caseId ??
    source.CaseId ??
    null;
  const tagNamesResponse = source.tagNames ?? source.TagNames;
  return {
    caseId: direct != null ? String(direct) : null,
    categoryName:
      source.categoryName != null
        ? String(source.categoryName)
        : source.CategoryName != null
          ? String(source.CategoryName)
          : undefined,
    difficulty: source.difficulty != null ? String(source.difficulty) : undefined,
    tagNames: Array.isArray(tagNamesResponse)
      ? tagNamesResponse.map((t) => String(t).trim()).filter(Boolean)
      : undefined,
  };
}

function buildPromoteRequestBody(payload: PromoteExpertReviewPayload): Record<string, unknown> {
  const title = String(payload.title ?? '').trim();
  const difficulty = String(payload.difficulty ?? '').trim();
  const tagIds = Array.isArray(payload.tagIds)
    ? payload.tagIds.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const tagNames = Array.isArray(payload.tagNames)
    ? payload.tagNames.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const differentialDiagnoses = Array.isArray(payload.differentialDiagnoses)
    ? payload.differentialDiagnoses.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const body: Record<string, unknown> = {
    title,
    categoryId: payload.categoryId?.trim() || undefined,
    categoryName: payload.categoryName?.trim() || undefined,
    difficulty,
    tagIds,
    tagNames: tagNames.length > 0 ? tagNames : undefined,
    clinicalDescription: payload.clinicalDescription?.trim() || undefined,
    description: String(payload.description ?? '').trim(),
    suggestedMainDiagnosis: payload.suggestedMainDiagnosis?.trim() || undefined,
    suggestedDiagnosis: String(payload.suggestedDiagnosis ?? '').trim(),
    differentialDiagnoses: differentialDiagnoses.length > 0 ? differentialDiagnoses : undefined,
    keyFindings: String(payload.keyFindings ?? '').trim(),
    reflectiveQuestions: String(payload.reflectiveQuestions ?? '').trim(),
    studentQuestion: payload.studentQuestion?.trim() || undefined,
    referencesAndCitations: payload.referencesAndCitations?.trim() || undefined,
    CategoryId: payload.categoryId?.trim() || undefined,
    CategoryName: payload.categoryName?.trim() || undefined,
    TagIds: tagIds,
    TagNames: tagNames.length > 0 ? tagNames : undefined,
  };
  const anatomy = payload.anatomySite?.trim() || payload.boneLocation?.trim();
  if (anatomy) {
    body.anatomySite = anatomy;
    body.boneLocation = anatomy;
  }
  const pathologyGroup = normalizeToPromotePathologyGroup(payload.pathologyGroup ?? '');
  if (!pathologyGroup) {
    throw new ExpertPromoteValidationError(
      'Select a pathology category: Trauma, Tumor, Infection, Degenerative, or Congenital.',
    );
  }
  body.pathologyGroup = pathologyGroup;
  body.PathologyGroup = pathologyGroup;
  if (Array.isArray(payload.turnAnnotations) && payload.turnAnnotations.length > 0) {
    body.turnAnnotations = payload.turnAnnotations;
  }
  const imageId = payload.imageId?.trim();
  if (imageId) {
    body.imageId = imageId;
    body.ImageId = imageId;
  }
  if (payload.fromStudentRequest === true) {
    body.fromStudentRequest = true;
    body.FromStudentRequest = true;
    body.caseOrigin = payload.caseOrigin?.trim() || 'fromStudentRequest';
    body.CaseOrigin = body.caseOrigin;
  }
  if (!title || !difficulty) {
    throw new Error('Title and difficulty are required to publish to the library.');
  }
  if (tagIds.length === 0 && tagNames.length === 0) {
    throw new Error('Select at least one tag before publishing to the library.');
  }
  if (!body.description || !body.suggestedDiagnosis || !body.keyFindings || !body.reflectiveQuestions) {
    throw new Error('AI-mapped case fields (description, differential, findings, reflective questions) are required.');
  }
  return body;
}

function rethrowPromoteWorkflowError(e: unknown): never {
  if (e instanceof ExpertPromoteValidationError) {
    throw e;
  }
  if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
    throw new Error(REVIEW_WORKFLOW_CONFLICT);
  }
  const message = getApiErrorMessage(e);
  if (isExpertPromoteUserErrorMessage(message)) {
    throw new Error(message);
  }
  if (axios.isAxiosError(e) && e.response?.status === 400) {
    throw new Error(message || 'The library publish request was rejected. Check required fields and try again.');
  }
  throw new Error(
    message
      ? `System error: ${message}`
      : 'System error: Could not publish to the library. Try again or contact an administrator.',
  );
}

export async function promoteExpertReview(
  sessionId: string,
  payload: PromoteExpertReviewPayload,
): Promise<PromoteExpertReviewResult> {
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  const body = buildPromoteRequestBody(payload);
  try {
    const { data } = await http.post<unknown>(`/api/expert/reviews/${encodeURIComponent(id)}/promote`, body, {
      headers: { 'Content-Type': 'application/json' },
      skipApiToast: true,
    });
    return parsePromoteExpertReviewResult(data);
  } catch (e) {
    rethrowPromoteWorkflowError(e);
  }
}

/**
 * Publish to library, then approve the review.
 * Uses promote → approve (not approve-and-promote): BE currently returns 400
 * "Request body must be JSON with approve-and-promote fields" for the atomic endpoint.
 */
export async function approveAndPromoteExpertReview(
  sessionId: string,
  payload: PromoteExpertReviewPayload,
  _options: ApproveAndPromoteExpertReviewOptions = {},
): Promise<PromoteExpertReviewResult> {
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('Session id is required.');
  try {
    const result = await promoteExpertReview(id, payload);
    await approveExpertReview(id);
    return result;
  } catch (e) {
    rethrowPromoteWorkflowError(e);
  }
}

export async function flagRagChunk(
  chunkId: string,
  payload: { reason: string; isFlagged?: boolean },
): Promise<void> {
  try {
    await http.post(
      `/api/expert/documents/chunks/${encodeURIComponent(chunkId.trim())}/flag`,
      {
        reason: payload.reason,
        isFlagged: payload.isFlagged ?? true,
        IsFlagged: payload.isFlagged ?? true,
      },
      { skipApiToast: true },
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
