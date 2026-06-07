import type { VisualQaSessionReport, VisualQaTurn } from '@/lib/api/types';
import { looksLikeAiStructuredLeak } from '@/lib/student/educator-feedback';
import { formatReviewFeedbackDisplay } from '@/lib/student/visual-qa-feedback';
import { normalizeWorkflowStatus } from '@/lib/visual-qa-workflow';

export type ExpertSupportUiState =
  | { phase: 'awaiting' }
  | { phase: 'resolved'; tone: 'success' | 'danger'; message: string };

/** BE đôi khi gán nhầm mã phân loại (intent) vào field lý do — không hiển thị cho user. */
const INTERNAL_REASON_PLACEHOLDERS = new Set(['medical_intent']);

function isInternalReasonToken(text: string | null | undefined): boolean {
  const t = text?.trim().toLowerCase() ?? '';
  return !t || INTERNAL_REASON_PLACEHOLDERS.has(t);
}

/** Chọn chuỗi đầu tiên có thể đọc được; bỏ qua token kỹ thuật. */
function pickDisplayReason(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const t = c?.trim() ?? '';
    if (t && !isInternalReasonToken(t)) return t;
  }
  return '';
}

function normalizeResponseKindRaw(kind?: string | null): string {
  return kind?.trim().toLowerCase() ?? '';
}

/** Matches triage / thread workflow: waiting on lecturer or expert (not terminal). */
function workflowIndicatesAwaitingExpert(raw: string | null | undefined): boolean {
  if (!String(raw ?? '').trim()) return false;
  const n = normalizeWorkflowStatus(raw);
  return n === 'PendingExpertReview' || n === 'EscalatedToExpert';
}

function turnIndicatesAwaitingExpert(turn: VisualQaTurn): boolean {
  if (workflowIndicatesAwaitingExpert(turn.reviewState)) return true;
  if (workflowIndicatesAwaitingExpert(turn.answerStatus)) return true;
  const reviewState = (turn.reviewState ?? '').trim().toLowerCase();
  return (
    reviewState === 'submitted' ||
    reviewState === 'awaiting_review' ||
    reviewState === 'pending_review'
  );
}

function resolveReviewUpdateTarget(reviewTurn: VisualQaTurn, sortedTurns: VisualQaTurn[]): VisualQaTurn | null {
  const aid = reviewTurn.reviewTargetAssistantMessageId?.trim();
  if (aid) {
    const hit = sortedTurns.find((t) => t.assistantMessageId?.trim() === aid);
    if (hit) return hit;
  }
  const tid = reviewTurn.reviewTargetTurnId?.trim();
  if (tid) {
    const hit = sortedTurns.find((t) => t.turnId?.trim() === tid);
    if (hit) return hit;
  }
  const tidx = reviewTurn.reviewTargetTurnIndex;
  if (typeof tidx === 'number' && Number.isFinite(tidx)) {
    const hit = sortedTurns.find((t) => t.turnIndex === tidx);
    if (hit) return hit;
  }
  const reviewIdx = sortedTurns.findIndex((t) =>
    reviewTurn.turnId && t.turnId ? t.turnId === reviewTurn.turnId : t.turnIndex === reviewTurn.turnIndex,
  );
  const start = reviewIdx >= 0 ? reviewIdx - 1 : sortedTurns.length - 1;
  for (let i = start; i >= 0; i--) {
    const t = sortedTurns[i];
    const rk = normalizeResponseKindRaw(t.responseKind);
    if (rk === 'review_update' || rk === 'system_notice') continue;
    return t;
  }
  return null;
}

/** Nội dung `review_update` gắn với assistant message id (lý do reject/approve từ lecturer). */
export function collectReviewFeedbackByAssistantId(turns: VisualQaTurn[]): Map<string, string> {
  const sorted = [...turns].sort((a, b) => a.turnIndex - b.turnIndex);
  const map = new Map<string, string>();
  for (const t of sorted) {
    if (normalizeResponseKindRaw(t.responseKind) !== 'review_update') continue;
    const target = resolveReviewUpdateTarget(t, sorted);
    if (!target) continue;
    const text = t.answerText?.trim() ?? '';
    if (!text || isInternalReasonToken(text) || looksLikeAiStructuredLeak(text)) continue;
    const id = target.assistantMessageId?.trim();
    if (!id) continue;
    map.set(id, text);
  }
  return map;
}

/** Khôi phục trạng thái expert/lecturer từ GET session (ổn định sau F5 khi có đủ DTO từ BE). */
export function buildExpertSupportMapFromSession(session: VisualQaSessionReport): Record<string, ExpertSupportUiState> {
  const sorted = [...(session.turns ?? [])].sort((a, b) => a.turnIndex - b.turnIndex);
  const feedbackByAssistant = collectReviewFeedbackByAssistantId(sorted);
  const out: Record<string, ExpertSupportUiState> = {};

  const st = (session.sessionStatus ?? session.status ?? '').toLowerCase();
  const sessionReviewLc = (session.reviewState ?? '').toLowerCase();
  const sessionPolicy = pickDisplayReason(
    formatReviewFeedbackDisplay(session.reviewFeedback),
    session.rejectionReason,
    session.policyReason,
  );

  for (const turn of sorted) {
    const aid = turn.assistantMessageId?.trim();
    if (!aid) continue;

    const rs = (turn.reviewState ?? '').toLowerCase();
    const inlineFeedback = feedbackByAssistant.get(aid);

    if (turnIndicatesAwaitingExpert(turn)) {
      out[aid] = { phase: 'awaiting' };
      continue;
    }

    if (rs === 'rejected') {
      const msg =
        pickDisplayReason(inlineFeedback, turn.policyReason, sessionPolicy) ||
        'This request was rejected.';
      out[aid] = {
        phase: 'resolved',
        tone: 'danger',
        message: msg,
      };
      continue;
    }

    if (rs === 'reviewed' || rs === 'resolved') {
      const msg =
        pickDisplayReason(inlineFeedback, turn.policyReason, sessionPolicy) ||
        'Expert feedback has been recorded for this answer.';
      out[aid] = {
        phase: 'resolved',
        tone: 'success',
        message: msg,
      };
    }
  }

  // Áp policyReason / review_update khi đã có resolved — ưu tiên nội dung chi tiết từ review_update
  for (const [aid, cur] of Object.entries(out)) {
    const fb = feedbackByAssistant.get(aid);
    if (cur.phase === 'resolved' && fb && !isInternalReasonToken(fb)) {
      out[aid] = { ...cur, message: fb };
    }
  }

  // Per-turn only: do not broadcast session-level awaiting/rejected to every turn.
  for (const turn of sorted) {
    const aid = turn.assistantMessageId?.trim();
    if (!aid || out[aid]) continue;

    if (turn.isReviewTarget === true && turnIndicatesAwaitingExpert(turn)) {
      out[aid] = { phase: 'awaiting' };
      continue;
    }

    if (turn.isReviewTarget === true && (st.includes('reject') || sessionReviewLc === 'rejected')) {
      out[aid] = {
        phase: 'resolved',
        tone: 'danger',
        message:
          pickDisplayReason(feedbackByAssistant.get(aid), sessionPolicy, turn.policyReason) ||
          'This request was rejected.',
      };
    }
  }

  return out;
}
