import axios from 'axios';
import { http, getApiErrorMessage } from './client';
import type { ClassItem, LecturerTriageRequestKind, LecturerTriageRow } from './types';

export type ExpertSpecialtyOption = {
  id: string;
  name: string;
  description?: string;
};

const MOCK_EXPERT_SPECIALTIES: ExpertSpecialtyOption[] = [
  { id: 'orthopedics', name: 'Orthopedics', description: 'Bone, joint, and musculoskeletal trauma.' },
  { id: 'radiology', name: 'Radiology', description: 'Image interpretation and radiographic correlation.' },
  { id: 'pediatrics', name: 'Pediatrics', description: 'Growth plate and age-specific bone findings.' },
  { id: 'oncology', name: 'Oncology', description: 'Bone tumors and malignant differential review.' },
  { id: 'traumatology', name: 'Traumatology', description: 'Acute injury and fracture pattern review.' },
];

function parseTriageCaseTags(r: Record<string, unknown>): string[] {
  const direct = r.caseTags ?? r.CaseTags ?? r.tags ?? r.Tags;
  if (Array.isArray(direct)) return direct.map((x) => String(x).trim()).filter(Boolean);
  if (typeof direct === 'string' && direct.trim()) {
    return direct
      .split(/[,;|]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const caseObj = r.case ?? r.Case;
  if (caseObj && typeof caseObj === 'object') {
    const c = caseObj as Record<string, unknown>;
    const nested = c.tags ?? c.Tags;
    if (Array.isArray(nested)) return nested.map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}

function normalizeExpertSpecialtyOption(raw: unknown): ExpertSpecialtyOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(
    r.id ?? r.Id ?? r.specialtyId ?? r.SpecialtyId ?? r.code ?? r.Code ?? '',
  ).trim();
  const name = String(
    r.name ?? r.Name ?? r.specialtyName ?? r.SpecialtyName ?? r.label ?? r.Label ?? '',
  ).trim();
  if (!id || !name) return null;
  const description = String(
    r.description ?? r.Description ?? r.summary ?? r.Summary ?? '',
  ).trim();
  return {
    id,
    name,
    description: description || undefined,
  };
}

export const WORKFLOW_CONFLICT = 'WORKFLOW_CONFLICT';

export async function fetchLecturerClasses(lecturerId: string): Promise<ClassItem[]> {
  try {
    const { data } = await http.get<ClassItem[]>('/api/lecturer/classes', {
      params: { lecturerId },
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchLecturerTriageList(classId: string): Promise<LecturerTriageRow[]> {
  try {
    const { data } = await http.get<unknown[]>('/api/lecturer/triage', {
      params: { classId },
    });
    return (data ?? []).map(normalizeTriageRow).filter((x): x is LecturerTriageRow => x !== null);
  } catch {
    return [];
  }
}

export async function getQuestionDetail(
  classId: string,
  questionId: string,
): Promise<unknown> {
  try {
    const { data } = await http.get(`/api/lecturer/classes/${classId}/questions/${questionId}`);
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertSpecialties(): Promise<ExpertSpecialtyOption[]> {
  const endpoints = [
    '/api/specialties',
    '/api/lecturer/experts/specialties',
    '/api/lecturer/specialties',
    '/api/expert/specialties',
  ] as const;

  for (const endpoint of endpoints) {
    try {
      const { data } = await http.get<unknown>(endpoint);
      const list = Array.isArray(data)
        ? data
        : data && typeof data === 'object'
          ? ((data as Record<string, unknown>).items ??
              (data as Record<string, unknown>).data ??
              (data as Record<string, unknown>).result)
          : [];
      if (Array.isArray(list)) {
        const normalized = list
          .map(normalizeExpertSpecialtyOption)
          .filter((item): item is ExpertSpecialtyOption => item !== null);
        if (normalized.length > 0) return normalized;
      }
    } catch {
      /* fall through to next endpoint / mock fallback */
    }
  }

  return MOCK_EXPERT_SPECIALTIES;
}

export async function respondToQuestion(
  classId: string,
  questionId: string,
  body: {
    answerText: string;
    structuredDiagnosis?: string;
    differentialDiagnoses?: string;
    approve?: boolean;
    decision?: 'hold' | 'approve_and_escalate' | 'approve_finalize' | 'approve';
    selectedUserMessageId?: string | null;
    selectedAssistantMessageId?: string | null;
    requestedReviewMessageId?: string | null;
    specialtyId?: string | null;
  },
): Promise<unknown> {
  try {
    const { data } = await http.put(
      `/api/lecturer/classes/${classId}/questions/${questionId}/respond`,
      body,
      { clearSessionOn401: false },
    );
    return data;
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
      throw new Error(WORKFLOW_CONFLICT);
    }
    throw new Error(getApiErrorMessage(e));
  }
}

export const TRIAGE_ALREADY_ESCALATED = 'TRIAGE_ALREADY_ESCALATED';

/**
 * Quick-approve an existing AI answer (marks it Approved without editing).
 * Uses the existing respond endpoint with approve=true and existing answer text.
 */
export async function approveAnswer(
  classId: string,
  questionId: string,
  existingAnswerText: string,
): Promise<void> {
  try {
    await http.put(
      `/api/lecturer/classes/${classId}/questions/${questionId}/respond`,
      {
        answerText: existingAnswerText,
        approve: true,
      },
      { clearSessionOn401: false },
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function escalateToExpert(answerId: string): Promise<void> {
  const id = encodeURIComponent(answerId);
  try {
    await http.post(`/api/lecturer/triage/${id}/escalate`, undefined, { clearSessionOn401: false });
    return;
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 412)) {
      throw new Error(WORKFLOW_CONFLICT);
    }
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      throw new Error(TRIAGE_ALREADY_ESCALATED);
    }
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      try {
        await http.put(`/api/lecturer/reviews/${id}/escalate`, undefined, {
          clearSessionOn401: false,
        });
        return;
      } catch (e2) {
        throw new Error(getApiErrorMessage(e2));
      }
    }
    throw new Error(getApiErrorMessage(e));
  }
}

function normalizeTriageRow(row: unknown): LecturerTriageRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = String(r.answerId ?? r.AnswerId ?? r.questionId ?? r.QuestionId ?? '');
  if (!id) return null;

  const qsRaw = r.questionSource ?? r.QuestionSource ?? r.triageSource ?? r.TriageSource;
  const qs = String(qsRaw ?? '').trim();
  let questionSource: LecturerTriageRow['questionSource'] = null;
  if (/visualqa/i.test(qs)) questionSource = 'VisualQA';
  else if (/caseqa/i.test(qs)) questionSource = 'CaseQA';

  const caseIdRaw = r.caseId ?? r.CaseId;
  const caseId =
    caseIdRaw != null && String(caseIdRaw).trim() !== '' ? String(caseIdRaw).trim() : null;

  /** BE: `caseId === null` ⇒ personal/ad-hoc upload (not a catalog case chat). */
  const requestKind: LecturerTriageRequestKind =
    caseId === null ? 'adhoc-upload' : 'case-catalog';

  const caseTags = parseTriageCaseTags(r);

  return {
    id,
    studentName: String(r.studentName ?? r.StudentName ?? ''),
    questionSnippet: String(
      r.questionText ?? r.QuestionText ?? r.questionSnippet ?? r.question ?? '',
    ),
    thumbnailUrl: String(
      r.thumbnailUrl ?? r.ThumbnailUrl ?? r.caseThumbnailUrl ?? r.imageUrl ?? '',
    ),
    askedAt: String(r.askedAt ?? r.AskedAt ?? r.createdAt ?? r.questionCreatedAt ?? ''),
    similarityScore: Number(r.aiConfidenceScore ?? r.AiConfidenceScore ?? r.similarityScore ?? 0),
    escalated: !!(r.isEscalated ?? r.IsEscalated ?? (r.status === 'Escalated' ? true : false)),
    questionSource,
    caseId,
    caseTitle: String(r.caseTitle ?? r.CaseTitle ?? '').trim() || null,
    caseDescription: String(r.caseDescription ?? r.CaseDescription ?? '').trim() || null,
    caseTags: caseTags.length > 0 ? caseTags : undefined,
    requestKind,
  };
}
