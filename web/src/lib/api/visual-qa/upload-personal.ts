import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import type {
  VisualQaUploadPersonalOptions,
  VisualQaUploadPersonalResponse,
} from '@/lib/api/visual-qa/types';
import { normalizeDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import { unwrapVisualQaPayload } from '@/lib/api/visual-qa/unwrap';
import {
  extractIngestJobId,
  isIngestJobTerminal,
  normalizeIngestJobStatus,
  pollUntilIngestComplete,
} from '@/lib/api/ingest-job-poll';

export const MAX_STUDY_ARCHIVE_BYTES = 209_715_200; // 200 MB — BE Kestrel limit
const MAX_ARCHIVE_BYTES = MAX_STUDY_ARCHIVE_BYTES;
const ALLOWED_EXTENSIONS = ['.zip', '.rar'] as const;

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx).toLowerCase();
}

export function validatePersonalStudyArchive(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return 'Only .zip or .rar DICOM study archives are allowed.';
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return 'File exceeds the 200 MB limit. Compress the study and try again.';
  }
  if (file.size <= 0) {
    return 'File is empty.';
  }
  return null;
}

function normalizeUploadResponse(raw: unknown): VisualQaUploadPersonalResponse {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
  const pick = (keys: string[]) => {
    for (const k of keys) {
      if (k in o && o[k] !== undefined) return o[k];
    }
    return undefined;
  };

  const sessionId = String(pick(['sessionId', 'SessionId']) ?? '').trim();
  const caseId = String(pick(['caseId', 'CaseId']) ?? '').trim();
  const previewImageUrl = String(pick(['previewImageUrl', 'PreviewImageUrl']) ?? '').trim();
  const ingestOk = Boolean(pick(['ingestOk', 'IngestOk']));
  const ingestErrorRaw = pick(['ingestError', 'IngestError']);
  const ingestError =
    typeof ingestErrorRaw === 'string' && ingestErrorRaw.trim()
      ? ingestErrorRaw.trim()
      : null;

  const mediaId = String(pick(['mediaId', 'MediaId']) ?? '').trim() || null;
  const catalogImageId =
    String(pick(['catalogImageId', 'CatalogImageId']) ?? '').trim() || null;
  const dicomMetadata = normalizeDicomMetadata(
    pick(['dicomMetadata', 'dicom_metadata', 'DicomMetadata']),
  );

  return {
    sessionId,
    caseId,
    previewImageUrl,
    ingestOk,
    ingestError,
    mediaId,
    catalogImageId,
    dicomMetadata,
  };
}

type VisualQaIngestJobSnapshot = VisualQaUploadPersonalResponse & { status: string };

function normalizeVisualQaIngestJob(raw: unknown): VisualQaIngestJobSnapshot {
  const response = normalizeUploadResponse(raw);
  const status = normalizeIngestJobStatus(raw);
  if (status === 'completed' && !response.ingestOk) {
    return { ...response, ingestOk: true, status };
  }
  if (status === 'failed') {
    return { ...response, ingestOk: false, status };
  }
  return { ...response, status: status || 'processing' };
}

async function fetchVisualQaIngestJob(
  jobId: string,
  skipApiToast?: boolean,
): Promise<VisualQaIngestJobSnapshot> {
  const { data } = await http.get<unknown>(
    `/api/student/visual-qa/upload-personal/jobs/${jobId}`,
    { skipApiToast: skipApiToast ?? true },
  );
  return normalizeVisualQaIngestJob(unwrapVisualQaPayload(data));
}

function throwUploadFailure(
  result: VisualQaUploadPersonalResponse,
  fallbackMessage: string,
): never {
  const msg = result.ingestError?.trim() || fallbackMessage;
  const err = new Error(msg) as Error & { uploadResult?: VisualQaUploadPersonalResponse };
  err.uploadResult = result;
  throw err;
}

async function resolveVisualQaUpload(
  payload: unknown,
  httpStatus: number,
  options: VisualQaUploadPersonalOptions = {},
): Promise<VisualQaUploadPersonalResponse> {
  const ingestJobId = extractIngestJobId(payload);
  if (ingestJobId || httpStatus === 202) {
    if (!ingestJobId) {
      throw new Error('Upload accepted but ingestJobId is missing.');
    }

    const finalJob = await pollUntilIngestComplete(
      () => fetchVisualQaIngestJob(ingestJobId, options.skipApiToast),
      (job) => isIngestJobTerminal(job.status, job.ingestOk, job.ingestError),
      { onPoll: options.onIngestPolling },
    );

    const result = normalizeUploadResponse(finalJob);
    if (finalJob.status === 'failed' || !result.ingestOk) {
      throwUploadFailure(result, 'Unable to process the DICOM archive.');
    }
    if (!result.sessionId?.trim() || !result.caseId?.trim()) {
      throw new Error('Upload response is missing sessionId or caseId.');
    }
    return result;
  }

  const result = normalizeUploadResponse(payload);
  if (!result.ingestOk) {
    throwUploadFailure(result, 'Unable to process the DICOM archive.');
  }
  if (!result.sessionId?.trim() || !result.caseId?.trim()) {
    throw new Error('Upload response is missing sessionId or caseId.');
  }
  return result;
}

/**
 * `POST /api/student/visual-qa/upload-personal` (multipart).
 * BE returns 202 + `ingestJobId`; poll until ingest completes.
 */
export async function postVisualQaUploadPersonal(
  file: File,
  options: VisualQaUploadPersonalOptions = {},
): Promise<VisualQaUploadPersonalResponse> {
  const validationError = validatePersonalStudyArchive(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const form = new FormData();
  form.append('file', file, file.name);
  const note = options.diagnosisText?.trim();
  if (note) form.append('diagnosisText', note);

  try {
    const { data, status: httpStatus } = await http.post<unknown>(
      '/api/student/visual-qa/upload-personal',
      form,
      {
        timeout: 15 * 60 * 1000,
        skipApiToast: options.skipApiToast,
        onUploadProgress: (ev) => {
          if (!options.onUploadProgress || !ev.total) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          options.onUploadProgress(Math.min(100, pct));
        },
      },
    );

    const payload = unwrapVisualQaPayload(data);
    return await resolveVisualQaUpload(payload, httpStatus, options);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data) {
      const payload = unwrapVisualQaPayload(e.response.data);
      const result = normalizeUploadResponse(payload);
      if (!result.ingestOk) {
        throwUploadFailure(result, 'Unable to process the DICOM archive.');
      }
    }
    if (axios.isAxiosError(e)) {
      throw e;
    }
    throw new Error(getApiErrorMessage(e));
  }
}
