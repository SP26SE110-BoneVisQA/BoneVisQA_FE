'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChatComposer } from '@/components/student/ChatComposer';
import { ChatConversation } from '@/components/student/ChatConversation';
import type { ExpertSupportUiState } from '@/lib/student/visual-qa-expert-support';
import type { VisualQaCapabilities } from '@/lib/api/visual-qa/types';
import type { VisualQaTurn } from '@/lib/api/types';
import type { WorkspaceAnswerVariant } from '@/features/visual-qa/components/WorkspaceStructuredAnswer';
import { isCatalogCaseStudyMode } from '@/lib/student/visual-qa-study-mode';
import type { VisualQaFlow } from '@/features/visual-qa/store/visual-qa-store';

type WorkspaceChatPanelProps = {
  turns: VisualQaTurn[];
  capabilities: VisualQaCapabilities | null | undefined;
  isAsking: boolean;
  lastSystemNotice: string | null;
  composerDisabled?: boolean;
  requestingExpertSupportForAssistantId?: string | null;
  expertSupportByAssistantId?: Record<string, ExpertSupportUiState>;
  onRequestExpertSupport?: (turn: VisualQaTurn) => void | Promise<void>;
  onSend: (text: string) => void | Promise<void>;
  onClear: () => void;
  answerVariant?: WorkspaceAnswerVariant;
  flow?: VisualQaFlow;
};

export function WorkspaceChatPanel({
  turns,
  capabilities,
  isAsking,
  lastSystemNotice,
  composerDisabled = false,
  requestingExpertSupportForAssistantId = null,
  expertSupportByAssistantId = {},
  onRequestExpertSupport,
  onSend,
  onClear,
  answerVariant = 'full',
  flow = null,
}: WorkspaceChatPanelProps) {
  const [draft, setDraft] = useState('');

  const composerLocked = composerDisabled;

  const isCatalogFlow = isCatalogCaseStudyMode(capabilities, flow) || answerVariant === 'catalog';

  const sessionCapabilities = useMemo(
    () => ({
      canAskNext: capabilities?.canAskNext ?? true,
      canRequestReview: isCatalogFlow ? false : (capabilities?.canRequestReview ?? false),
      isReadOnly: capabilities?.isReadOnly ?? false,
      turnsUsed: capabilities?.turnsUsed,
      turnLimit: capabilities?.turnLimit ?? undefined,
      reason: capabilities?.reason ?? capabilities?.blockingReason ?? undefined,
    }),
    [capabilities, isCatalogFlow],
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
        canRequestReview={sessionCapabilities.canRequestReview}
        requestingExpertSupportForAssistantId={requestingExpertSupportForAssistantId}
        expertSupportByAssistantId={expertSupportByAssistantId}
        onRequestExpertSupport={
          isCatalogFlow ? undefined : (turn) => void onRequestExpertSupport?.(turn)
        }
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
            isCatalogFlow
              ? 'Ask a question about this teaching case…'
              : 'Ask a question about your uploaded X-ray study…'
          }
        />
      </div>
    </div>
  );
}
