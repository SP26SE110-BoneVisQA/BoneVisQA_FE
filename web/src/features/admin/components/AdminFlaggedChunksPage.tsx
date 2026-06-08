'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ListPageLayout } from '@/components/layouts';
import { SectionCard } from '@/components/shared/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useAdminFlaggedChunks,
  useResolveFlaggedChunk,
} from '@/features/admin/queries/use-admin-flagged-chunks';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

function FlaggedChunkRow({
  row,
  busy,
  onAcknowledge,
}: {
  row: {
    chunkId: string;
    documentId?: string | null;
    documentTitle?: string | null;
    contentPreview: string;
    flagReason?: string | null;
    flaggedAt?: string | null;
    flaggedBy?: string | null;
    flagResolved?: boolean | null;
  };
  busy: boolean;
  onAcknowledge: (chunkId: string) => void;
}) {
  const acknowledged = row.flagResolved === true;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{row.documentTitle || 'Document'}</p>
          {acknowledged ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
              Acknowledged
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
              Pending
            </Badge>
          )}
        </div>
        <p className="line-clamp-4 text-sm text-muted-foreground">{row.contentPreview || '—'}</p>
        {row.flagReason?.trim() ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            <span className="font-semibold">Expert reason:</span> {row.flagReason.trim()}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Flagged by {row.flaggedBy || 'Expert'} ·{' '}
          {row.flaggedAt ? new Date(row.flaggedAt).toLocaleString('en-GB') : '—'}
        </p>
        {row.documentId ? (
          <Link
            href={`/admin/documents/${row.documentId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            View source document <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
      <div className="shrink-0">
        {acknowledged ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Notification received
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAcknowledge(row.chunkId)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark acknowledged'}
          </Button>
        )}
      </div>
    </li>
  );
}

export function AdminFlaggedChunksPage() {
  const chunksQuery = useAdminFlaggedChunks();
  const acknowledgeMutation = useResolveFlaggedChunk();
  const rows = chunksQuery.data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);

  const { pendingRows, acknowledgedRows } = useMemo(() => {
    const pending = rows.filter((row) => row.flagResolved !== true);
    const acknowledged = rows.filter((row) => row.flagResolved === true);
    return { pendingRows: pending, acknowledgedRows: acknowledged };
  }, [rows]);

  const errorMessage = chunksQuery.error
    ? getQueryErrorMessage(chunksQuery.error, 'Failed to load flagged chunks.')
    : null;

  const markAcknowledged = async (chunkId: string) => {
    setBusyId(chunkId);
    try {
      await acknowledgeMutation.mutateAsync({ chunkId, resolved: true });
      appToast.success('Marked as acknowledged.');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Could not update acknowledgment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListPageLayout
      title="Flagged RAG chunks"
      isLoading={chunksQuery.isPending}
      error={errorMessage}
      maxWidthClass="max-w-5xl"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={chunksQuery.isFetching}
          onClick={() => void chunksQuery.refetch()}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${chunksQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Read-only queue of RAG chunks flagged by experts from{' '}
        <Link href="/expert/reviews" className="font-medium text-primary underline underline-offset-2">
          Expert review
        </Link>
        . Use <strong>Mark acknowledged</strong> when you have seen the expert notification — no other edits
        are needed here.
      </p>

      <SectionCard title={`Pending acknowledgment (${pendingRows.length})`} className="mt-6">
        {pendingRows.length === 0 && !chunksQuery.isPending ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            No pending expert flags.
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingRows.map((row) => (
              <FlaggedChunkRow
                key={row.chunkId}
                row={row}
                busy={busyId === row.chunkId}
                onAcknowledge={(chunkId) => void markAcknowledged(chunkId)}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {acknowledgedRows.length > 0 ? (
        <SectionCard title={`Acknowledged (${acknowledgedRows.length})`} className="mt-6">
          <ul className="space-y-3">
            {acknowledgedRows.map((row) => (
              <FlaggedChunkRow
                key={row.chunkId}
                row={row}
                busy={false}
                onAcknowledge={() => {}}
              />
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </ListPageLayout>
  );
}
