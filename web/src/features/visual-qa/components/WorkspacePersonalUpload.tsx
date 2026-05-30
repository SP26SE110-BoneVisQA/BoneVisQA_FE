'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import {
  AlertCircle,
  Archive,
  FileArchive,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { appToast } from '@/lib/api/errors/app-toast';
import { validatePersonalStudyArchive } from '@/lib/api/visual-qa';
import { useVisualQAUpload } from '@/features/visual-qa/hooks/useVisualQAUpload';
import type { VisualQaUploadPersonalResponse } from '@/lib/api/visual-qa';
import { cn } from '@/lib/utils';

const MAX_BYTES = 209_715_200;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  onUploaded: (result: VisualQaUploadPersonalResponse, file?: File) => void;
  className?: string;
};

export function WorkspacePersonalUpload({ onUploaded, className }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    uploadPersonalStudy,
    uploadProgress,
    phase,
    ingestError,
    isUploading,
    resetUploadUi,
  } = useVisualQAUpload();

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setLocalError(null);
    if (rejected.length > 0) {
      const first = rejected[0];
      const msg =
        first.errors[0]?.message ||
        validatePersonalStudyArchive(first.file) ||
        'Invalid file.';
      setLocalError(msg);
      setSelectedFile(null);
      return;
    }
    const file = accepted[0];
    if (!file) return;
    const validation = validatePersonalStudyArchive(file);
    if (validation) {
      setLocalError(validation);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/vnd.rar': ['.rar'],
    },
    maxFiles: 1,
    maxSize: MAX_BYTES,
    disabled: isUploading,
    multiple: false,
  });

  const handleSubmit = async () => {
    if (!selectedFile || isUploading) return;
    setLocalError(null);
    try {
      const uploadPromise = uploadPersonalStudy(selectedFile, { skipApiToast: true });
      void appToast.promise(uploadPromise, {
        loading: 'Extracting DICOM…',
        success: 'Study uploaded — opening Visual QA workspace.',
        error: 'Failed to upload or extract DICOM.',
      });
      const result = await uploadPromise;
      onUploaded(result, selectedFile);
    } catch {
      /* ingestError + toast.promise error state */
    }
  };

  const displayError = localError || ingestError;

  return (
    <div className={cn('mx-auto w-full max-w-lg px-6', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && !isDragReject && 'border-border bg-card hover:border-primary/40',
          isUploading && 'pointer-events-none opacity-70',
        )}
      >
        <input {...getInputProps()} aria-label="Choose ZIP or RAR file" />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {isUploading ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          ) : (
            <UploadCloud className="h-7 w-7" aria-hidden />
          )}
        </div>
        <p className="text-base font-semibold text-foreground">
          {isDragActive ? 'Drop to upload' : 'Upload personal DICOM'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          .zip / .rar · max {formatFileSize(MAX_BYTES)}
        </p>
      </div>

      {selectedFile ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <FileArchive className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
          </div>
          {!isUploading ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                resetUploadUi();
                setLocalError(null);
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}

      {isUploading ? (
        <div className="mt-6 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Archive className="h-3.5 w-3.5" aria-hidden />
              {phase === 'ingesting' ? 'Extracting DICOM…' : `Uploading ${uploadProgress}%`}
            </span>
          </div>
          <Progress value={phase === 'ingesting' ? 100 : uploadProgress} />
        </div>
      ) : null}

      {displayError ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{displayError}</p>
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button
          type="button"
          disabled={!selectedFile || isUploading}
          onClick={() => void handleSubmit()}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {phase === 'ingesting' ? 'Extracting DICOM…' : 'Uploading…'}
            </>
          ) : (
            'Start Visual QA'
          )}
        </Button>
      </div>
    </div>
  );
}
