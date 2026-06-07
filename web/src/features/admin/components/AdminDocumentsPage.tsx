'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminDocumentsUploadModal from '@/components/admin/documents/AdminDocumentsUploadModal';
import AdminDocumentReplaceFileModal from '@/components/admin/documents/AdminDocumentReplaceFileModal';
import { ListPageLayout } from '@/components/layouts';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAdminDocumentsColumns } from '@/features/admin/components/tables/admin-documents-columns';
import {
  useAdminDocumentMeta,
  useAdminDocuments,
  useInvalidateAdminDocuments,
} from '@/features/admin/queries/use-admin-documents';
import {
  documentListHasProcessing,
  documentListNeedsActivePolling,
  fetchDocumentStatus,
  normalizeIndexingStatus,
} from '@/lib/api/admin-documents';
import { resolveApiAssetUrl, withVersionedAssetUrl } from '@/lib/api/client';
import type { DocumentIngestionStatusDto, DocumentStatusResponse } from '@/lib/api/types';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { FileText, Plus, Search } from 'lucide-react';

export function AdminDocumentsPage() {
  const router = useRouter();
  const invalidateDocuments = useInvalidateAdminDocuments();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statusByDocId, setStatusByDocId] = useState<Record<string, DocumentStatusResponse>>({});
  const [replaceTarget, setReplaceTarget] = useState<{ id: string; title: string } | null>(null);
  const [openingReplaceId, setOpeningReplaceId] = useState<string | null>(null);

  const metaQuery = useAdminDocumentMeta();
  const documentsQuery = useAdminDocuments({
    search: search.trim() || undefined,
    categoryId: categoryFilter || undefined,
    indexingStatus: statusFilter || undefined,
  });

  const documents = documentsQuery.data ?? [];
  const categories = metaQuery.data?.categories ?? [];
  const tags = metaQuery.data?.tags ?? [];

  useEffect(() => {
    const onIndexing = (event: Event) => {
      const custom = event as CustomEvent<DocumentIngestionStatusDto>;
      const payload = custom.detail;
      if (payload?.documentId) {
        setStatusByDocId((prev) => {
          const existing = prev[payload.documentId];
          return {
            ...prev,
            [payload.documentId]: {
              status: payload.status ?? existing?.status ?? 'Processing',
              progressPercentage:
                payload.progressPercentage ?? existing?.progressPercentage ?? 0,
              currentOperation: payload.operation ?? existing?.currentOperation ?? null,
              currentPageIndexing:
                payload.currentPageIndexing ?? existing?.currentPageIndexing ?? 0,
              totalPages: payload.totalPages ?? existing?.totalPages ?? 0,
              totalChunks: payload.totalChunks ?? existing?.totalChunks ?? 0,
              chunksProcessed: payload.chunksProcessed ?? existing?.chunksProcessed ?? 0,
              indexingPhase: payload.indexingPhase ?? existing?.indexingPhase ?? 0,
              phaseLabel: payload.phaseLabel ?? payload.phase ?? existing?.phaseLabel ?? null,
              errorMessage: payload.errorMessage ?? existing?.errorMessage ?? null,
            },
          };
        });
      }
      invalidateDocuments();
    };
    window.addEventListener('DocumentIndexingProgressUpdated', onIndexing);
    return () => window.removeEventListener('DocumentIndexingProgressUpdated', onIndexing);
  }, [invalidateDocuments]);

  useEffect(() => {
    const activeIds = documents
      .filter((d) => {
        const n = normalizeIndexingStatus(d.indexingStatus);
        return n === 'pending' || n === 'processing';
      })
      .map((d) => d.id)
      .filter(Boolean);
    if (activeIds.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      await Promise.all(
        activeIds.map(async (docId) => {
          try {
            const s = await fetchDocumentStatus(docId);
            if (!cancelled) setStatusByDocId((prev) => ({ ...prev, [docId]: s }));
          } catch {
            /* transient */
          }
        }),
      );
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [documents]);

  const pollActive = useMemo(() => documentListNeedsActivePolling(documents), [documents]);
  const hasProcessing = useMemo(() => documentListHasProcessing(documents), [documents]);
  const effectiveStatusByDocId = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of documents) {
      map.set(d.id, statusByDocId[d.id]?.status ?? d.indexingStatus);
    }
    return map;
  }, [documents, statusByDocId]);
  const hasAnyProcessingLive = useMemo(
    () =>
      Array.from(effectiveStatusByDocId.values()).some(
        (status) => normalizeIndexingStatus(status) === 'processing',
      ),
    [effectiveStatusByDocId],
  );

  const sectionDescription = useMemo(() => {
    if (!pollActive) return 'No active indexing jobs. Refreshes run on user actions or after uploads.';
    if (hasProcessing) {
      return 'List refreshes every 3 seconds while documents are processing.';
    }
    return 'List refreshes every 5 seconds while documents are pending.';
  }, [pollActive, hasProcessing]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const columns = useMemo(
    () =>
      buildAdminDocumentsColumns({
        categoryNameById,
        statusByDocId,
        effectiveStatusByDocId,
        hasAnyProcessingLive,
        openingReplaceId,
        onDetails: (id) => router.push(`/admin/documents/${id}`),
        onReplace: (doc) => {
          setOpeningReplaceId(doc.id);
          setReplaceTarget({ id: doc.id, title: doc.title });
          window.setTimeout(() => setOpeningReplaceId((prev) => (prev === doc.id ? null : prev)), 350);
        },
        onOpenFile: (doc) => {
          const href = withVersionedAssetUrl(resolveApiAssetUrl(doc.filePath), doc.version);
          window.open(href, '_blank', 'noopener,noreferrer');
        },
      }),
    [
      categoryNameById,
      statusByDocId,
      effectiveStatusByDocId,
      hasAnyProcessingLive,
      openingReplaceId,
      router,
    ],
  );

  const errorMessage = documentsQuery.error
    ? getQueryErrorMessage(documentsQuery.error, 'Unable to load document list.')
    : null;

  return (
    <>
      <ListPageLayout
        title="Knowledge base"
        isLoading={documentsQuery.isPending && !documents.length}
        error={errorMessage}
        skeletonVariant="list"
        maxWidthClass="max-w-6xl"
        actions={
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        }
        toolbar={
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-4 text-sm text-muted-foreground">{sectionDescription}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                disabled={metaQuery.isPending}
                className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              >
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>
        }
      >
        <DataTable
          columns={columns}
          data={documents}
          pageSize={12}
          isLoading={documentsQuery.isPending}
          emptyIcon={<FileText className="h-6 w-6 text-primary" />}
          emptyTitle="No matching documents"
          emptyDescription="Try changing filters or upload a new file."
        />
      </ListPageLayout>

      <AdminDocumentsUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => invalidateDocuments()}
        categories={categories}
        tags={tags}
        loadingMeta={metaQuery.isPending}
      />

      <AdminDocumentReplaceFileModal
        open={replaceTarget != null}
        documentId={replaceTarget?.id ?? ''}
        documentTitle={replaceTarget?.title ?? ''}
        onClose={() => setReplaceTarget(null)}
        onSuccess={() => invalidateDocuments()}
      />
    </>
  );
}
