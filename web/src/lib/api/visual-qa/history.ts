import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
import { normalizeVisualQaStudyMode } from '@/lib/student/visual-qa-study-mode';
import type {
  VisualQaThreadResponse,
  VisualQaHistoryListParams,
  VisualQaSessionHistoryItem,
  VisualQaPersonalHistoryResult,
} from '@/lib/api/visual-qa/types';
import { unwrapVisualQaPayload } from '@/lib/api/visual-qa/unwrap';

/**
 * Reload full thread — `GET /api/student/visual-qa/history/{sessionId}`.
 * @see FRONTEND_HANDOFF_REPORT §2.6
 */
export async function fetchVisualQaThread(sessionId: string): Promise<VisualQaThreadResponse> {
  const id = sessionId.trim();
  if (!id) throw new Error('sessionId is required.');

  try {
    const { data } = await http.get<unknown>(
      `/api/student/visual-qa/history/${encodeURIComponent(id)}`,
      { skipApiToast: true },
    );
    const payload = unwrapVisualQaPayload(data);
    return normalizeVisualQaSessionReport(payload);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw e;
    }
    throw new Error(getApiErrorMessage(e));
  }
}

/** Optional list endpoints (resume from history UI). */
export async function fetchVisualQaCaseHistory(
  params: VisualQaHistoryListParams = {},
): Promise<unknown> {
  const { data } = await http.get<unknown>('/api/student/visual-qa/history/cases', {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    },
  });
  return unwrapVisualQaPayload(data);
}

function normalizeHistoryItem(raw: unknown): VisualQaSessionHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pick = (keys: string[]) => {
    for (const k of keys) {
      if (k in o && o[k] !== undefined) return o[k];
    }
    return undefined;
  };
  const sessionId = String(pick(['sessionId', 'SessionId']) ?? '').trim();
  if (!sessionId) return null;
  const status = String(pick(['status', 'Status']) ?? '').trim() || 'Active';
  const sessionStatus =
    String(pick(['sessionStatus', 'SessionStatus', 'status', 'Status']) ?? '').trim() || status;
  const imageUrlRaw = pick(['imageUrl', 'ImageUrl', 'thumbnailUrl', 'thumbnail_url']);
  const imageUrl =
    typeof imageUrlRaw === 'string' && imageUrlRaw.trim() ? imageUrlRaw.trim() : null;
  const questionSnippetRaw = pick(['questionSnippet', 'QuestionSnippet', 'lastQuestionAsked']);
  const questionSnippet =
    typeof questionSnippetRaw === 'string' && questionSnippetRaw.trim()
      ? questionSnippetRaw.trim()
      : null;
  const updatedAtRaw = pick(['updatedAt', 'UpdatedAt', 'updated_at']);
  const updatedAt =
    typeof updatedAtRaw === 'string' && updatedAtRaw.trim() ? updatedAtRaw.trim() : null;
  const caseIdRaw = pick(['caseId', 'CaseId']);
  const caseId = typeof caseIdRaw === 'string' && caseIdRaw.trim() ? caseIdRaw.trim() : null;
  const reviewStateRaw = pick(['reviewState', 'ReviewState']);
  const reviewState =
    typeof reviewStateRaw === 'string' && reviewStateRaw.trim() ? reviewStateRaw.trim() : null;
  const lastResponderRoleRaw = pick(['lastResponderRole', 'LastResponderRole']);
  const lastResponderRole =
    typeof lastResponderRoleRaw === 'string' && lastResponderRoleRaw.trim()
      ? lastResponderRoleRaw.trim()
      : null;
  const rejectionReasonRaw = pick(['rejectionReason', 'RejectionReason']);
  const rejectionReason =
    typeof rejectionReasonRaw === 'string' && rejectionReasonRaw.trim()
      ? rejectionReasonRaw.trim()
      : null;
  const studyModeRaw = pick(['studyMode', 'StudyMode', 'study_mode', 'sessionFlow', 'flow']);
  const studyMode = normalizeVisualQaStudyMode(studyModeRaw) ?? undefined;

  return {
    sessionId,
    caseId,
    status,
    sessionStatus,
    updatedAt,
    questionSnippet,
    imageUrl,
    reviewState,
    lastResponderRole,
    rejectionReason,
    studyMode,
  };
}

function normalizePersonalHistoryList(raw: unknown): VisualQaPersonalHistoryResult {
  const payload = unwrapVisualQaPayload(raw);
  const root =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const itemsRaw = root.items ?? root.Items ?? root.data ?? [];
  const items = Array.isArray(itemsRaw)
    ? itemsRaw
        .map(normalizeHistoryItem)
        .filter((row): row is VisualQaSessionHistoryItem => row !== null)
    : [];
  const totalRaw = root.totalCount ?? root.TotalCount ?? root.total ?? items.length;
  const totalCount = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw) || items.length;
  return { totalCount, items };
}

export async function fetchVisualQaPersonalHistory(
  params: VisualQaHistoryListParams = {},
): Promise<VisualQaPersonalHistoryResult> {
  const { data } = await http.get<unknown>('/api/student/visual-qa/history/personal', {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    },
    skipApiToast: true,
  });
  const result = normalizePersonalHistoryList(data);
  return {
    ...result,
    items: result.items.map((row) => ({
      ...row,
      studyMode: row.studyMode ?? 'personal_dicom',
    })),
  };
}

function normalizeCaseHistoryList(raw: unknown): VisualQaPersonalHistoryResult {
  const result = normalizePersonalHistoryList(raw);
  return {
    ...result,
    items: result.items.map((row) => ({
      ...row,
      studyMode: row.studyMode ?? 'catalog_case_study',
    })),
  };
}

export async function fetchVisualQaCaseHistoryNormalized(
  params: VisualQaHistoryListParams = {},
): Promise<VisualQaPersonalHistoryResult> {
  const { data } = await http.get<unknown>('/api/student/visual-qa/history/cases', {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    },
    skipApiToast: true,
  });
  return normalizeCaseHistoryList(data);
}

/** Merges personal DICOM sessions and catalog case-study sessions for workspace sidebar. */
export async function fetchVisualQaCombinedHistory(
  params: VisualQaHistoryListParams = {},
): Promise<VisualQaSessionHistoryItem[]> {
  const [personal, catalog] = await Promise.all([
    fetchVisualQaPersonalHistory(params),
    fetchVisualQaCaseHistoryNormalized(params),
  ]);
  const bySession = new Map<string, VisualQaSessionHistoryItem>();
  for (const row of [...personal.items, ...catalog.items]) {
    const sid = row.sessionId.trim();
    if (!sid) continue;
    const existing = bySession.get(sid);
    if (!existing) {
      bySession.set(sid, row);
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt ?? '') || 0;
    const rowTime = Date.parse(row.updatedAt ?? '') || 0;
    if (rowTime >= existingTime) bySession.set(sid, { ...existing, ...row });
  }
  return Array.from(bySession.values()).sort((a, b) => {
    const ta = Date.parse(a.updatedAt ?? '') || 0;
    const tb = Date.parse(b.updatedAt ?? '') || 0;
    return tb - ta;
  });
}
