import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
import type { VisualQaThreadResponse, VisualQaHistoryListParams } from '@/lib/api/visual-qa/types';
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

export async function fetchVisualQaPersonalHistory(
  params: VisualQaHistoryListParams = {},
): Promise<unknown> {
  const { data } = await http.get<unknown>('/api/student/visual-qa/history/personal', {
    params: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    },
  });
  return unwrapVisualQaPayload(data);
}
