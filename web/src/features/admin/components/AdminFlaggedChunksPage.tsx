'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListPageLayout } from '@/components/layouts';
import { SectionCard } from '@/components/shared/SectionCard';
import { Button } from '@/components/ui/button';
import {
  useAdminFlaggedChunks,
  useResolveFlaggedChunk,
} from '@/features/admin/queries/use-admin-flagged-chunks';
import { appToast } from '@/lib/api/errors/app-toast';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

export function AdminFlaggedChunksPage() {
  const chunksQuery = useAdminFlaggedChunks();
  const resolveMutation = useResolveFlaggedChunk();
  const rows = chunksQuery.data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);

  const errorMessage = chunksQuery.error
    ? getQueryErrorMessage(chunksQuery.error, 'Failed to load flagged chunks.')
    : null;

  const markResolved = async (chunkId: string) => {
    setBusyId(chunkId);
    try {
      await resolveMutation.mutateAsync({ chunkId, resolved: true });
      appToast.success('Marked as resolved.');
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : 'Update failed.');
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
        Expert flags are created from{' '}
        <Link href="/expert/reviews" className="font-medium text-primary underline underline-offset-2">
          Expert review
        </Link>
        .
      </p>

      <SectionCard title="Queue" className="mt-6">
        {rows.length === 0 && !chunksQuery.isPending ? (
          <div className="space-y-4 py-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              No flagged chunks in the queue.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.chunkId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">{row.documentTitle || 'Document'}</p>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{row.contentPreview || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Flagged by {row.flaggedBy || 'Expert'} ·{' '}
                    {row.flaggedAt ? new Date(row.flaggedAt).toLocaleString('en-GB') : '—'}
                  </p>
                  {row.documentId ? (
                    <Link
                      href={`/admin/documents/${row.documentId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      View document <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === row.chunkId || row.flagResolved === true}
                  onClick={() => void markResolved(row.chunkId)}
                >
                  {busyId === row.chunkId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : row.flagResolved ? (
                    'Resolved'
                  ) : (
                    'Mark resolved'
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </ListPageLayout>
  );
}
