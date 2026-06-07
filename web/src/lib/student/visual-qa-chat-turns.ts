import type { VisualQaTurn } from '@/lib/api/types';

/** Stable identity for de-duping / merging turns (server id → client request id → turn index). */
export function turnIdentity(turn: VisualQaTurn): string {
  if (turn.turnId?.trim()) return `turn:${turn.turnId.trim()}`;
  if (turn.clientRequestId?.trim()) return `request:${turn.clientRequestId.trim()}`;
  if (typeof turn.turnIndex === 'number' && Number.isFinite(turn.turnIndex)) return `index:${turn.turnIndex}`;
  return `fallback:${turn.createdAt ?? ''}:${turn.answerText ?? ''}`;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function mergeTurnArrays(base: string[] | undefined, incoming: string[] | undefined): string[] {
  const merged = dedupeStrings([...(base ?? []), ...(incoming ?? [])]);
  return merged;
}

function mergeCitations(base: VisualQaTurn['citations'], incoming: VisualQaTurn['citations']): VisualQaTurn['citations'] {
  const seen = new Set<string>();
  const out = [...(base ?? []), ...(incoming ?? [])].filter((citation) => {
    const key = [
      citation.chunkId ?? '',
      citation.documentId ?? '',
      citation.caseId ?? '',
      citation.documentUrl ?? '',
      citation.href ?? '',
      citation.title ?? '',
      citation.snippet ?? '',
      citation.pageLabel ?? '',
    ]
      .join('::')
      .toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return out;
}

function turnHasServerAnswer(turn: VisualQaTurn): boolean {
  if (turn.turnId?.trim()) return true;
  if (turn.assistantMessageId?.trim()) return true;
  if (turn.answerText?.trim()) return true;
  if (turn.diagnosis?.trim()) return true;
  if (turn.structuredDiagnosis?.trim()) return true;
  if (turn.findings?.some((item) => item?.trim())) return true;
  return false;
}

function mergeTurn(existing: VisualQaTurn, incoming: VisualQaTurn): VisualQaTurn {
  const resolvedAwaitingAssistant =
    incoming.awaitingAssistant ??
    (turnHasServerAnswer(incoming) ? false : existing.awaitingAssistant);

  return {
    ...existing,
    ...incoming,
    turnId: incoming.turnId?.trim() || existing.turnId,
    questionText: incoming.questionText?.trim() || existing.questionText,
    answerText: incoming.answerText?.trim() || existing.answerText,
    messages: (incoming.messages?.length ?? 0) > 0 ? incoming.messages : existing.messages,
    questionCoordinates: incoming.questionCoordinates ?? existing.questionCoordinates,
    roiBoundingBox: incoming.roiBoundingBox ?? existing.roiBoundingBox,
    expertCorrectedRoiBoundingBox:
      incoming.expertCorrectedRoiBoundingBox ?? existing.expertCorrectedRoiBoundingBox,
    structuredDiagnosis: incoming.structuredDiagnosis?.trim() || existing.structuredDiagnosis,
    keyImagingFindings: incoming.keyImagingFindings?.trim() || existing.keyImagingFindings,
    diagnosis: incoming.diagnosis?.trim() || existing.diagnosis,
    findings:
      (incoming.findings?.length ?? 0) > 0
        ? mergeTurnArrays(existing.findings, incoming.findings)
        : existing.findings ?? [],
    reflectiveQuestions:
      (incoming.reflectiveQuestions?.length ?? 0) > 0
        ? mergeTurnArrays(existing.reflectiveQuestions, incoming.reflectiveQuestions)
        : existing.reflectiveQuestions ?? [],
    differentialDiagnoses:
      (incoming.differentialDiagnoses?.length ?? 0) > 0
        ? mergeTurnArrays(existing.differentialDiagnoses, incoming.differentialDiagnoses)
        : existing.differentialDiagnoses ?? [],
    citations:
      (incoming.citations?.length ?? 0) > 0
        ? mergeCitations(existing.citations, incoming.citations)
        : existing.citations ?? [],
    aiConfidenceScore: incoming.aiConfidenceScore ?? existing.aiConfidenceScore,
    createdAt: incoming.createdAt ?? existing.createdAt,
    responseKind: incoming.responseKind ?? existing.responseKind,
    clientRequestId: incoming.clientRequestId ?? existing.clientRequestId,
    userMessageId: incoming.userMessageId ?? existing.userMessageId,
    assistantMessageId: incoming.assistantMessageId ?? existing.assistantMessageId,
    reviewState: incoming.reviewState ?? existing.reviewState,
    answerStatus: incoming.answerStatus ?? existing.answerStatus,
    lastResponderRole: incoming.lastResponderRole ?? existing.lastResponderRole,
    actorRole: incoming.actorRole ?? existing.actorRole,
    isReviewTarget: incoming.isReviewTarget ?? existing.isReviewTarget,
    reviewTargetAssistantMessageId:
      incoming.reviewTargetAssistantMessageId ?? existing.reviewTargetAssistantMessageId,
    reviewTargetTurnId: incoming.reviewTargetTurnId ?? existing.reviewTargetTurnId,
    reviewTargetTurnIndex: incoming.reviewTargetTurnIndex ?? existing.reviewTargetTurnIndex,
    policyReason: incoming.policyReason ?? existing.policyReason,
    systemNoticeCode: incoming.systemNoticeCode ?? existing.systemNoticeCode,
    awaitingAssistant: resolvedAwaitingAssistant,
  };
}

function compareTurnsByTimeline(a: VisualQaTurn, b: VisualQaTurn): number {
  if (a.turnIndex !== b.turnIndex) return a.turnIndex - b.turnIndex;
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

function isSortedByTimeline(turns: VisualQaTurn[]): boolean {
  for (let i = 1; i < turns.length; i += 1) {
    if (compareTurnsByTimeline(turns[i - 1], turns[i]) > 0) return false;
  }
  return true;
}

function ensureTimelineOrder(turns: VisualQaTurn[]): VisualQaTurn[] {
  if (turns.length <= 1 || isSortedByTimeline(turns)) return turns;
  return [...turns].sort(compareTurnsByTimeline);
}

function collapseTurnWindow(window: VisualQaTurn[]): VisualQaTurn {
  if (window.length === 1) return window[0];
  const ranked = [...window].sort((a, b) => turnRichnessScore(a) - turnRichnessScore(b));
  return ranked.reduce((acc, turn) => mergeTurn(acc, turn));
}

function windowEndByTurnIndex(turns: VisualQaTurn[], start: number): number {
  let end = start + 1;
  const turnIndex = turns[start]?.turnIndex;
  while (end < turns.length && turns[end].turnIndex === turnIndex) {
    end += 1;
  }
  return end;
}

/**
 * Merge 2 dãy đã sắp theo `turnIndex` bằng two-pointers để tránh quét lồng nhau.
 * Các turn trùng `turnIndex` sẽ được gom thành một "window" rồi hợp nhất một lần.
 */
export function mergeTurnsByIdentity(base: VisualQaTurn[], incoming: VisualQaTurn[]): VisualQaTurn[] {
  const left = ensureTimelineOrder(base);
  const right = ensureTimelineOrder(incoming);
  const merged: VisualQaTurn[] = [];

  let leftIdx = 0;
  let rightIdx = 0;

  while (leftIdx < left.length || rightIdx < right.length) {
    if (leftIdx >= left.length) {
      const nextRightIdx = windowEndByTurnIndex(right, rightIdx);
      merged.push(collapseTurnWindow(right.slice(rightIdx, nextRightIdx)));
      rightIdx = nextRightIdx;
      continue;
    }

    if (rightIdx >= right.length) {
      const nextLeftIdx = windowEndByTurnIndex(left, leftIdx);
      merged.push(collapseTurnWindow(left.slice(leftIdx, nextLeftIdx)));
      leftIdx = nextLeftIdx;
      continue;
    }

    const leftTurnIndex = left[leftIdx].turnIndex;
    const rightTurnIndex = right[rightIdx].turnIndex;

    if (leftTurnIndex < rightTurnIndex) {
      const nextLeftIdx = windowEndByTurnIndex(left, leftIdx);
      merged.push(collapseTurnWindow(left.slice(leftIdx, nextLeftIdx)));
      leftIdx = nextLeftIdx;
      continue;
    }

    if (rightTurnIndex < leftTurnIndex) {
      const nextRightIdx = windowEndByTurnIndex(right, rightIdx);
      merged.push(collapseTurnWindow(right.slice(rightIdx, nextRightIdx)));
      rightIdx = nextRightIdx;
      continue;
    }

    const nextLeftIdx = windowEndByTurnIndex(left, leftIdx);
    const nextRightIdx = windowEndByTurnIndex(right, rightIdx);
    merged.push(collapseTurnWindow([...left.slice(leftIdx, nextLeftIdx), ...right.slice(rightIdx, nextRightIdx)]));
    leftIdx = nextLeftIdx;
    rightIdx = nextRightIdx;
  }

  return merged;
}

/** Remove a client-only optimistic row (matched by clientRequestId + awaitingAssistant). */
export function removeOptimisticTurnByClientRequestId(turns: VisualQaTurn[], clientRequestId: string): VisualQaTurn[] {
  const id = clientRequestId.trim();
  return turns.filter((t) => !(t.clientRequestId === id && t.awaitingAssistant === true));
}

/**
 * Optimistic Visual QA turn: student question is visible immediately; assistant side waits for BE.
 * Replaced automatically when merge brings a server turn with the same `clientRequestId`.
 */
function turnRichnessScore(t: VisualQaTurn): number {
  let s = 0;
  if (t.turnId?.trim()) s += 10_000;
  if (!t.awaitingAssistant) s += 1_000;
  const body = `${t.answerText ?? ''}${t.diagnosis ?? ''}`.trim();
  s += Math.min(body.length, 50_000);
  s += (t.citations?.length ?? 0) * 100;
  return s;
}

/**
 * BE đôi khi trả về cùng một `turnIndex` hai lần: hàng optimistic (`request:…`) và hàng server (`turn:…`)
 * không trùng identity → merge không gộp được. Giữ một dòng (ưu tiên bản có turnId / đã có trả lời).
 */
export function dedupeTurnsSameIndexPreferServer(turns: VisualQaTurn[]): VisualQaTurn[] {
  const ordered = ensureTimelineOrder(turns);
  const out: VisualQaTurn[] = [];
  let start = 0;
  while (start < ordered.length) {
    const end = windowEndByTurnIndex(ordered, start);
    out.push(collapseTurnWindow(ordered.slice(start, end)));
    start = end;
  }
  return out;
}

export function appendOptimisticQuestionTurn(
  base: VisualQaTurn[],
  question: string,
  clientRequestId: string,
): VisualQaTurn[] {
  const nextIndex = (base[base.length - 1]?.turnIndex ?? 0) + 1;
  const optimistic: VisualQaTurn = {
    turnIndex: nextIndex,
    turnId: null,
    questionText: question,
    clientRequestId,
    awaitingAssistant: true,
    answerText: '',
    diagnosis: '',
    findings: [],
    reflectiveQuestions: [],
    differentialDiagnoses: [],
    citations: [],
    createdAt: new Date().toISOString(),
    responseKind: 'analysis',
    actorRole: 'assistant',
    lastResponderRole: 'assistant',
    isReviewTarget: false,
  };
  return mergeTurnsByIdentity(base, [optimistic]);
}
