'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DocumentIndexingCell } from '@/components/admin/documents/DocumentIndexingCell';
import { Button } from '@/components/ui/button';
import { normalizeIndexingStatus, type DocumentDto } from '@/lib/api/admin-documents';
import type { DocumentStatusResponse } from '@/lib/api/types';
import { ExternalLink, FileText, FileUp, Loader2 } from 'lucide-react';

export function buildAdminDocumentsColumns(opts: {
  categoryNameById: Map<string, string>;
  statusByDocId: Record<string, DocumentStatusResponse>;
  effectiveStatusByDocId: Map<string, string>;
  hasAnyProcessingLive: boolean;
  openingReplaceId: string | null;
  onDetails: (id: string) => void;
  onReplace: (doc: DocumentDto) => void;
  onOpenFile: (doc: DocumentDto) => void;
}): ColumnDef<DocumentDto>[] {
  return [
    {
      id: 'document',
      header: 'Document',
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <Link
                href={`/admin/documents/${doc.id}`}
                className="block truncate font-semibold text-foreground hover:text-primary"
              >
                {doc.title}
              </Link>
              {doc.isOutdated ? (
                <span className="mt-1 inline-block rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  Outdated
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <span className="text-muted-foreground">
            {doc.categoryId ? opts.categoryNameById.get(doc.categoryId) ?? doc.categoryId : '—'}
          </span>
        );
      },
    },
    {
      id: 'indexing',
      header: 'Indexing',
      cell: ({ row }) => {
        const doc = row.original;
        const liveStatus =
          opts.effectiveStatusByDocId.get(doc.id) ??
          opts.statusByDocId[doc.id]?.status ??
          doc.indexingStatus;
        const normalized = normalizeIndexingStatus(liveStatus);
        const showQueueHint = normalized === 'pending' && opts.hasAnyProcessingLive;
        return (
          <DocumentIndexingCell
            doc={doc}
            statusDetail={opts.statusByDocId[doc.id] ?? null}
            showQueueHint={showQueueHint}
          />
        );
      },
    },
    {
      id: 'version',
      header: 'Version',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.version != null ? `v${row.original.version}` : '—'}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className="text-muted-foreground">
            {Number.isNaN(date.getTime()) ? row.original.createdAt : date.toLocaleString()}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: () => <span className="text-right">Actions</span>,
      cell: ({ row }) => {
        const doc = row.original;
        const liveStatus =
          opts.effectiveStatusByDocId.get(doc.id) ??
          opts.statusByDocId[doc.id]?.status ??
          doc.indexingStatus;
        const normalized = normalizeIndexingStatus(liveStatus);
        const interactionLocked = normalized === 'pending' || normalized === 'processing';
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={interactionLocked}
              onClick={() => opts.onDetails(doc.id)}
            >
              Details
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={interactionLocked || opts.openingReplaceId === doc.id}
              onClick={() => opts.onReplace(doc)}
            >
              {opts.openingReplaceId === doc.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="h-3.5 w-3.5" />
              )}
              Update
            </Button>
            {doc.filePath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={interactionLocked}
                onClick={() => opts.onOpenFile(doc)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}
