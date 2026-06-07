'use client';

import { useCallback, useState } from 'react';
import { appToast } from '@/lib/api/errors';
import {
  postVisualQaUploadPersonal,
  validatePersonalStudyArchive,
  formatVisualQaUploadError,
  type VisualQaUploadPersonalResponse,
} from '@/lib/api/visual-qa';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';

export type VisualQaUploadPhase = 'idle' | 'uploading' | 'ingesting';

export function useVisualQAUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<VisualQaUploadPhase>('idle');
  const [ingestError, setIngestError] = useState<string | null>(null);
  const isUploading = useVisualQaStore((s) => s.isUploading);

  const uploadPersonalStudy = useCallback(
    async (
      file: File,
      options?: { diagnosisText?: string; skipApiToast?: boolean },
    ): Promise<VisualQaUploadPersonalResponse> => {
      const validationError = validatePersonalStudyArchive(file);
      if (validationError) {
        setIngestError(validationError);
        throw new Error(validationError);
      }

      setIngestError(null);
      setUploadProgress(0);
      setPhase('uploading');
      useVisualQaStore.getState().setIsUploading(true);

      try {
        const result = await postVisualQaUploadPersonal(file, {
          diagnosisText: options?.diagnosisText,
          skipApiToast: options?.skipApiToast ?? false,
          onUploadProgress: (pct) => {
            setUploadProgress(pct);
            if (pct >= 100) {
              setPhase('ingesting');
            }
          },
          onIngestPolling: () => setPhase('ingesting'),
        });

        useVisualQaStore.getState().setFromUpload(result);
        setPhase('idle');
        setUploadProgress(100);
        return result;
      } catch (err) {
        setPhase('idle');
        setUploadProgress(0);

        const uploadResult =
          err instanceof Error && 'uploadResult' in err
            ? (err as Error & { uploadResult?: VisualQaUploadPersonalResponse }).uploadResult
            : undefined;

        const userMessage = formatVisualQaUploadError(err);
        if (uploadResult && !uploadResult.ingestOk) {
          setIngestError(userMessage);
        } else {
          setIngestError(userMessage);
        }

        if (!options?.skipApiToast) {
          appToast.error(userMessage);
        }
        throw err;
      } finally {
        useVisualQaStore.getState().setIsUploading(false);
      }
    },
    [],
  );

  const resetUploadUi = useCallback(() => {
    setUploadProgress(0);
    setPhase('idle');
    setIngestError(null);
  }, []);

  return {
    uploadPersonalStudy,
    uploadProgress,
    phase,
    ingestError,
    isUploading: isUploading || phase === 'uploading' || phase === 'ingesting',
    resetUploadUi,
  };
}
