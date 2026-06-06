'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { AlertTriangle, ArrowDown, Loader2 } from 'lucide-react';
import { AiMessageBubble } from '@/components/student/AiMessageBubble';
import { mergeDiagnosisForDisplay } from '@/components/student/VisualQaRichAnswer';
import { ChatErrorBoundary } from '@/components/student/ChatErrorBoundary';
import { StudentMessageBubble } from '@/components/student/StudentMessageBubble';
import { VISUAL_QA_MESSAGE_IN } from '@/components/student/visualQaMessageClasses';
import type { ExpertSupportInline } from '@/components/student/AiMessageBubble';
import type { WorkspaceAnswerVariant } from '@/features/visual-qa/components/WorkspaceStructuredAnswer';
import type { VisualQaSessionReport, VisualQaTurn } from '@/lib/api/types';
import {
  extractEducatorFeedbackForTurn,
  looksLikeAiStructuredLeak,
  shouldShowEducatorFeedback,
  type EducatorFeedbackEntry,
} from '@/lib/student/educator-feedback';
import { formatReviewFeedbackDisplay } from '@/lib/student/visual-qa-feedback';

type OptimisticMessage = {
  id: string;
  content: string;
  status?: 'sending' | 'sent' | 'failed';
};

type Props = {
  messages: VisualQaTurn[];
  capabilities?: VisualQaSessionReport['capabilities'];
  optimisticMessages?: OptimisticMessage[];
  isLoading: boolean;
  chatRequestPhase?: 'idle' | 'upload' | 'analyzing';
  isError?: boolean;
  networkWarning?: string | null;
  errorCode?: string | null;
  policyReason?: string | null;
  systemNoticeCode?: string | null;
  blockingNotice?: string | null;
  errorMessage?: string | null;
  canRequestReview?: boolean;
  requestingExpertSupport?: boolean;
  onRequestExpertSupport?: (turn: VisualQaTurn) => void;
  onSendMessage: (message: string) => void | Promise<void>;
  onClear: () => void;
  /** Trạng thái gửi expert theo assistantMessageId — không render thành message mới. */
  expertSupportByAssistantId?: Record<
    string,
    { phase: 'awaiting' } | { phase: 'resolved'; tone: 'success' | 'danger'; message: string }
  >;
  answerVariant?: WorkspaceAnswerVariant;
};

function normalizeResponseKind(kind?: string | null): 'analysis' | 'refusal' | 'clarification' | 'review_update' | 'system_notice' {
  const normalized = kind?.trim().toLowerCase();
  if (normalized === 'refusal') return 'refusal';
  if (normalized === 'clarification') return 'clarification';
  if (normalized === 'review_update') return 'review_update';
  if (normalized === 'system_notice') return 'system_notice';
  return 'analysis';
}

type DisplayResponseKind = ReturnType<typeof normalizeResponseKind>;

function turnHasStructuredAssistantPayload(turn: VisualQaTurn): boolean {
  /** Trùng với card Diagnosis trong VisualQaStructuredAnswer — BE có thể chỉ gửi JSON trong `structuredDiagnosis`. */
  if (mergeDiagnosisForDisplay(turn.diagnosis, turn.structuredDiagnosis).trim()) return true;
  if (turn.findings?.some((item) => item?.trim())) return true;
  if (turn.differentialDiagnoses?.some((item) => item?.trim())) return true;
  if (turn.reflectiveQuestions?.some((item) => item?.trim())) return true;
  if (turn.keyImagingFindings?.trim()) return true;
  return false;
}

function coerceDisplayResponseKind(turn: VisualQaTurn, base: DisplayResponseKind): DisplayResponseKind {
  if (base === 'system_notice' || base === 'review_update') return base;
  if (base === 'clarification' && turnHasStructuredAssistantPayload(turn)) return 'analysis';
  return base;
}

function normalizeResponseKindRaw(kind?: string | null): string {
  return kind?.trim().toLowerCase() ?? '';
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

function buildReviewFeedbackMap(messages: VisualQaTurn[]): Map<string, string> {
  const sorted = [...messages].sort((a, b) => a.turnIndex - b.turnIndex);
  const map = new Map<string, string>();
  for (const t of sorted) {
    if (normalizeResponseKindRaw(t.responseKind) !== 'review_update') continue;
    const target = resolveReviewUpdateTarget(t, sorted);
    if (!target) continue;
    const text = t.answerText?.trim() ?? '';
    if (!text || looksLikeAiStructuredLeak(text)) continue;
    const formatted = formatReviewFeedbackDisplay(text);
    if (!formatted || looksLikeAiStructuredLeak(formatted)) continue;
    const key = target.turnId ?? String(target.turnIndex);
    map.set(key, formatted);
  }
  return map;
}

/** Maps BE system notice codes to English; unknown technical codes are hidden (no raw SCREAMING_SNAKE in UI). */
function formatSystemNoticeCodeLabel(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const map: Record<string, string> = {
    SESSION_READ_ONLY: 'Session is in read-only mode per system policy.',
    SESSION_LOCKED: 'Session is locked.',
    SESSION_EXPIRED: 'Session has expired.',
    TURN_LIMIT_EXCEEDED: 'Question limit exceeded for this Visual QA session.',
    MISSING_IMAGE: 'Image is missing.',
    MISSING_QUESTION: 'Question content is missing.',
    AI_SERVICE_UNAVAILABLE: 'AI service is temporarily unavailable.',
    AI_RESPONSE_INVALID_FORMAT: 'AI response format is invalid.',
    INTERNAL_SERVER_ERROR: 'Server-side processing error.',
  };
  return map[c] ?? null;
}

function formatTurnTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const sameCalendarDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameCalendarDay) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function GlobalAnalysisLoadingCard() {
  return (
    <div
      className="min-w-[min(300px,74vw)] rounded-[1.4rem] border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgb(15,23,42,0.06)]"
      aria-hidden
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        AI is analyzing the image and knowledge base...
      </p>
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-2.5 w-24 rounded-full bg-slate-200" />
        <div className="h-2.5 w-full rounded-full bg-slate-200" />
        <div className="h-2.5 w-5/6 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

export function ChatConversation({
  messages,
  capabilities,
  optimisticMessages = [],
  isLoading,
  chatRequestPhase = 'idle',
  isError = false,
  networkWarning,
  errorCode,
  systemNoticeCode,
  blockingNotice,
  errorMessage,
  canRequestReview = false,
  requestingExpertSupport = false,
  onRequestExpertSupport,
  onSendMessage,
  onClear,
  expertSupportByAssistantId = {},
  answerVariant = 'full',
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeAiMenuKey, setActiveAiMenuKey] = useState<string | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const hasInlineAwaitingAssistant = messages.some((m) => m.awaitingAssistant === true);
  const showGlobalTyping =
    isLoading && chatRequestPhase === 'analyzing' && !hasInlineAwaitingAssistant;

  const reviewFeedbackByTargetKey = useMemo(() => buildReviewFeedbackMap(messages), [messages]);

  const renderedTurns = useMemo(() => {
    const blockingLower = blockingNotice?.trim().toLowerCase() ?? '';
    const mapped = messages.map((turn) => {
      const normalizedMessages = (turn.messages ?? [])
        .filter((message) => message.content?.trim())
        .map((message, idx) => ({
          id: `${turn.turnIndex}-m-${idx}`,
          role: (message.role ?? '').toLowerCase(),
          content: message.content.trim(),
        }));
      return {
        turn,
        normalizedMessages,
        studentMessage:
          normalizedMessages.find((message) => message.role === 'student' || message.role === 'user')?.content ??
          turn.questionText?.trim() ??
          '',
        assistantText:
          turn.answerText?.trim() ||
          turn.diagnosis?.trim() ||
          turn.findings?.find((item) => item.trim()) ||
          '',
        responseKind: coerceDisplayResponseKind(turn, normalizeResponseKind(turn.responseKind)),
        policyReason: turn.policyReason?.trim() ?? '',
        systemNoticeCode: turn.systemNoticeCode?.trim() ?? '',
        reviewerNotes: normalizedMessages.filter(
          (message) => message.role === 'lecturer' || message.role === 'expert',
        ),
      };
    });

    const withoutBlockingDupes = mapped.filter((row) => {
      if (row.responseKind !== 'system_notice' || !blockingLower) return true;
      const body = row.assistantText.trim().toLowerCase();
      if (!body) return true;
      if (body === blockingLower) return false;
      if (blockingLower.includes('read-only') && body.includes('read-only')) return false;
      if (blockingLower.includes('review') && body.includes('review workflow')) return false;
      return true;
    });

    const seenSystemNotice = new Set<string>();
    const dedupedRows = withoutBlockingDupes.filter((row) => {
      if (row.responseKind !== 'system_notice') return true;
      const fingerprint = `${row.turn.turnId ?? row.turn.turnIndex}:${row.assistantText.trim().toLowerCase()}`;
      if (seenSystemNotice.has(fingerprint)) return false;
      seenSystemNotice.add(fingerprint);
      return true;
    });
    const withoutReviewUpdates = dedupedRows.filter((row) => row.responseKind !== 'review_update');
    return withoutReviewUpdates.map((row, idx) => ({
      ...row,
      sequenceNo: idx + 1,
    }));
  }, [messages, blockingNotice]);

  const isRestoring = isLoading && messages.length === 0 && optimisticMessages.length === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isPinnedToBottom) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [renderedTurns, optimisticMessages, isLoading, chatRequestPhase, networkWarning, isError, isPinnedToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsPinnedToBottom(distanceFromBottom < 96);
  };

  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsPinnedToBottom(true);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="app-scroll-y min-h-0 min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-4 py-4 md:px-5"
    >
      <ChatErrorBoundary onReset={onClear}>
        {networkWarning ? (
          <div className="mb-4 rounded-[1.25rem] border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
              <p className="font-medium text-contrast-outline-soft">{networkWarning}</p>
            </div>
          </div>
        ) : null}

        {blockingNotice?.trim() ? (
          <div className="mb-4 rounded-[1.25rem] border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-950 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" aria-hidden />
              <p className="font-medium text-contrast-outline-soft">{blockingNotice.trim()}</p>
            </div>
          </div>
        ) : null}

        {isRestoring ? (
          <div
            className="flex min-h-[28vh] w-full flex-col items-center justify-center gap-2 py-12"
            aria-busy="true"
            aria-label="Loading messages"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <span className="text-xs font-medium text-muted-foreground">Loading conversation…</span>
          </div>
        ) : renderedTurns.length === 0 && optimisticMessages.length === 0 && !isLoading && !hasInlineAwaitingAssistant ? (
          <div className="medical-bento-card flex min-h-[45vh] w-full flex-col items-center justify-center border-dashed bg-white/80 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {answerVariant === 'catalog'
                ? 'Ask a question about this teaching case. Follow-up questions are welcome.'
                : 'Add an image for the first turn, then ask the AI. New replies stay anchored unless you scroll up.'}
            </p>
          </div>
        ) : (
          <LayoutGroup>
            <div className="space-y-6">
              <div className="space-y-5">
                {renderedTurns.map(
                  (
                    {
                      turn,
                      reviewerNotes,
                      studentMessage,
                      assistantText,
                      responseKind,
                      systemNoticeCode: turnSystemNoticeCode,
                      sequenceNo,
                    },
                    idx,
                  ) => {
                    const systemNoticeLabel = formatSystemNoticeCodeLabel(turnSystemNoticeCode);
                    const turnKey = turn.turnId ?? String(turn.turnIndex);
                    const turnMenuKey = turn.turnId ?? String(turn.turnIndex);
                    const assistantKey = turn.assistantMessageId?.trim() ?? '';
                    const rawSupport = assistantKey ? expertSupportByAssistantId[assistantKey] : undefined;
                    const inlineReviewRaw = reviewFeedbackByTargetKey.get(turnKey) ?? null;
                    const expertSupportInline: ExpertSupportInline | null =
                      rawSupport?.phase === 'awaiting'
                        ? { kind: 'awaiting' }
                        : rawSupport?.phase === 'resolved'
                          ? {
                              kind: 'resolved',
                              tone: rawSupport.tone,
                              text:
                                formatReviewFeedbackDisplay(rawSupport.message) ||
                                rawSupport.message,
                            }
                          : null;
                    const educatorFeedbackEntries: EducatorFeedbackEntry[] =
                      expertSupportInline?.kind === 'awaiting'
                        ? []
                        : extractEducatorFeedbackForTurn(
                            reviewerNotes,
                            inlineReviewRaw,
                            expertSupportInline?.kind === 'resolved'
                              ? expertSupportInline.text
                              : null,
                          );
                    const showEducatorFeedback = shouldShowEducatorFeedback(
                      expertSupportInline?.kind === 'awaiting',
                      educatorFeedbackEntries,
                    );
                    const isLastTurn = idx === renderedTurns.length - 1;
                    const deferLatestNonAnalysisWhileBusy =
                      isLoading &&
                      isLastTurn &&
                      (responseKind === 'clarification' || responseKind === 'refusal');
                    const awaitingAssistant =
                      deferLatestNonAnalysisWhileBusy ||
                      (turn.awaitingAssistant === true &&
                        !assistantText &&
                        responseKind === 'analysis');
                    return (
                  <motion.div
                    key={turn.turnId ?? turn.clientRequestId ?? `${turn.turnIndex}-${turn.createdAt ?? ''}`}
                    className="w-full rounded-xl text-left"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-center">
                        <span className="rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatTurnTimestamp(turn.createdAt) ?? `Turn #${sequenceNo}`}
                        </span>
                      </div>
                      {studentMessage ? <StudentMessageBubble content={studentMessage} /> : null}

                      <AiMessageBubble
                        turn={turn}
                        assistantText={assistantText}
                        responseKind={responseKind}
                        awaitingAssistant={awaitingAssistant}
                        chatRequestPhase={chatRequestPhase}
                        systemNoticeLabel={systemNoticeLabel}
                        educatorFeedbackEntries={showEducatorFeedback ? educatorFeedbackEntries : []}
                        canRequestReview={canRequestReview}
                        requestingExpertSupport={requestingExpertSupport}
                        activeMenuTurnKey={activeAiMenuKey}
                        turnMenuKey={turnMenuKey}
                        onToggleMenu={() =>
                          setActiveAiMenuKey((prev) => (prev === turnMenuKey ? null : turnMenuKey))
                        }
                        onRequestExpertSupport={() => {
                          setActiveAiMenuKey(null);
                          onRequestExpertSupport?.(turn);
                        }}
                        expertSupportInline={expertSupportInline}
                        answerVariant={answerVariant}
                      />
                    </div>
                  </motion.div>
                );
                })}

                <AnimatePresence initial={false}>
                  {optimisticMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={false}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      <StudentMessageBubble
                        content={message.content}
                        status={message.status}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {showGlobalTyping ? (
                  <motion.div
                    key="typing"
                    className={`flex justify-start ${VISUAL_QA_MESSAGE_IN}`}
                    initial={false}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <GlobalAnalysisLoadingCard />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </ChatErrorBoundary>
      {!isPinnedToBottom && renderedTurns.length > 0 ? (
        <div className="sticky bottom-2 z-10 flex w-full justify-center pb-2 pt-1 pointer-events-none">
          <button
            type="button"
            onClick={scrollToLatest}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.10)] transition-colors hover:bg-slate-50"
            aria-label="Scroll to latest messages"
          >
            <ArrowDown className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
