'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { requestStudentVisualQaReview } from '@/lib/api/student-visual-qa';
import { appToast } from '@/lib/api/errors/app-toast';
import { showApiErrorToast } from '@/lib/api/errors/show-api-error-toast';
import type { VisualQaSessionReport, VisualQaTurn } from '@/lib/api/types';
import {
  buildExpertSupportMapFromSession,
  type ExpertSupportUiState,
} from '@/lib/student/visual-qa-expert-support';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';

function sessionSnapshotFromStore(
  sessionId: string,
  turns: VisualQaTurn[],
): VisualQaSessionReport {
  const state = useVisualQaStore.getState();
  const sorted = [...turns].sort((a, b) => a.turnIndex - b.turnIndex);
  return {
    sessionId,
    caseId: state.caseId ?? undefined,
    turns: sorted,
    latest: sorted.at(-1) ?? null,
    capabilities: state.capabilities ?? undefined,
    sessionStatus: state.sessionStatus,
    reviewFeedback: state.reviewFeedback,
    status: state.sessionStatus,
  };
}

export function useVisualQAExpertSupport(sessionId: string | null, turns: VisualQaTurn[]) {
  const [expertSupportByAssistantId, setExpertSupportByAssistantId] = useState<
    Record<string, ExpertSupportUiState>
  >({});
  const [requestingExpertSupport, setRequestingExpertSupport] = useState(false);

  const sid = sessionId?.trim() ?? '';

  useEffect(() => {
    if (!sid) {
      setExpertSupportByAssistantId({});
      return;
    }
    if (turns.length === 0) return;
    setExpertSupportByAssistantId((prev) => {
      const fromSession = buildExpertSupportMapFromSession(sessionSnapshotFromStore(sid, turns));
      const merged = { ...fromSession };
      for (const [aid, state] of Object.entries(prev)) {
        if (state.phase === 'awaiting' && !merged[aid]) {
          merged[aid] = state;
        }
      }
      return merged;
    });
  }, [sid, turns]);

  const requestExpertSupport = useCallback(
    async (turn: VisualQaTurn) => {
      if (!sid) {
        appToast.warning('Start a Visual QA session before requesting expert support.');
        return;
      }
      const assistantMessageId = turn.assistantMessageId?.trim();
      if (!assistantMessageId) {
        appToast.error('This answer is not ready for escalation yet. Try again after the AI responds.');
        return;
      }

      setRequestingExpertSupport(true);
      setExpertSupportByAssistantId((prev) => ({
        ...prev,
        [assistantMessageId]: { phase: 'awaiting' },
      }));

      try {
        const updated = await requestStudentVisualQaReview(sid, assistantMessageId);
        const store = useVisualQaStore.getState();
        if ((updated.turns?.length ?? 0) > 0) {
          store.hydrateThread(updated);
        } else {
          store.setCapabilities(updated.capabilities);
        }
        setExpertSupportByAssistantId((prev) => ({
          ...buildExpertSupportMapFromSession(
            (updated.turns?.length ?? 0) > 0
              ? updated
              : sessionSnapshotFromStore(sid, store.turns),
          ),
          [assistantMessageId]: { phase: 'awaiting' },
        }));
        appToast.success('Your question was sent to the lecturer triage queue.');
      } catch (err) {
        setExpertSupportByAssistantId((prev) => {
          const next = { ...prev };
          delete next[assistantMessageId];
          return next;
        });
        if (axios.isAxiosError(err)) {
          showApiErrorToast(err);
        } else {
          appToast.error(err instanceof Error ? err.message : 'Expert support request failed.');
        }
        throw err;
      } finally {
        setRequestingExpertSupport(false);
      }
    },
    [sid],
  );

  return {
    expertSupportByAssistantId,
    requestingExpertSupport,
    requestExpertSupport,
  };
}
