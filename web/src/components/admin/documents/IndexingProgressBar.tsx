'use client';

import { normalizeIndexingStatus, type NormalizedIndexingStatus } from '@/lib/api/admin-documents';

type Props = {
  statusRaw?: string;
  progressPercentage?: number | null;
  currentPageIndexing?: number | null;
  totalPages?: number | null;
  totalChunks?: number | null;
  currentOperation?: string | null;
  phaseLabel?: string | null;
  className?: string;
};

type ProgressState = {
  normalizedStatus: NormalizedIndexingStatus;
  percent: number;
  isIndeterminate: boolean;
  label: string;
  helper: string;
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildProgressState(
  statusRaw: string | undefined,
  progressPercentage: number | null | undefined,
  currentPageIndexing: number | null | undefined,
  totalPages: number | null | undefined,
  totalChunks: number | null | undefined,
  phaseLabel: string | null | undefined,
): ProgressState {
  const statusText = (statusRaw ?? '').trim().toLowerCase();
  const isReindexing = statusText.includes('reindex');
  const normalizedStatus = normalizeIndexingStatus(statusRaw);
  const isActive = normalizedStatus === 'pending' || normalizedStatus === 'processing';

  const hasServerPct =
    typeof progressPercentage === 'number' && Number.isFinite(progressPercentage);
  const percent = hasServerPct ? clampPct(progressPercentage) : 0;
  const isIndeterminate = isActive && !hasServerPct;

  const phaseText = phaseLabel?.trim();
  const label = phaseText
    ? `${isReindexing ? 'Reindexing' : 'Processing'}: ${phaseText} (${percent}%)`
    : isIndeterminate
      ? normalizedStatus === 'pending'
        ? isReindexing
          ? 'Re-analyzing document…'
          : 'Analyzing PDF…'
        : isReindexing
          ? 'Re-vectorizing content…'
          : 'Extracting data…'
      : `${isReindexing ? 'Reindexing' : 'Processing'} (${percent}%)`;

  return {
    normalizedStatus,
    percent,
    isIndeterminate,
    label,
    helper: isReindexing ? 'Reindexing' : normalizedStatus === 'pending' ? 'Pending' : 'Processing',
  };
}

export function IndexingProgressBar({
  statusRaw,
  progressPercentage,
  currentPageIndexing,
  totalPages,
  totalChunks,
  currentOperation,
  phaseLabel,
  className,
}: Props) {
  const state = buildProgressState(
    statusRaw,
    progressPercentage,
    currentPageIndexing,
    totalPages,
    totalChunks,
    phaseLabel,
  );

  return (
    <div className={`space-y-2 ${className ?? ''}`.trim()}>
      <p className="text-[11px] font-medium leading-snug text-sky-900">{state.label}</p>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-sky-500/15 ring-1 ring-sky-500/20">
        {state.isIndeterminate ? (
          <div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-400 animate-[indeterminate-slide_1.2s_ease-in-out_infinite]"
            aria-hidden
          />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-400"
            style={{ width: `${state.percent}%`, transition: 'width 0.3s ease-in-out' }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden
        />
      </div>
      {currentOperation?.trim() ? (
        <p className="text-[10px] text-muted-foreground line-clamp-2">{currentOperation}</p>
      ) : (
        <p className="text-[10px] text-muted-foreground">{state.helper}</p>
      )}
    </div>
  );
}
