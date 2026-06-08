import type {
  VisualQaCitation,
  VisualQaMessage,
  VisualQaReport,
  VisualQaSessionReport,
  VisualQaTurn,
} from './types';
import { parseNormalizedBoundingBox } from '@/lib/utils/annotations';
import { normalizeDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';

function pick<T extends object>(o: T, keys: string[]): unknown {
  for (const k of keys) {
    if (k in o && (o as Record<string, unknown>)[k] !== undefined) {
      return (o as Record<string, unknown>)[k];
    }
  }
  return undefined;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : String(x)));
}

function asNullableString(v: unknown): string | null {
  const normalized = asString(v).trim();
  return normalized || null;
}

function asNullableNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeRootPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};

  const base = raw as Record<string, unknown>;
  for (const key of ['data', 'result', 'item', 'payload']) {
    const nestedCandidate = pick(base, [key]);
    if (!nestedCandidate || nestedCandidate === raw) continue;
    if (nestedCandidate && typeof nestedCandidate === 'object' && !Array.isArray(nestedCandidate)) {
      const normalizedNested = normalizeRootPayload(nestedCandidate);
      if (Object.keys(normalizedNested).length > 0) return normalizedNested;
    }
  }
  return base;
}

function reflectiveQuestionsReportToTurnArray(
  rq: VisualQaReport['reflectiveQuestions'],
): string[] | undefined {
  if (rq == null) return undefined;
  if (Array.isArray(rq)) return rq.map((x) => String(x).trim()).filter(Boolean);
  const s = String(rq).trim();
  return s ? [s] : undefined;
}

function normalizeVisualQaMessage(raw: unknown): VisualQaMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const role = asString(pick(m, ['role'])).trim();
  const content = asString(pick(m, ['content'])).trim();
  if (!content) return null;
  const createdAtRaw = pick(m, ['createdAt']);
  return {
    role: role || 'Assistant',
    content,
    createdAt: typeof createdAtRaw === 'string' ? createdAtRaw : null,
  };
}

function parseCitationLikeEntry(raw: unknown): VisualQaCitation | null {
  if (!raw || typeof raw !== 'object') return null;
  const cc = raw as Record<string, unknown>;
  const snippetFromApi =
    asNullableString(cc.snippet) ??
    asNullableString(
      cc.sourceText ??
        cc.source_text ??
        cc.preview ??
        cc.text ??
        cc.chunkText ??
        cc.chunk_text ??
        cc.excerpt,
    );
  const titleFromApi =
    asNullableString(cc.title) ??
    asNullableString(cc.documentTitle ?? cc.document_title ?? cc.documentName ?? cc.document_name);
  const documentUrl =
    asNullableString(
      cc.documentUrl ??
        cc.document_url ??
        cc.url ??
        cc.fileUrl ??
        cc.file_url ??
        cc.referenceUrl ??
        cc.reference_url,
    ) ?? undefined;
  const caseId = asNullableString(cc.caseId ?? cc.case_id ?? cc.medicalCaseId ?? cc.medical_case_id);
  const documentId = asNullableString(cc.documentId ?? cc.document_id);
  const chunkId = asNullableString(cc.chunkId ?? cc.chunk_id ?? cc.id ?? cc.ChunkId);
  const displayLabel =
    asNullableString(cc.displayLabel ?? cc.display_label ?? cc.sourceLabel ?? cc.source_label) ?? undefined;
  const label = asNullableString(cc.label ?? cc.referenceLabel ?? cc.reference_label) ?? undefined;
  const href = asNullableString(cc.href ?? cc.referenceHref ?? cc.reference_href) ?? undefined;
  const version = asNullableString(cc.version ?? cc.documentVersion ?? cc.document_version) ?? undefined;
  const pageNumber = asNullableNumber(cc.pageNumber ?? cc.page_number);
  const startPage = asNullableNumber(cc.startPage ?? cc.start_page);
  const endPage = asNullableNumber(cc.endPage ?? cc.end_page);
  const chunkOrder = asNullableNumber(cc.chunkOrder ?? cc.chunk_order);
  const pageLabel =
    asNullableString(cc.pageLabel ?? cc.page_label) ??
    (pageNumber != null ? `Page ${pageNumber}` : undefined);
  const rawKind = asNullableString(cc.kind ?? cc.type)?.toLowerCase();
  const kind =
    rawKind === 'document'
      ? 'doc'
      : rawKind === 'case'
        ? 'case'
        : caseId
          ? 'case'
          : documentUrl || documentId || chunkId
            ? 'doc'
            : undefined;

  if (
    !snippetFromApi &&
    !titleFromApi &&
    !documentUrl &&
    !caseId &&
    !documentId &&
    !chunkId &&
    !displayLabel &&
    !label &&
    !href
  ) {
    return null;
  }

  return {
    kind,
    documentUrl,
    chunkOrder,
    pageNumber,
    startPage,
    endPage,
    title: titleFromApi ?? undefined,
    label,
    displayLabel,
    snippet: snippetFromApi ?? undefined,
    pageLabel,
    href,
    documentId: documentId ?? undefined,
    caseId: caseId ?? undefined,
    chunkId: chunkId ?? undefined,
    version,
  };
}

function citationListFromUnknown(raw: unknown): VisualQaCitation[] {
  if (Array.isArray(raw)) {
    return raw
      .map(parseCitationLikeEntry)
      .filter((citation): citation is VisualQaCitation => citation !== null);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return citationListFromUnknown(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function dedupeCitations(citations: VisualQaCitation[]): VisualQaCitation[] {
  const seen = new Set<string>();
  const out: VisualQaCitation[] = [];
  for (const citation of citations) {
    const key = [
      citation.kind ?? '',
      citation.chunkId ?? '',
      citation.documentId ?? '',
      citation.caseId ?? '',
      citation.documentUrl ?? '',
      citation.href ?? '',
      citation.title ?? '',
      citation.pageLabel ?? '',
      citation.snippet ?? '',
    ]
      .join('::')
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(citation);
  }
  return out;
}

function mergeTurnWithReport(turn: VisualQaTurn, report: VisualQaReport): VisualQaTurn {
  const mergedReflective = reflectiveQuestionsReportToTurnArray(report.reflectiveQuestions);
  return {
    ...turn,
    answerText: turn.answerText?.trim() || report.answerText?.trim() || turn.answerText,
    diagnosis: turn.diagnosis?.trim() || report.diagnosis?.trim() || turn.diagnosis,
    findings: turn.findings?.length ? turn.findings : report.findings ?? turn.findings,
    differentialDiagnoses:
      turn.differentialDiagnoses?.length ? turn.differentialDiagnoses : report.differentialDiagnoses,
    reflectiveQuestions:
      turn.reflectiveQuestions?.length ? turn.reflectiveQuestions : mergedReflective ?? turn.reflectiveQuestions,
    citations: turn.citations?.length ? turn.citations : report.citations,
    aiConfidenceScore: turn.aiConfidenceScore ?? report.aiConfidenceScore,
    responseKind: turn.responseKind ?? report.responseKind,
    clientRequestId: turn.clientRequestId ?? report.clientRequestId,
    policyReason: turn.policyReason ?? report.policyReason,
    systemNoticeCode: turn.systemNoticeCode ?? report.systemNoticeCode,
  };
}

function upsertLatestTurn(turns: VisualQaTurn[], latest: VisualQaTurn | null): VisualQaTurn[] {
  if (!latest) return turns;
  const matchIndex = turns.findIndex((turn) => {
    if (latest.turnId?.trim() && turn.turnId?.trim()) {
      return latest.turnId.trim() === turn.turnId.trim();
    }
    if (latest.clientRequestId?.trim() && turn.clientRequestId?.trim()) {
      return latest.clientRequestId.trim() === turn.clientRequestId.trim();
    }
    return latest.turnIndex === turn.turnIndex;
  });
  if (matchIndex >= 0) {
    const next = [...turns];
    const existing = next[matchIndex];
    next[matchIndex] = {
      ...existing,
      ...latest,
      messages: latest.messages?.length ? latest.messages : existing.messages,
      questionCoordinates: latest.questionCoordinates ?? existing.questionCoordinates,
      roiBoundingBox: latest.roiBoundingBox ?? existing.roiBoundingBox,
      expertCorrectedRoiBoundingBox:
        latest.expertCorrectedRoiBoundingBox ?? existing.expertCorrectedRoiBoundingBox,
      findings: latest.findings?.length ? latest.findings : existing.findings,
      reflectiveQuestions: latest.reflectiveQuestions?.length
        ? latest.reflectiveQuestions
        : existing.reflectiveQuestions,
      differentialDiagnoses: latest.differentialDiagnoses?.length
        ? latest.differentialDiagnoses
        : existing.differentialDiagnoses,
      citations: latest.citations?.length ? latest.citations : existing.citations,
    };
    return next;
  }
  return [...turns, latest].sort((a, b) => a.turnIndex - b.turnIndex);
}

export function normalizeVisualQaReport(raw: unknown): VisualQaReport {
  const o = normalizeRootPayload(raw);
  const questionText = asString(pick(o, ['questionText', 'QuestionText'])).trim();
  const answer = asString(
    pick(o, [
      'answerText',
      'messageText',
      'AnswerText',
      'MessageText',
      'answer_text',
      'message_text',
    ]),
  ).trim();
  const diagnosisRaw = asString(pick(o, ['diagnosis', 'Diagnosis'])).trim();
  const suggestedDiagnosis = asString(
    pick(o, ['suggestedDiagnosis', 'SuggestedDiagnosis', 'suggested_diagnosis']),
  ).trim();
  /** Một số payload gửi `suggestedDiagnosis` mà không có `diagnosis` — turn phải gộp để card Diagnosis + flag structured khớp BE. */
  const diagnosis = diagnosisRaw || suggestedDiagnosis;
  const keyFindings = asStringArray(pick(o, ['keyFindings', 'key_findings']));
  const keyImagingFindings = asString(pick(o, ['keyImagingFindings', 'key_imaging_findings'])).trim();
  const findings = asStringArray(pick(o, ['findings', 'Findings']));
  const differentialDiagnoses = asStringArray(
    pick(o, ['differentialDiagnoses', 'DifferentialDiagnoses', 'differential_diagnoses']),
  );
  const reflectiveQuestions = asStringArray(
    pick(o, ['reflectiveQuestions', 'ReflectiveQuestions', 'reflective_questions']),
  );

  const citations = dedupeCitations(
    [
      'citations',
      'Citations',
      'references',
      'References',
      'sourceChunks',
      'source_chunks',
      'SourceChunks',
      'sourceDocuments',
      'source_documents',
      'ragCitations',
      'rag_citations',
      'ragChunks',
      'rag_chunks',
      'retrievedChunks',
      'retrieved_chunks',
      'source_chunks',
      'citations_json',
      'citationsJson',
      'CitationsJson',
      'references_json',
      'referencesJson',
    ]
      .flatMap((key) => citationListFromUnknown(pick(o, [key])))
      .filter((citation) => citation !== null),
  );

  const confRaw = pick(o, ['aiConfidenceScore']);
  let aiConfidenceScore: number | undefined;
  if (typeof confRaw === 'number' && Number.isFinite(confRaw)) {
    aiConfidenceScore = confRaw;
  } else if (typeof confRaw === 'string' && confRaw.trim()) {
    const n = parseFloat(confRaw);
    if (Number.isFinite(n)) aiConfidenceScore = n;
  }

  return {
    ...(questionText ? { questionText } : {}),
    ...(answer ? { answerText: answer } : {}),
    ...(suggestedDiagnosis && suggestedDiagnosis !== diagnosis ? { suggestedDiagnosis } : {}),
    keyFindings,
    ...(keyImagingFindings ? { keyImagingFindings } : {}),
    ...(diagnosis ? { diagnosis } : {}),
    ...(findings.length > 0 ? { findings } : {}),
    ...(reflectiveQuestions.length > 0 ? { reflectiveQuestions } : {}),
    differentialDiagnoses,
    citations,
    ...(aiConfidenceScore !== undefined ? { aiConfidenceScore } : {}),
    responseKind: asNullableString(pick(o, ['responseKind', 'response_kind'])),
    clientRequestId: asNullableString(pick(o, ['clientRequestId', 'client_request_id'])),
    policyReason: asNullableString(pick(o, ['policyReason', 'policy_reason'])),
    systemNoticeCode: asNullableString(pick(o, ['systemNoticeCode', 'system_notice_code'])),
  };
}

function coordinatesFromUserMessage(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  const um = raw as Record<string, unknown>;
  return (
    pick(um, ['questionCoordinates', 'question_coordinates']) ??
    pick(um, ['coordinates', 'Coordinates'])
  );
}

function normalizeVisualQaTurn(raw: unknown, fallbackIndex: number): VisualQaTurn {
  const report = normalizeVisualQaReport(raw);
  const o = normalizeRootPayload(raw);
  const turnRaw = pick(o, ['turnIndex']);
  const createdRaw = pick(o, ['createdAt']);
  const roiRaw = pick(o, ['roiBoundingBox', 'roi_bounding_box']);
  const questionCoordsRaw = pick(o, [
    'questionCoordinates',
    'question_coordinates',
    'QuestionCoordinates',
  ]);
  const userMessageRaw = pick(o, ['userMessage', 'user_message', 'UserMessage']);
  const questionCoordsParsed =
    parseNormalizedBoundingBox(questionCoordsRaw) ??
    parseNormalizedBoundingBox(coordinatesFromUserMessage(userMessageRaw));
  const roiFromLegacyFields = parseNormalizedBoundingBox(roiRaw);
  const roiBoundingBox = roiFromLegacyFields ?? questionCoordsParsed;
  const expertRoiRaw = pick(o, [
    'expertCorrectedRoiBoundingBox',
    'expert_corrected_roi_bounding_box',
    'ExpertCorrectedRoiBoundingBox',
  ]);
  const expertCorrectedRoiBoundingBox = parseNormalizedBoundingBox(expertRoiRaw);
  const turnIndex =
    typeof turnRaw === 'number' && Number.isFinite(turnRaw)
      ? turnRaw
      : typeof turnRaw === 'string' && turnRaw.trim()
        ? Number.parseInt(turnRaw, 10) || fallbackIndex
        : fallbackIndex;
  const messagesRaw = pick(o, ['messages', 'Messages']);
  const messages = Array.isArray(messagesRaw)
    ? messagesRaw
        .map((row): VisualQaMessage | null => normalizeVisualQaMessage(row))
        .filter((message): message is VisualQaMessage => message !== null)
    : [];
  const reflectiveTurn = reflectiveQuestionsReportToTurnArray(report.reflectiveQuestions);
  return {
    turnId: asNullableString(pick(o, ['turnId', 'turn_id'])),
    turnIndex,
    ...(report.questionText ? { questionText: report.questionText } : {}),
    ...(report.answerText ? { answerText: report.answerText } : {}),
    ...(messages.length > 0 ? { messages } : {}),
    ...(questionCoordsParsed ? { questionCoordinates: questionCoordsParsed } : {}),
    roiBoundingBox,
    ...(expertCorrectedRoiBoundingBox
      ? { expertCorrectedRoiBoundingBox }
      : {}),
    diagnosis: (report.diagnosis ?? report.suggestedDiagnosis ?? '').trim(),
    structuredDiagnosis: asNullableString(pick(o, ['structuredDiagnosis', 'StructuredDiagnosis'])),
    ...(report.findings ? { findings: report.findings } : {}),
    ...(reflectiveTurn && reflectiveTurn.length > 0 ? { reflectiveQuestions: reflectiveTurn } : {}),
    differentialDiagnoses: report.differentialDiagnoses,
    citations: report.citations,
    aiConfidenceScore: report.aiConfidenceScore,
    createdAt: typeof createdRaw === 'string' ? createdRaw : null,
    responseKind: report.responseKind ?? asNullableString(pick(o, ['responseKind', 'response_kind'])),
    clientRequestId:
      report.clientRequestId ?? asNullableString(pick(o, ['clientRequestId', 'client_request_id'])),
    userMessageId: asNullableString(pick(o, ['userMessageId', 'user_message_id'])),
    assistantMessageId: asNullableString(
      pick(o, ['assistantMessageId', 'assistant_message_id', 'messageId', 'message_id']),
    ),
    reviewState: asNullableString(pick(o, ['reviewState', 'review_state'])),
    answerStatus: asNullableString(pick(o, ['answerStatus', 'AnswerStatus', 'answer_status'])),
    lastResponderRole: asNullableString(pick(o, ['lastResponderRole', 'last_responder_role'])),
    actorRole: asNullableString(pick(o, ['actorRole', 'actor_role'])),
    isReviewTarget:
      typeof pick(o, ['isReviewTarget', 'is_review_target']) === 'boolean'
        ? Boolean(pick(o, ['isReviewTarget', 'is_review_target']))
        : undefined,
    reviewTargetAssistantMessageId: asNullableString(
      pick(o, [
        'reviewTargetAssistantMessageId',
        'review_target_assistant_message_id',
        'targetAssistantMessageId',
        'target_assistant_message_id',
      ]),
    ),
    reviewTargetTurnId: asNullableString(
      pick(o, ['reviewTargetTurnId', 'review_target_turn_id', 'targetTurnId', 'target_turn_id']),
    ),
    reviewTargetTurnIndex: (() => {
      const v = pick(o, ['reviewTargetTurnIndex', 'review_target_turn_index', 'targetTurnIndex', 'target_turn_index']);
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim()) {
        const n = Number.parseInt(v, 10);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    })(),
    policyReason: report.policyReason ?? asNullableString(pick(o, ['policyReason', 'policy_reason'])),
    systemNoticeCode:
      report.systemNoticeCode ?? asNullableString(pick(o, ['systemNoticeCode', 'system_notice_code'])),
  };
}

export function normalizeVisualQaSessionReport(raw: unknown): VisualQaSessionReport {
  const o = normalizeRootPayload(raw);
  const sessionId = asString(pick(o, ['sessionId'])).trim();
  const caseId = asString(pick(o, ['caseId'])).trim() || null;
  const imageId = asString(pick(o, ['imageId'])).trim() || null;
  const status = asString(pick(o, ['status'])).trim() || null;
  const sessionStatus =
    asNullableString(pick(o, ['sessionStatus', 'session_status', 'SessionStatus'])) ?? status;
  const reviewFeedback = asNullableString(
    pick(o, ['reviewFeedback', 'review_feedback', 'ReviewFeedback']),
  );
  const updatedAtRaw = pick(o, ['updatedAt']);
  const updatedAt = typeof updatedAtRaw === 'string' ? updatedAtRaw : null;
  const sessionMessagesRaw = pick(o, ['messages']);
  const messages = Array.isArray(sessionMessagesRaw)
    ? sessionMessagesRaw
        .map((row): VisualQaMessage | null => normalizeVisualQaMessage(row))
        .filter((message): message is VisualQaMessage => message !== null)
    : [];
  const turnsRaw = pick(o, ['turns', 'Turns']);
  let turns = Array.isArray(turnsRaw)
    ? turnsRaw.map((row, idx) => normalizeVisualQaTurn(row, idx + 1))
    : [];
  const latestTurnRaw = pick(o, ['latestTurn', 'latest_turn', 'latest']);
  const latestFromPayload =
    latestTurnRaw && typeof latestTurnRaw === 'object'
      ? normalizeVisualQaTurn(latestTurnRaw, turns[turns.length - 1]?.turnIndex ?? turns.length + 1)
      : null;
  const capabilitiesRaw = pick(o, ['capabilities']);
  const capabilities =
    capabilitiesRaw && typeof capabilitiesRaw === 'object'
      ? {
          canAskNext:
            typeof (capabilitiesRaw as { canAskNext?: unknown }).canAskNext === 'boolean'
              ? (capabilitiesRaw as { canAskNext?: boolean }).canAskNext
              : undefined,
          canRequestReview:
            typeof (capabilitiesRaw as { canRequestReview?: unknown }).canRequestReview === 'boolean'
              ? (capabilitiesRaw as { canRequestReview?: boolean }).canRequestReview
              : undefined,
          isReadOnly:
            typeof (capabilitiesRaw as { isReadOnly?: unknown }).isReadOnly === 'boolean'
              ? (capabilitiesRaw as { isReadOnly?: boolean }).isReadOnly
              : undefined,
          turnsUsed:
            typeof (capabilitiesRaw as { turnsUsed?: unknown }).turnsUsed === 'number'
              ? (capabilitiesRaw as { turnsUsed?: number }).turnsUsed
              : undefined,
          turnLimit:
            typeof (capabilitiesRaw as { turnLimit?: unknown }).turnLimit === 'number'
              ? (capabilitiesRaw as { turnLimit?: number }).turnLimit
              : undefined,
          reason: asString((capabilitiesRaw as { reason?: unknown }).reason).trim() || null,
          blockingReason:
            asString(
              (capabilitiesRaw as { blockingReason?: unknown }).blockingReason ??
                (capabilitiesRaw as { blocking_reason?: unknown }).blocking_reason,
            ).trim() || null,
          reviewRoute:
            asString(
              (capabilitiesRaw as { reviewRoute?: unknown }).reviewRoute ??
                (capabilitiesRaw as { review_route?: unknown }).review_route,
            ).trim() || undefined,
          studyMode:
            asString(
              (capabilitiesRaw as { studyMode?: unknown }).studyMode ??
                (capabilitiesRaw as { study_mode?: unknown }).study_mode,
            ).trim() || undefined,
        }
      : undefined;
  const systemNoticeRaw = pick(o, ['systemNotice', 'system_notice']);
  const systemNotice =
    typeof systemNoticeRaw === 'string'
      ? asNullableString(systemNoticeRaw)
      : systemNoticeRaw && typeof systemNoticeRaw === 'object'
        ? asNullableString(
            pick(systemNoticeRaw as Record<string, unknown>, ['message', 'content', 'text', 'notice']),
          )
        : null;
  const systemNoticePolicyReason =
    systemNoticeRaw && typeof systemNoticeRaw === 'object'
      ? asNullableString(pick(systemNoticeRaw as Record<string, unknown>, ['policyReason', 'policy_reason']))
      : null;
  const systemNoticeCode =
    systemNoticeRaw && typeof systemNoticeRaw === 'object'
      ? asNullableString(pick(systemNoticeRaw as Record<string, unknown>, ['systemNoticeCode', 'system_notice_code', 'code']))
      : null;
  const topLevelReport = normalizeVisualQaReport(o);
  const sessionReflective = reflectiveQuestionsReportToTurnArray(topLevelReport.reflectiveQuestions);
  const dicomMetadata = normalizeDicomMetadata(
    pick(o, ['dicomMetadata', 'dicom_metadata', 'DicomMetadata', 'metadata', 'Metadata']),
  );
  const sessionImageUrl = asNullableString(
    pick(o, [
      'sessionImageUrl',
      'session_image_url',
      'studyImageUrl',
      'study_image_url',
      'StudyImageUrl',
      'imageUrl',
      'image_url',
      'ImageUrl',
      'customImageUrl',
      'custom_image_url',
    ]),
  );
  const threadRoiBoundingBox = parseNormalizedBoundingBox(
    pick(o, ['roiBoundingBox', 'roi_bounding_box', 'RoiBoundingBox']),
  );

  const latestEnriched = latestFromPayload
    ? mergeTurnWithReport(latestFromPayload, topLevelReport)
    : turns.length > 0
      ? mergeTurnWithReport(turns[turns.length - 1], topLevelReport)
      : null;

  turns = upsertLatestTurn(turns, latestEnriched);

  return {
    sessionId: sessionId || 'session-local',
    ...(sessionImageUrl ? { sessionImageUrl } : {}),
    ...(threadRoiBoundingBox ? { roiBoundingBox: threadRoiBoundingBox } : {}),
    clientRequestId: asNullableString(pick(o, ['clientRequestId', 'client_request_id'])),
    responseKind: asNullableString(pick(o, ['responseKind', 'response_kind'])),
    ...(topLevelReport.answerText ? { answerText: topLevelReport.answerText } : {}),
    ...(topLevelReport.diagnosis ? { diagnosis: topLevelReport.diagnosis } : {}),
    ...(topLevelReport.findings && topLevelReport.findings.length > 0
      ? { findings: topLevelReport.findings }
      : {}),
    ...(topLevelReport.differentialDiagnoses.length > 0
      ? { differentialDiagnoses: topLevelReport.differentialDiagnoses }
      : {}),
    ...(sessionReflective && sessionReflective.length > 0 ? { reflectiveQuestions: sessionReflective } : {}),
    ...(topLevelReport.citations.length > 0 ? { citations: topLevelReport.citations } : {}),
    caseId,
    imageId,
    ...(dicomMetadata ? { dicomMetadata } : {}),
    status,
    sessionStatus,
    reviewFeedback,
    updatedAt,
    reviewState: asNullableString(pick(o, ['reviewState', 'review_state'])),
    lastResponderRole: asNullableString(pick(o, ['lastResponderRole', 'last_responder_role'])),
    blockingNotice: asNullableString(pick(o, ['blockingNotice', 'blocking_notice'])),
    systemNotice,
    rejectionReason: asNullableString(pick(o, ['rejectionReason', 'rejection_reason'])),
    policyReason: asNullableString(pick(o, ['policyReason', 'policy_reason'])) ?? systemNoticePolicyReason,
    systemNoticeCode:
      asNullableString(pick(o, ['systemNoticeCode', 'system_notice_code'])) ?? systemNoticeCode,
    ...(capabilities ? { capabilities } : {}),
    ...(messages.length > 0 ? { messages } : {}),
    turns,
    latest: latestEnriched,
  };
}
