'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import type { VisualQaCapabilities, VisualQaAskJsonResponse } from '@/lib/api/visual-qa/types';
import type { VisualQaUploadPersonalResponse } from '@/lib/api/visual-qa/types';
import type { VisualQaThreadResponse } from '@/lib/api/visual-qa/types';
import type { VisualQaTurn } from '@/lib/api/types';
import {
  appendOptimisticQuestionTurn as buildOptimisticQuestionTurn,
  dedupeTurnsSameIndexPreferServer,
  mergeTurnsByIdentity,
} from '@/lib/student/visual-qa-chat-turns';
import { isBrokenLegacyImageUrl } from '@/lib/api/visual-qa/image-url';
import { resolveVisualQaStoredCoordinates } from '@/lib/utils/annotations';

export type VisualQaFlow = 'catalog' | 'personal' | null;

export type VisualQaPersistedSlice = {
  flow: VisualQaFlow;
  sessionId: string | null;
  caseId: string | null;
  previewImageUrl: string | null;
  imageId: string | null;
  dicomMetadata: VisualQaDicomMetadata | null;
  locale: 'vi' | 'en';
};

export type VisualQaStoreState = VisualQaPersistedSlice & {
  coordinates: string | null;
  capabilities: VisualQaCapabilities | null;
  turns: VisualQaTurn[];
  sessionStatus: string | null;
  reviewFeedback: string | null;
  isAsking: boolean;
  isUploading: boolean;
  lastSystemNotice: string | null;

  setFlow: (flow: VisualQaFlow) => void;
  setLocale: (locale: 'vi' | 'en') => void;
  setCaseContext: (caseId: string, previewImageUrl: string | null, imageId?: string | null) => void;
  setCoordinates: (coordinates: string | null) => void;
  setFromUpload: (response: VisualQaUploadPersonalResponse) => void;
  setDicomMetadata: (metadata: VisualQaDicomMetadata | null) => void;
  setCapabilities: (capabilities: VisualQaCapabilities | null | undefined) => void;
  setPreviewImageUrl: (url: string | null) => void;
  setTurns: (turns: VisualQaTurn[]) => void;
  appendOptimisticQuestionTurn: (question: string, clientRequestId: string) => void;
  setIsAsking: (value: boolean) => void;
  setIsUploading: (value: boolean) => void;
  appendFromAskJson: (response: VisualQaAskJsonResponse) => void;
  hydrateThread: (thread: VisualQaThreadResponse, options?: { replace?: boolean }) => void;
  beginSessionLoad: (sessionId: string) => void;
  resetSession: () => void;
};

const EMPTY_PERSISTED: VisualQaPersistedSlice = {
  flow: null,
  sessionId: null,
  caseId: null,
  previewImageUrl: null,
  imageId: null,
  dicomMetadata: null,
  locale: 'vi',
};

function resolveSessionFields(response: VisualQaAskJsonResponse | VisualQaThreadResponse): {
  sessionStatus: string | null;
  reviewFeedback: string | null;
} {
  return {
    sessionStatus: response.sessionStatus?.trim() || response.status?.trim() || null,
    reviewFeedback: response.reviewFeedback?.trim() || null,
  };
}

function mergeAskResponseTurns(existing: VisualQaTurn[], response: VisualQaAskJsonResponse): VisualQaTurn[] {
  const incomingTurns = dedupeAskJsonTurnBatch(turnsFromAskJsonResponse(response));
  if (incomingTurns.length === 0) return existing;
  return mergeIncomingTurns(existing, incomingTurns);
}

function mergeIncomingTurns(existing: VisualQaTurn[], incoming: VisualQaTurn[]): VisualQaTurn[] {
  return dedupeTurnsSameIndexPreferServer(mergeTurnsByIdentity(existing, incoming));
}

function isSameTurn(a: VisualQaTurn, b: VisualQaTurn): boolean {
  const aId = a.turnId?.trim();
  const bId = b.turnId?.trim();
  if (aId && bId && aId === bId) return true;
  const aReq = a.clientRequestId?.trim();
  const bReq = b.clientRequestId?.trim();
  if (aReq && bReq && aReq === bReq) return true;
  return a.turnIndex === b.turnIndex;
}

function dedupeAskJsonTurnBatch(batch: VisualQaTurn[]): VisualQaTurn[] {
  return dedupeTurnsSameIndexPreferServer(batch);
}

function turnsFromAskJsonResponse(response: VisualQaAskJsonResponse): VisualQaTurn[] {
  const batch: VisualQaTurn[] = [];
  if (response.turns?.length) batch.push(...response.turns);
  if (response.latest && !batch.some((turn) => isSameTurn(turn, response.latest!))) {
    batch.push(response.latest);
  }
  return batch;
}

function sanitizePersistedImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || null;
  if (!trimmed || isBrokenLegacyImageUrl(trimmed)) return null;
  return trimmed;
}

function resolveThreadPreviewUrl(
  thread: VisualQaAskJsonResponse | VisualQaThreadResponse,
  fallback: string | null,
): string | null {
  const raw =
    thread.studyImageUrl?.trim() ||
    thread.sessionImageUrl?.trim() ||
    thread.imageUrl?.trim() ||
    fallback;
  return sanitizePersistedImageUrl(raw);
}

function resolveThreadCoordinates(
  thread: VisualQaAskJsonResponse | VisualQaThreadResponse,
  turns: VisualQaTurn[],
): string | null {
  return resolveVisualQaStoredCoordinates({
    threadRoiBoundingBox: thread.roiBoundingBox ?? null,
    turns,
  });
}

export const useVisualQaStore = create<VisualQaStoreState>()(
  persist(
    (set, get) => ({
      ...EMPTY_PERSISTED,
      coordinates: null,
      capabilities: null,
      turns: [],
      sessionStatus: null,
      reviewFeedback: null,
      isAsking: false,
      isUploading: false,
      lastSystemNotice: null,

      setFlow: (flow) => set({ flow }),
      setLocale: (locale) => set({ locale }),
      setCaseContext: (caseId, previewImageUrl, imageId = null) =>
        set({
          caseId: caseId.trim() || null,
          previewImageUrl: sanitizePersistedImageUrl(previewImageUrl),
          imageId: imageId?.trim() || null,
          flow: get().flow ?? 'catalog',
        }),
      setCoordinates: (coordinates) => set({ coordinates: coordinates?.trim() || null }),
      setFromUpload: (response) =>
        set({
          flow: 'personal',
          sessionId: response.sessionId?.trim() || null,
          caseId: response.caseId?.trim() || null,
          previewImageUrl: sanitizePersistedImageUrl(response.previewImageUrl),
          imageId:
            response.catalogImageId?.trim() ||
            response.mediaId?.trim() ||
            null,
          dicomMetadata: response.dicomMetadata ?? null,
          capabilities: null,
          turns: [],
          sessionStatus: null,
          reviewFeedback: null,
          lastSystemNotice: null,
        }),
      setDicomMetadata: (metadata) => set({ dicomMetadata: metadata }),
      setCapabilities: (capabilities) =>
        set({
          capabilities: capabilities
            ? {
                canAskNext: capabilities.canAskNext,
                canRequestReview: capabilities.canRequestReview,
                isReadOnly: capabilities.isReadOnly,
                turnsUsed: capabilities.turnsUsed,
                turnLimit: capabilities.turnLimit,
                reviewRoute: capabilities.reviewRoute,
                studyMode: capabilities.studyMode ?? null,
                blockingReason: capabilities.blockingReason ?? null,
                reason: capabilities.reason ?? capabilities.blockingReason ?? null,
              }
            : null,
        }),
      setPreviewImageUrl: (url) => set({ previewImageUrl: sanitizePersistedImageUrl(url) }),
      setTurns: (turns) => set({ turns }),
      appendOptimisticQuestionTurn: (question, clientRequestId) =>
        set((state) => ({
          turns: buildOptimisticQuestionTurn(state.turns, question, clientRequestId),
        })),
      setIsAsking: (value) => set({ isAsking: value }),
      setIsUploading: (value) => set({ isUploading: value }),

      appendFromAskJson: (response) => {
        const sessionFields = resolveSessionFields(response);
        const sessionId = response.sessionId?.trim() || get().sessionId;
        const caseId = response.caseId?.trim() || get().caseId;
        const imageUrl = resolveThreadPreviewUrl(response, get().previewImageUrl);
        const dicomMetadata = response.dicomMetadata ?? get().dicomMetadata;

        set((state) => ({
          sessionId,
          caseId,
          previewImageUrl: imageUrl,
          imageId: response.imageId?.trim() || state.imageId,
          dicomMetadata,
          capabilities: response.capabilities ?? state.capabilities,
          turns: mergeAskResponseTurns(state.turns, response),
          sessionStatus: sessionFields.sessionStatus ?? state.sessionStatus,
          reviewFeedback: sessionFields.reviewFeedback ?? state.reviewFeedback,
          lastSystemNotice:
            response.systemNotice?.trim() ||
            response.blockingNotice?.trim() ||
            state.lastSystemNotice,
        }));
      },

      beginSessionLoad: (sessionId) => {
        const id = sessionId.trim();
        if (!id) return;
        set({
          sessionId: id,
          caseId: null,
          previewImageUrl: null,
          imageId: null,
          dicomMetadata: null,
          turns: [],
          reviewFeedback: null,
          sessionStatus: null,
          lastSystemNotice: null,
          capabilities: null,
          coordinates: null,
        });
      },

      hydrateThread: (thread, options) => {
        const sessionFields = resolveSessionFields(thread);
        const sessionId = thread.sessionId?.trim() || get().sessionId;
        const preview = resolveThreadPreviewUrl(thread, get().previewImageUrl);

        set((state) => {
          const incomingTurns = dedupeAskJsonTurnBatch(thread.turns ?? []);
          const replace =
            options?.replace === true ||
            Boolean(sessionId && state.sessionId?.trim() && sessionId !== state.sessionId.trim());
          const mergedTurns = replace
            ? incomingTurns
            : incomingTurns.length > 0
              ? mergeIncomingTurns(state.turns, incomingTurns)
              : state.turns;
          const hydratedCoordinates = resolveThreadCoordinates(thread, mergedTurns);

          return {
            sessionId,
            caseId: thread.caseId?.trim() || state.caseId,
            previewImageUrl: preview,
            imageId: thread.imageId?.trim() || state.imageId,
            dicomMetadata: thread.dicomMetadata ?? state.dicomMetadata,
            capabilities: thread.capabilities ?? state.capabilities,
            turns: mergedTurns,
            coordinates: hydratedCoordinates ?? (replace ? null : state.coordinates),
            sessionStatus: replace
              ? sessionFields.sessionStatus
              : sessionFields.sessionStatus ?? state.sessionStatus,
            reviewFeedback: replace
              ? sessionFields.reviewFeedback
              : sessionFields.reviewFeedback ?? state.reviewFeedback,
            lastSystemNotice: replace
              ? thread.systemNotice?.trim() || thread.blockingNotice?.trim() || null
              : thread.systemNotice?.trim() ||
                thread.blockingNotice?.trim() ||
                state.lastSystemNotice,
          };
        });
      },

      resetSession: () =>
        set({
          ...EMPTY_PERSISTED,
          coordinates: null,
          capabilities: null,
          turns: [],
          sessionStatus: null,
          reviewFeedback: null,
          isAsking: false,
          isUploading: false,
          lastSystemNotice: null,
        }),
    }),
    {
      name: 'bonevisqa:visual-qa',
      partialize: (state): VisualQaPersistedSlice => ({
        flow: state.flow,
        sessionId: state.sessionId,
        caseId: state.caseId,
        previewImageUrl: sanitizePersistedImageUrl(state.previewImageUrl),
        imageId: state.imageId,
        dicomMetadata: state.dicomMetadata,
        locale: state.locale,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const sanitized = sanitizePersistedImageUrl(state.previewImageUrl);
        if (sanitized !== state.previewImageUrl) {
          useVisualQaStore.setState({ previewImageUrl: sanitized });
        }
      },
    },
  ),
);
