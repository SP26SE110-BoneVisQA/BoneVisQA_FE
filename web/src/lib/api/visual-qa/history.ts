import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
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
  return normalizePersonalHistoryList(data);
}
