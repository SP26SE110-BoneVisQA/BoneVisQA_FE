/** Poll interval for async DICOM ingest jobs (BE returns 200 + ingestJobId). */
export const INGEST_JOB_POLL_INTERVAL_MS = 4000;

/** ~5 minutes — matches BE guidance (75 × 4s). First Railway cold-start may need retry. */
export const INGEST_JOB_MAX_POLL_ATTEMPTS = 75;

export const INGEST_JOB_MAX_WAIT_MS =
  INGEST_JOB_POLL_INTERVAL_MS * INGEST_JOB_MAX_POLL_ATTEMPTS;

export const MISSING_INGEST_JOB_ID_MESSAGE =
  'Missing ingestJobId — redeploy Render API';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pickRecordField(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in o && o[k] !== undefined) return o[k];
  }
  return undefined;
}

export function extractIngestJobId(raw: unknown): string | null {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
  const id = String(pickRecordField(o, ['ingestJobId', 'IngestJobId']) ?? '').trim();
  return id || null;
}

export function normalizeIngestJobStatus(raw: unknown): string {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
  return String(
    pickRecordField(o, ['status', 'Status', 'ingestStatus', 'IngestStatus']) ?? '',
  )
    .trim()
    .toLowerCase();
}

/** Job still running — `ingestOk: false` here is expected, not an error. */
export function isIngestJobProcessing(status: string): boolean {
  return status === 'processing' || status === '';
}

export function isIngestJobTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed';
}

export function isIngestJobSuccessful(status: string, ingestOk: boolean): boolean {
  return status === 'completed' && ingestOk;
}

export function isIngestJobFailed(status: string): boolean {
  return status === 'failed';
}

export async function pollUntilIngestComplete<T>(
  fetchJob: () => Promise<T>,
  isTerminal: (job: T) => boolean,
  options?: {
    intervalMs?: number;
    maxWaitMs?: number;
    signal?: AbortSignal;
    onPoll?: () => void;
  },
): Promise<T> {
  const intervalMs = options?.intervalMs ?? INGEST_JOB_POLL_INTERVAL_MS;
  const maxWaitMs = options?.maxWaitMs ?? INGEST_JOB_MAX_WAIT_MS;
  const start = Date.now();

  while (true) {
    options?.onPoll?.();
    const job = await fetchJob();
    if (isTerminal(job)) return job;
    if (options?.signal?.aborted) {
      throw new Error('Upload cancelled.');
    }
    if (Date.now() - start > maxWaitMs) {
      throw new Error('DICOM ingest timed out. Please try again in a few minutes.');
    }
    await sleep(intervalMs);
  }
}
