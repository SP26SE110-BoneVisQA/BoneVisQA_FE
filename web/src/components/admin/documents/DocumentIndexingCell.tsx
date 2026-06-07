'use client';

import { normalizeIndexingStatus, type DocumentDto } from '@/lib/api/admin-documents';
import type { DocumentStatusResponse } from '@/lib/api/types';
import { RefreshCw } from 'lucide-react';
import { IndexingProgressBar } from './IndexingProgressBar';

function StaticIndexingBadge({ statusRaw }: { statusRaw: string | undefined }) {
  const n = normalizeIndexingStatus(statusRaw);
  const raw = (statusRaw ?? '').trim().toLowerCase();
  const isReindexing = raw.includes('reindex');
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold';
  switch (n) {
    case 'pending':
      return (
        <span className={`${base} border-amber-500/40 bg-amber-500/10 text-amber-800`}>
          <RefreshCw className="h-3.5 w-3.5 animate-spin opacity-70" />
          Pending
        </span>
      );
    case 'processing':
      return (
        <span className={`${base} border-sky-500/40 bg-sky-500/10 text-sky-800`}>
          <RefreshCw className="h-3.5 w-3.5 animate-spin opacity-80" />
          {isReindexing ? 'Reindexing' : 'Processing'}
        </span>
      );
    case 'completed':
      return (
        <span className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-800`}>
          <span aria-hidden>🟢</span>
          Completed
        </span>
      );
    case 'failed':
      return (
        <span className={`${base} border-destructive/40 bg-destructive/10 text-destructive`}>
          <span aria-hidden>🔴</span>
          Failed
        </span>
      );
    default:
      return (
        <span className={`${base} border-border bg-muted text-muted-foreground`}>
          {statusRaw?.trim() || 'Unknown'}
        </span>
      );
  }
}

type Props = {
  doc: DocumentDto;
  statusDetail?: DocumentStatusResponse | null;
  showQueueHint?: boolean;
};

export function DocumentIndexingCell({ doc, statusDetail, showQueueHint = false }: Props) {
  const effectiveStatus = statusDetail?.status ?? doc.indexingStatus;
  const n = normalizeIndexingStatus(effectiveStatus);
  if (n !== 'pending' && n !== 'processing') {
    return <StaticIndexingBadge statusRaw={effectiveStatus} />;
  }

  const cur = statusDetail?.currentPageIndexing ?? doc.currentPageIndexing;
  const total = statusDetail?.totalPages ?? doc.totalPages;

  return (
    <div className="min-w-[220px] max-w-[min(100%,320px)] space-y-2">
      <StaticIndexingBadge statusRaw={effectiveStatus} />
      <IndexingProgressBar
        statusRaw={effectiveStatus}
        progressPercentage={statusDetail?.progressPercentage}
        currentPageIndexing={cur}
        totalPages={total}
        totalChunks={statusDetail?.totalChunks}
        currentOperation={statusDetail?.currentOperation ?? null}
        phaseLabel={statusDetail?.phaseLabel ?? null}
      />
      {n === 'pending' && showQueueHint ? (
        <p className="text-[11px] font-medium leading-snug text-sky-800">
          In Queue: Waiting for other tasks...
        </p>
      ) : null}
    </div>
  );
}
