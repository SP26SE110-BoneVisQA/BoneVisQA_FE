'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChatComposer } from '@/components/student/ChatComposer';
import { ChatConversation } from '@/components/student/ChatConversation';
import type { ExpertSupportUiState } from '@/lib/student/visual-qa-expert-support';
import type { VisualQaCapabilities } from '@/lib/api/visual-qa/types';
import type { VisualQaTurn } from '@/lib/api/types';
import type { WorkspaceAnswerVariant } from '@/features/visual-qa/components/WorkspaceStructuredAnswer';

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
  answerVariant?: WorkspaceAnswerVariant;
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
  answerVariant = 'full',
}: WorkspaceChatPanelProps) {
  const [draft, setDraft] = useState('');

  const composerLocked = composerDisabled || isAsking;

  const sessionCapabilities = useMemo(
    () =>
      capabilities
        ? {
            canAskNext: true,
            canRequestReview: capabilities.canRequestReview,
            isReadOnly: false,
            turnsUsed: capabilities.turnsUsed,
            turnLimit: capabilities.turnLimit,
            reason: null,
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
        <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Clinical conversation
        </span>
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
        answerVariant={answerVariant}
      />

      <div className="shrink-0 border-t border-slate-200/70 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-5">
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void handleSubmit()}
          disabled={composerLocked}
          isLoading={isAsking}
          placeholder={
            answerVariant === 'catalog'
              ? 'Ask a short question about this teaching case…'
              : 'Ask a question about the X-ray image…'
          }
        />
      </div>
    </div>
  );
}
