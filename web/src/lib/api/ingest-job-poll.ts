/** Poll interval for async DICOM ingest jobs (BE returns 202 + job id). */
export const INGEST_JOB_POLL_INTERVAL_MS = 4000;

/** Max wait for Railway cold-start + embedding (first ingest can take several minutes). */
export const INGEST_JOB_MAX_WAIT_MS = 10 * 60 * 1000;

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

export function isIngestJobTerminal(status: string, ingestOk?: boolean, ingestError?: string | null): boolean {
  if (status === 'completed' || status === 'failed') return true;
  if (ingestOk) return true;
  if (ingestError && status !== 'processing') return true;
  return false;
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
      throw new Error('DICOM processing timed out. Please try again in a few minutes.');
    }
    await sleep(intervalMs);
  }
}
