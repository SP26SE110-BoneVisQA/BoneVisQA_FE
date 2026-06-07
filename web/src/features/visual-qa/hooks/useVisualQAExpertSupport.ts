'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { requestStudentVisualQaReview } from '@/lib/api/student-visual-qa';
import { appToast } from '@/lib/api/errors/app-toast';
import { parseApiErrorBody } from '@/lib/api/errors';
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
    capabilities: state.capabilities
      ? {
          canAskNext: state.capabilities.canAskNext,
          canRequestReview: state.capabilities.canRequestReview,
          isReadOnly: state.capabilities.isReadOnly,
          turnsUsed: state.capabilities.turnsUsed,
          turnLimit: state.capabilities.turnLimit ?? undefined,
          reason: state.capabilities.reason ?? state.capabilities.blockingReason ?? undefined,
        }
      : undefined,
    sessionStatus: state.sessionStatus,
    reviewFeedback: state.reviewFeedback,
    status: state.sessionStatus,
  };
}

export function useVisualQAExpertSupport(sessionId: string | null, turns: VisualQaTurn[]) {
  const [expertSupportByAssistantId, setExpertSupportByAssistantId] = useState<
    Record<string, ExpertSupportUiState>
  >({});
  const [requestingExpertSupportForAssistantId, setRequestingExpertSupportForAssistantId] =
    useState<string | null>(null);

  const sid = sessionId?.trim() ?? '';

  useEffect(() => {
    if (!sid) {
      setExpertSupportByAssistantId({});
      return;
    }
    setExpertSupportByAssistantId(
      turns.length === 0
        ? {}
        : buildExpertSupportMapFromSession(sessionSnapshotFromStore(sid, turns)),
    );
  }, [sid, turns]);

  const requestExpertSupport = useCallback(
    async (turn: VisualQaTurn) => {
      if (!sid) {
        appToast.warning('Start a Visual QA session before requesting expert support.');
        return;
      }
      const assistantKey = turn.assistantMessageId?.trim() ?? '';
      const turnIdForReview =
        assistantKey || turn.turnId?.trim() || turn.userMessageId?.trim();
      if (!turnIdForReview) {
        appToast.error('This answer is not ready for escalation yet. Try again after the AI responds.');
        return;
      }
      const uiKey = assistantKey || turnIdForReview;

      setRequestingExpertSupportForAssistantId(uiKey);
      setExpertSupportByAssistantId((prev) => ({
        ...prev,
        [uiKey]: { phase: 'awaiting' },
      }));

      try {
        const updated = await requestStudentVisualQaReview(sid, turnIdForReview);
        const store = useVisualQaStore.getState();
        if ((updated.turns?.length ?? 0) > 0) {
          store.hydrateThread(updated, { replace: true });
        } else {
          store.setCapabilities(updated.capabilities);
          if (updated.sessionStatus || updated.status) {
            useVisualQaStore.setState({
              sessionStatus: updated.sessionStatus?.trim() || updated.status?.trim() || null,
            });
          }
        }
        setExpertSupportByAssistantId((prev) => ({
          ...buildExpertSupportMapFromSession(
            (updated.turns?.length ?? 0) > 0
              ? updated
              : sessionSnapshotFromStore(sid, store.turns),
          ),
          [uiKey]: { phase: 'awaiting' },
        }));
        appToast.success(
          'Your request was sent to the lecturer triage queue. An expert will review after escalation.',
        );
      } catch (err) {
        setExpertSupportByAssistantId((prev) => {
          const next = { ...prev };
          delete next[uiKey];
          return next;
        });
        if (axios.isAxiosError(err)) {
          const parsed = parseApiErrorBody(err.response?.data, err.response?.status);
          const detail = parsed.message.trim();
          if (detail) {
            appToast.warning(detail);
          } else {
            showApiErrorToast(err);
          }
        } else {
          appToast.error(err instanceof Error ? err.message : 'Expert support request failed.');
        }
        throw err;
      } finally {
        setRequestingExpertSupportForAssistantId(null);
      }
    },
    [sid],
  );

  return {
    expertSupportByAssistantId,
    requestingExpertSupportForAssistantId,
    requestExpertSupport,
  };
}
