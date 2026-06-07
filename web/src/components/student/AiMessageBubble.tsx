'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, Loader2, MoreHorizontal } from 'lucide-react';
import { shouldSuppressLeakedMedicalJsonMarkdown } from '@/components/student/VisualQaRichAnswer';
import { WorkspaceStructuredAnswer, type WorkspaceAnswerVariant } from '@/features/visual-qa/components/WorkspaceStructuredAnswer';
import { WorkspaceRagSources } from '@/features/visual-qa/components/WorkspaceRagSources';
import type { Components } from 'react-markdown';
import { markdownExternalLinkComponents } from '@/components/shared/markdownExternalLinks';
import type { VisualQaTurn } from '@/lib/api/types';
import type { EducatorFeedbackEntry } from '@/lib/student/educator-feedback';
import { cn } from '@/lib/utils';
import { VISUAL_QA_MESSAGE_IN } from '@/components/student/visualQaMessageClasses';
import {
  buildAssistantMarkdownComponents,
  visualQaMdHeadingsBold,
} from '@/components/student/visualQaMarkdownComponents';

function AnalysisLoadingState({ phase }: { phase: 'upload' | 'analyzing' }) {
  if (phase === 'upload') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600" aria-busy>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
        <span>Uploading study image…</span>
      </div>
    );
  }

  return (
    <div
      className="min-w-[min(280px,70vw)] rounded-xl border border-slate-300 bg-white/90 px-3 py-3 shadow-sm"
      aria-busy
      aria-label="AI is analyzing the study"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        AI is analyzing the study...
      </p>
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-2.5 w-28 rounded-full bg-slate-200" />
        <div className="h-2.5 w-full rounded-full bg-slate-200" />
        <div className="h-2.5 w-5/6 rounded-full bg-slate-200" />
        <div className="h-2.5 w-2/3 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function hasDisplayableAnalysisContent(turn: VisualQaTurn): boolean {
  if (turn.diagnosis?.trim()) return true;
  if (turn.findings?.some((item) => item?.trim())) return true;
  if (turn.differentialDiagnoses?.some((item) => item?.trim())) return true;
  if (turn.reflectiveQuestions?.some((item) => item?.trim())) return true;
  if (turn.structuredDiagnosis?.trim()) return true;
  if (turn.keyImagingFindings?.trim()) return true;
  if ((turn.citations ?? []).length > 0) return true;
  const md = turn.answerText?.trim();
  if (md && !shouldSuppressLeakedMedicalJsonMarkdown(md)) return true;
  return false;
}

function sanitizeSystemNoticeMarkdownBody(text: string, noticeCode?: string | null): string {
  const t = text.trim();
  if (!t) return '';
  const code = noticeCode?.trim().toUpperCase();
  if (code && t.toUpperCase() === code) return '';
  if (/^[A-Z][A-Z0-9_]+$/.test(t)) return '';
  return text;
}

export type AiResponseKind =
  | 'analysis'
  | 'refusal'
  | 'clarification'
  | 'review_update'
  | 'system_notice';

export type ExpertSupportInline =
  | { kind: 'awaiting' }
  | { kind: 'resolved'; tone: 'success' | 'danger'; text: string };

function AnalysisFallbackBlock({
  markdown,
  citations,
  components,
}: {
  markdown: string;
  citations: VisualQaTurn['citations'];
  components: Components;
}) {
  return (
    <div className="space-y-2 rounded-[1.15rem] border border-amber-200 bg-amber-50/70 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
        Structured response unavailable
      </p>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown || 'The assistant returned a response, but the structured layout could not be rendered.'}
      </ReactMarkdown>
      <WorkspaceRagSources citations={citations ?? []} />
    </div>
  );
}

export type AiMessageBubbleProps = {
  turn: VisualQaTurn;
  assistantText: string;
  responseKind: AiResponseKind;
  awaitingAssistant: boolean;
  chatRequestPhase: 'idle' | 'upload' | 'analyzing';
  systemNoticeLabel: string | null;
  educatorFeedbackEntries?: EducatorFeedbackEntry[];
  canRequestReview: boolean;
  requestingExpertSupport: boolean;
  activeMenuTurnKey: string | null;
  turnMenuKey: string;
  onToggleMenu: () => void;
  onRequestExpertSupport: () => void;
  /** Trạng thái Request Expert — không tạo bubble chat riêng, chỉ dòng trạng thái gọn. */
  expertSupportInline?: ExpertSupportInline | null;
  answerVariant?: WorkspaceAnswerVariant;
};

export function AiMessageBubble({
  turn,
  assistantText,
  responseKind,
  awaitingAssistant,
  chatRequestPhase,
  systemNoticeLabel,
  educatorFeedbackEntries = [],
  canRequestReview,
  requestingExpertSupport,
  activeMenuTurnKey,
  turnMenuKey,
  onToggleMenu,
  onRequestExpertSupport,
  expertSupportInline = null,
  answerVariant = 'full',
}: AiMessageBubbleProps) {
  const showExpertMenu =
    canRequestReview &&
    expertSupportInline == null &&
    !awaitingAssistant &&
    Boolean(turn.assistantMessageId?.trim()) &&
    (turn.actorRole?.trim().toLowerCase() === 'assistant' ||
      turn.isReviewTarget === true ||
      responseKind === 'analysis');

  const safeMarkdownAssistantText = shouldSuppressLeakedMedicalJsonMarkdown(assistantText)
    ? ''
    : assistantText;

  const systemNoticeMarkdownBody =
    responseKind === 'system_notice'
      ? sanitizeSystemNoticeMarkdownBody(safeMarkdownAssistantText, turn.systemNoticeCode?.trim())
      : safeMarkdownAssistantText;

  const mdClarificationRefusal = buildAssistantMarkdownComponents(
    'mb-2 text-slate-950 last:mb-0 leading-relaxed',
  );
  const mdSystemNotice: Components = {
    ...markdownExternalLinkComponents,
    ...visualQaMdHeadingsBold,
    p: ({ children }) => (
      <p className="mb-2 font-medium leading-relaxed text-slate-900 last:mb-0">{children}</p>
    ),
  };
  const mdFallback = buildAssistantMarkdownComponents(
    'mb-2 text-slate-950 last:mb-0 leading-relaxed',
  );
  const structuredFallbackMarkdown =
    safeMarkdownAssistantText ||
    turn.structuredDiagnosis?.trim() ||
    turn.diagnosis?.trim() ||
    turn.keyImagingFindings?.trim() ||
    'The assistant returned a response.';

  const structuredAnswer = (
    <ErrorBoundary
      fallbackRender={() => (
        <AnalysisFallbackBlock
          markdown={structuredFallbackMarkdown}
          citations={turn.citations ?? []}
          components={mdFallback}
        />
      )}
    >
      <WorkspaceStructuredAnswer
        markdown={turn.answerText}
        diagnosis={turn.diagnosis}
        structuredDiagnosis={turn.structuredDiagnosis}
        findings={turn.findings}
        keyImagingFindings={turn.keyImagingFindings}
        differentialDiagnoses={turn.differentialDiagnoses}
        reflectiveQuestions={turn.reflectiveQuestions}
        citations={turn.citations ?? []}
        educatorFeedbackEntries={educatorFeedbackEntries}
        variant={answerVariant}
      />
    </ErrorBoundary>
  );

  return (
    <div className="group flex justify-start">
      <div
        className={cn(
          VISUAL_QA_MESSAGE_IN,
          'relative max-w-[min(92vw,92%)] overflow-visible break-words rounded-[1.35rem] border border-slate-200/80 bg-white/95 px-4 py-3 text-sm leading-relaxed text-slate-950 shadow-[0_8px_30px_rgb(15,23,42,0.06)] [&_a]:break-all [&_pre]:overflow-x-auto sm:max-w-[92%]',
        )}
      >
        {awaitingAssistant ? (
          <AnalysisLoadingState phase={chatRequestPhase === 'upload' ? 'upload' : 'analyzing'} />
        ) : responseKind === 'analysis' ? (
          !hasDisplayableAnalysisContent(turn) ? (
            <AnalysisLoadingState phase="analyzing" />
          ) : (
            structuredAnswer
          )
        ) : responseKind === 'clarification' || responseKind === 'refusal' ? (
          <div className="space-y-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdClarificationRefusal}>
              {safeMarkdownAssistantText || 'The assistant returned a non-analysis response.'}
            </ReactMarkdown>
            <WorkspaceRagSources citations={turn.citations ?? []} />
          </div>
        ) : responseKind === 'system_notice' ? (
          <div className="space-y-2 rounded-xl border border-slate-300 bg-violet-50 px-3 py-3 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-900">
              <AlertTriangle className="h-3.5 w-3.5 text-slate-900" aria-hidden />
              System notice
            </p>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdSystemNotice}>
              {systemNoticeMarkdownBody ||
                (systemNoticeLabel ? '' : 'This session has a new system notice.')}
            </ReactMarkdown>
            {systemNoticeLabel ? (
              <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-900 shadow-sm">
                {systemNoticeLabel}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFallback}>
              {safeMarkdownAssistantText || 'The assistant returned a response.'}
            </ReactMarkdown>
            <WorkspaceRagSources citations={turn.citations ?? []} />
          </div>
        )}

        {expertSupportInline?.kind === 'awaiting' ? (
          <p className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Awaiting educator review — your AI answer remains visible above.
          </p>
        ) : null}

        {showExpertMenu ? (
          <div className="absolute right-2 top-2">
            <button
              type="button"
              className="rounded-xl p-1.5 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100"
              onClick={onToggleMenu}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {activeMenuTurnKey === turnMenuKey ? (
              <div className="absolute right-0 z-[100] mt-1 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  disabled={requestingExpertSupport}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-900 hover:bg-muted disabled:opacity-50"
                  onClick={() => {
                    onRequestExpertSupport();
                  }}
                >
                  {requestingExpertSupport ? 'Sending…' : 'Request Expert Support'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
