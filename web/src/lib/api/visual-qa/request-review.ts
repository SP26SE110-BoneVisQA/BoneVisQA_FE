import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
import type { VisualQaSessionReport } from '@/lib/api/types';
import { unwrapVisualQaPayload } from '@/lib/api/visual-qa/unwrap';

/**
 * Request lecturer triage for an assistant turn.
 * `turnId` should be `assistantMessageId` when available; BE resolves paired user turns.
 */
export async function requestVisualQaReview(
  sessionId: string,
  turnId: string,
): Promise<VisualQaSessionReport> {
  const sid = sessionId.trim();
  const tid = turnId.trim();
  if (!sid) throw new Error('sessionId is required.');
  if (!tid) throw new Error('turnId is required.');

  try {
    const { data } = await http.post<unknown>(
      `/api/student/visual-qa/turns/${encodeURIComponent(tid)}/request-review`,
      null,
      { params: { sessionId: sid }, clearSessionOn401: false },
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
