'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChatComposer } from '@/components/student/ChatComposer';
import { ChatConversation } from '@/components/student/ChatConversation';
import type { ExpertSupportUiState } from '@/lib/student/visual-qa-expert-support';
import type { VisualQaCapabilities } from '@/lib/api/visual-qa/types';
import type { VisualQaTurn } from '@/lib/api/types';

type WorkspaceChatPanelProps = {
  turns: VisualQaTurn[];
  capabilities: VisualQaCapabilities | null | undefined;
  isAsking: boolean;
  lastSystemNotice: string | null;
  composerDisabled?: boolean;
  requestingExpertSupport?: boolean;
  expertSupportByAssistantId?: Record<string, ExpertSupportUiState>;
  onRequestExpertSupport?: (turn: VisualQaTurn) => void | Promise<void>;
  onSend: (text: string) => void | Promise<void>;
  onClear: () => void;
};

export function WorkspaceChatPanel({
  turns,
  capabilities,
  isAsking,
  lastSystemNotice,
  composerDisabled = false,
  requestingExpertSupport = false,
  expertSupportByAssistantId = {},
  onRequestExpertSupport,
  onSend,
  onClear,
}: WorkspaceChatPanelProps) {
  const [draft, setDraft] = useState('');

  const canAskNext = capabilities?.canAskNext !== false;
  const composerLocked = composerDisabled || !canAskNext || isAsking;

  const capabilityReason = capabilities?.reason?.trim() || '';
  const lockHint = !canAskNext
    ? capabilityReason || 'You have used all questions allowed in this Visual QA session.'
    : null;

  const sessionCapabilities = useMemo(
    () =>
      capabilities
        ? {
            canAskNext: capabilities.canAskNext,
            canRequestReview: capabilities.canRequestReview,
            isReadOnly: capabilities.isReadOnly,
            turnsUsed: capabilities.turnsUsed,
            turnLimit: capabilities.turnLimit,
            reason: capabilities.reason ?? null,
          }
        : undefined,
    [capabilities],
  );

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || composerLocked) return;
    setDraft('');
    await onSend(text);
  }, [composerLocked, draft, onSend]);

  const handleRetryFromConversation = useCallback(
    async (message: string) => {
      await onSend(message);
    },
    [onSend],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Clinical conversation
          </span>
          {capabilities?.turnsUsed != null && capabilities?.turnLimit != null ? (
            <span className="rounded-full border border-slate-200/70 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
              {capabilities.turnsUsed}/{capabilities.turnLimit} turns used
            </span>
          ) : null}
          {capabilities?.isReadOnly ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
              Read-only
            </span>
          ) : null}
        </div>
      </div>
      <ChatConversation
        messages={turns}
        capabilities={sessionCapabilities}
        isLoading={isAsking}
        chatRequestPhase={isAsking ? 'analyzing' : 'idle'}
        blockingNotice={lastSystemNotice}
        canRequestReview={Boolean(capabilities?.canRequestReview)}
        requestingExpertSupport={requestingExpertSupport}
        expertSupportByAssistantId={expertSupportByAssistantId}
        onRequestExpertSupport={(turn) => void onRequestExpertSupport?.(turn)}
        onSendMessage={handleRetryFromConversation}
        onClear={onClear}
      />

      <div className="shrink-0 border-t border-slate-200/70 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-5">
        {lockHint ? (
          <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900" role="status">
            {lockHint}
          </p>
        ) : null}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void handleSubmit()}
          disabled={composerLocked}
          isLoading={isAsking}
          placeholder={
            composerLocked && !isAsking
              ? 'Session locked — you cannot send more questions.'
              : 'Ask a question about the X-ray image…'
          }
        />
      </div>
    </div>
  );
}
