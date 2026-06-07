'use client';

import { useCallback } from 'react';
import axios from 'axios';
import {
  isVisualQaSessionErrorBody,
  parseApiErrorBody,
  appToast,
} from '@/lib/api/errors';
import { showApiErrorToast } from '@/lib/api/errors/show-api-error-toast';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
import {
  fetchVisualQaThread,
  postVisualQaAskJson,
  postVisualQaUploadPersonal,
  formatVisualQaUploadError,
  type VisualQaAskJsonResponse,
  type VisualQaUploadPersonalOptions,
} from '@/lib/api/visual-qa';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';
import { createVisualQaClientRequestId } from '@/features/visual-qa/utils/client-request-id';

export type SendQuestionOptions = {
  /** Override store coordinates (normalized bbox JSON string). */
  coordinates?: string | null;
  annotationId?: string | null;
  imageId?: string | null;
  /** Omit on first catalog turn; required for follow-ups and personal flow after upload. */
  sessionId?: string | null;
  caseId?: string | null;
};

export function useVisualQA() {
  const flow = useVisualQaStore((s) => s.flow);
  const sessionId = useVisualQaStore((s) => s.sessionId);
  const caseId = useVisualQaStore((s) => s.caseId);
  const previewImageUrl = useVisualQaStore((s) => s.previewImageUrl);
  const imageId = useVisualQaStore((s) => s.imageId);
  const coordinates = useVisualQaStore((s) => s.coordinates);
  const capabilities = useVisualQaStore((s) => s.capabilities);
  const turns = useVisualQaStore((s) => s.turns);
  const isAsking = useVisualQaStore((s) => s.isAsking);
  const isUploading = useVisualQaStore((s) => s.isUploading);
  const locale = useVisualQaStore((s) => s.locale);
  const lastSystemNotice = useVisualQaStore((s) => s.lastSystemNotice);
  const dicomMetadata = useVisualQaStore((s) => s.dicomMetadata);

  const sendQuestion = useCallback(
    async (text: string, options: SendQuestionOptions = {}): Promise<VisualQaAskJsonResponse> => {
      const questionText = text.trim();
      if (!questionText) {
        throw new Error('Question cannot be empty.');
      }

      const state = useVisualQaStore.getState();
      const resolvedCaseId = (options.caseId ?? state.caseId)?.trim();
      if (!resolvedCaseId) {
        throw new Error('Missing case — open a library case or upload personal DICOM first.');
      }

      const clientRequestId = createVisualQaClientRequestId();
      const resolvedSessionId = options.sessionId ?? state.sessionId;
      const resolvedCoordinates = options.coordinates ?? state.coordinates;

      state.setIsAsking(true);
      state.appendOptimisticQuestionTurn(questionText, clientRequestId);

      try {
        const response = await postVisualQaAskJson(
          {
            questionText,
            caseId: resolvedCaseId,
            sessionId: resolvedSessionId?.trim() || null,
            coordinates: resolvedCoordinates,
            annotationId: options.annotationId ?? null,
            imageId: options.imageId ?? state.imageId,
            clientRequestId,
            dicomMetadata: state.dicomMetadata ?? null,
          },
          { locale: state.locale, skipApiToast: true },
        );

        const store = useVisualQaStore.getState();
        store.appendFromAskJson(response);

        const refreshSessionId = (response.sessionId ?? resolvedSessionId)?.trim();
        if (refreshSessionId) {
          try {
            const thread = await fetchVisualQaThread(refreshSessionId);
            store.hydrateThread(thread, { replace: true });
          } catch {
            // Keep ask-json payload when thread refresh fails.
          }
        }

        return response;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const data = err.response.data;
          if (isVisualQaSessionErrorBody(data)) {
            const partial = normalizeVisualQaSessionReport(data) as VisualQaAskJsonResponse;
            useVisualQaStore.getState().appendFromAskJson(partial);
            const parsed = parseApiErrorBody(data, err.response.status);
            if (parsed.message.trim()) {
              appToast.warning(parsed.message.trim());
            }
            throw err;
          }
        }

        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 503 || status === 429) {
            showApiErrorToast(err);
          } else if (status === 404 || status === 502 || (status && status >= 500)) {
            showApiErrorToast(err);
          } else if (status === 400) {
            const parsed = parseApiErrorBody(err.response?.data, 400);
            appToast.warning(parsed.message.trim() || 'Invalid request.');
          } else if (!axios.isAxiosError(err) || err.response?.status !== 401) {
            showApiErrorToast(err);
          }
        } else {
          appToast.error(err instanceof Error ? err.message : 'Failed to send question.');
        }
        throw err;
      } finally {
        useVisualQaStore.getState().setIsAsking(false);
      }
    },
    [],
  );

  const handleUpload = useCallback(
    async (file: File, options: VisualQaUploadPersonalOptions = {}) => {
      const state = useVisualQaStore.getState();
      state.setIsUploading(true);
      try {
        const result = await postVisualQaUploadPersonal(file, {
          ...options,
          skipApiToast: false,
        });
        useVisualQaStore.getState().setFromUpload(result);
        return result;
      } catch (err) {
        if (!options?.skipApiToast) {
          appToast.error(formatVisualQaUploadError(err));
        }
        throw err;
      } finally {
        useVisualQaStore.getState().setIsUploading(false);
      }
    },
    [],
  );

  const hydrateSession = useCallback(async (targetSessionId: string) => {
    const id = targetSessionId.trim();
    if (!id) throw new Error('sessionId is required.');
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      return null;
    }
    const state = useVisualQaStore.getState();
    const softRefresh = state.turns.length > 0 && state.sessionId?.trim() === id;
    if (!softRefresh) state.setIsAsking(true);
    try {
      const thread = await fetchVisualQaThread(id);
      useVisualQaStore.getState().hydrateThread(thread, { replace: !softRefresh });
      return thread;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        showApiErrorToast(err);
      } else {
        appToast.error(err instanceof Error ? err.message : 'Failed to load session history.');
      }
      throw err;
    } finally {
      if (!softRefresh) useVisualQaStore.getState().setIsAsking(false);
    }
  }, []);

  const resetSession = useVisualQaStore((s) => s.resetSession);
  const setFlow = useVisualQaStore((s) => s.setFlow);
  const setCaseContext = useVisualQaStore((s) => s.setCaseContext);
  const setCoordinates = useVisualQaStore((s) => s.setCoordinates);
  const setLocale = useVisualQaStore((s) => s.setLocale);

  return {
    flow,
    sessionId,
    caseId,
    previewImageUrl,
    imageId,
    coordinates,
    capabilities,
    turns,
    isAsking,
    isUploading,
    locale,
    lastSystemNotice,
    dicomMetadata,
    resetSession,
    setFlow,
    setCaseContext,
    setCoordinates,
    setLocale,
    setDicomMetadata: useVisualQaStore.getState().setDicomMetadata,
    sendQuestion,
    handleUpload,
    hydrateSession,
  };
}
