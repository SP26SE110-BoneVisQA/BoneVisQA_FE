'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDocumentStatus,
  getDocuments,
  getAdminDocumentById,
  normalizeIndexingStatus,
  reindexAdminDocument,
  type AdminDocumentDetail,
  type NormalizedIndexingStatus,
} from '@/lib/api/admin-documents';
import { resolveApiAssetUrl, withVersionedAssetUrl } from '@/lib/api/client';
import type { DocumentIngestionStatusDto } from '@/lib/api/types';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog';
import { appToast } from '@/lib/api/errors/app-toast';
import { toast } from 'sonner';
import AdminDocumentReplaceFileModal from './AdminDocumentReplaceFileModal';
import type { DocumentIndexingPhase } from '@/lib/api/types';
import {
  computePhaseBars,
  INDEXING_PHASE_STEPS,
  phaseBarValue,
  type IndexingPhaseKey,
} from './documentIndexingPhases';

type IngestionSnapshot = {
  status?: string;
  currentPageIndexing?: number;
  totalPages?: number;
  totalChunks?: number;
  chunksProcessed?: number;
  currentOperation?: string;
  progressPercentage?: number;
  indexingPhase?: DocumentIndexingPhase | 0;
  phaseLabel?: string;
  phaseHint?: string;
  errorMessage?: string;
  source: 'rest' | 'signalr';
};

function asNonNegInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

function asProgressPct(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value));
}

function mergeIndexingPhase(
  next?: DocumentIndexingPhase | 0,
  prev?: DocumentIndexingPhase | 0,
): DocumentIndexingPhase | 0 | undefined {
  if (next != null && next >= 1 && next <= 5) return next;
  if (prev != null && prev >= 1 && prev <= 5) return prev;
  return next ?? prev;
}

function mergeIngestionFields(
  prev: IngestionSnapshot | null,
  next: Omit<IngestionSnapshot, 'source'> & { source: IngestionSnapshot['source'] },
): IngestionSnapshot {
  const nextNorm = normalizeIndexingStatus(next.status);
  const mergedError =
    nextNorm === 'failed' ? next.errorMessage ?? prev?.errorMessage : undefined;

  return {
    source: next.source,
    status: next.status ?? prev?.status,
    currentPageIndexing: next.currentPageIndexing ?? prev?.currentPageIndexing,
    totalPages: next.totalPages ?? prev?.totalPages,
    totalChunks: next.totalChunks ?? prev?.totalChunks,
    chunksProcessed: next.chunksProcessed ?? prev?.chunksProcessed,
    currentOperation: next.currentOperation ?? prev?.currentOperation,
    progressPercentage: asProgressPct(next.progressPercentage) ?? prev?.progressPercentage,
    indexingPhase: mergeIndexingPhase(next.indexingPhase, prev?.indexingPhase),
    phaseLabel: next.phaseLabel ?? prev?.phaseLabel,
    phaseHint: next.phaseHint ?? prev?.phaseHint,
    errorMessage: mergedError,
  };
}

function bumpDocumentVersion(
  prev: AdminDocumentDetail | null,
  fetched: AdminDocumentDetail,
): AdminDocumentDetail {
  if (!prev) return { ...fetched, isOutdated: false };
  const prevVer = Number(prev.version);
  const fetchedVer = Number(fetched.version);
  const nextVersion =
    Number.isFinite(prevVer) && (!Number.isFinite(fetchedVer) || fetchedVer <= prevVer)
      ? String(prevVer + 1)
      : fetched.version;
  return { ...fetched, version: nextVersion, isOutdated: false };
}

export default function DocumentDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<AdminDocumentDetail | null>(null);
  const [liveStatus, setLiveStatus] = useState<IngestionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOtherProcessingTask, setHasOtherProcessingTask] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceModalAction, setReplaceModalAction] = useState<'replace' | 'reindex'>('replace');
  const [retryBusy, setRetryBusy] = useState(false);
  const [reindexConfirmOpen, setReindexConfirmOpen] = useState(false);
  const prevIndexingStatusRef = useRef<NormalizedIndexingStatus>('unknown');

  const applyIngestionSnapshot = useCallback(
    (next: Omit<IngestionSnapshot, 'source'> & { source: IngestionSnapshot['source'] }) => {
      setLiveStatus((prev) => {
        const nextNorm = normalizeIndexingStatus(next.status);
        const prevNorm = prev ? normalizeIndexingStatus(prev.status) : null;

        if (!prev) {
          const initial = mergeIngestionFields(null, next);
          if (nextNorm === 'completed') {
            return {
              ...initial,
              currentOperation: undefined,
              errorMessage: next.errorMessage?.trim() ? next.errorMessage : undefined,
              progressPercentage: asProgressPct(next.progressPercentage) ?? 100,
            };
          }
          return initial;
        }

        const prevCur = asNonNegInt(prev.currentPageIndexing) ?? 0;
        const nextCur = asNonNegInt(next.currentPageIndexing) ?? 0;

        if (prevNorm === 'completed' && nextNorm !== 'failed' && next.source === 'signalr') {
          return prev;
        }

        let merged = mergeIngestionFields(prev, next);

        if (next.source === 'rest' && prev.source === 'signalr' && prevCur > nextCur) {
          merged = {
            ...merged,
            currentPageIndexing: prev.currentPageIndexing,
            source: prev.source,
          };
        }

        if (next.source === 'signalr' && nextCur < prevCur) {
          merged = {
            ...merged,
            currentPageIndexing: prev.currentPageIndexing,
          };
        }

        if (nextNorm === 'completed') {
          return {
            ...merged,
            currentOperation: undefined,
            errorMessage: next.errorMessage?.trim() ? next.errorMessage : undefined,
            progressPercentage: asProgressPct(next.progressPercentage) ?? merged.progressPercentage ?? 100,
          };
        }

        return merged;
      });
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    const fetchInitialState = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, status] = await Promise.all([getAdminDocumentById(id), fetchDocumentStatus(id)]);
        if (disposed) return;
        setDoc(data);
        applyIngestionSnapshot({
          source: 'rest',
          status: status.status || data.indexingStatus,
          currentPageIndexing: status.currentPageIndexing ?? data.currentPageIndexing,
          totalPages: status.totalPages ?? data.totalPages,
          totalChunks: status.totalChunks,
          chunksProcessed: status.chunksProcessed,
          currentOperation: status.currentOperation ?? undefined,
          progressPercentage: status.progressPercentage,
          indexingPhase: status.indexingPhase,
          phaseLabel: status.phaseLabel ?? undefined,
          errorMessage: status.errorMessage ?? undefined,
        });
      } catch (err: unknown) {
        if (disposed) return;
        const msg = err instanceof Error ? err.message : 'Failed to load document details';
        toast.error(msg);
        setError(msg);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void fetchInitialState();
    return () => {
      disposed = true;
    };
  }, [applyIngestionSnapshot, id]);

  const effectiveStatus = useMemo(() => {
    const live = liveStatus?.status ?? doc?.indexingStatus;
    const docNorm = normalizeIndexingStatus(doc?.indexingStatus);
    const liveNorm = normalizeIndexingStatus(live);
    if (docNorm === 'completed' && liveNorm === 'failed') return doc?.indexingStatus;
    if (docNorm === 'failed' && liveNorm === 'completed') return doc?.indexingStatus;
    return live;
  }, [doc?.indexingStatus, liveStatus?.status]);
  const isReindexingStatus = (effectiveStatus ?? '').toLowerCase().includes('reindex');
  const normalizedStatus: NormalizedIndexingStatus = useMemo(
    () => normalizeIndexingStatus(effectiveStatus),
    [effectiveStatus],
  );

  const displayCurrentOperation = useMemo(() => {
    if (normalizedStatus === 'completed' || normalizedStatus === 'failed') return null;
    const op = liveStatus?.currentOperation?.trim();
    if (!op) return null;
    if (op.toLowerCase() === 'failed.' || op.toLowerCase() === 'failed') return null;
    return op;
  }, [liveStatus?.currentOperation, normalizedStatus]);

  useEffect(() => {
    if (!doc || (normalizedStatus !== 'pending' && normalizedStatus !== 'processing')) return;
    let disposed = false;
    const run = async () => {
      try {
        const status = await fetchDocumentStatus(id);
        if (disposed) return;
        applyIngestionSnapshot({
          source: 'rest',
          status: status.status,
          currentPageIndexing: status.currentPageIndexing,
          totalPages: status.totalPages,
          totalChunks: status.totalChunks,
          chunksProcessed: status.chunksProcessed,
          currentOperation: status.currentOperation ?? undefined,
          progressPercentage: status.progressPercentage,
          indexingPhase: status.indexingPhase,
          phaseLabel: status.phaseLabel ?? undefined,
          errorMessage: status.errorMessage ?? undefined,
        });
        setDoc((prev) =>
          prev
            ? {
                ...prev,
                indexingStatus: status.status || prev.indexingStatus,
                currentPageIndexing: status.currentPageIndexing ?? prev.currentPageIndexing,
                totalPages: status.totalPages ?? prev.totalPages,
                indexingProgressPercentage:
                  status.progressPercentage ?? prev.indexingProgressPercentage,
              }
            : prev,
        );
      } catch {
        // transient poll failure — keep UI stable
      }
    };

    void run();
    const timer = window.setInterval(run, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [applyIngestionSnapshot, doc, id, normalizedStatus]);

  useEffect(() => {
    const prev = prevIndexingStatusRef.current;
    prevIndexingStatusRef.current = normalizedStatus;
    if (prev === normalizedStatus || normalizedStatus !== 'completed') return;
    void getAdminDocumentById(id).then((data) => {
      setDoc((prevDoc) => bumpDocumentVersion(prevDoc, data));
    });
  }, [id, normalizedStatus]);

  useEffect(() => {
    const onRealtimeProgress = (event: Event) => {
      const custom = event as CustomEvent<DocumentIngestionStatusDto>;
      const payload = custom.detail;
      if (!payload || (payload.documentId && payload.documentId !== id)) return;
      applyIngestionSnapshot({
        source: 'signalr',
        status: payload.status,
        currentPageIndexing: asNonNegInt(payload.currentPageIndexing),
        totalPages: asNonNegInt(payload.totalPages),
        totalChunks: asNonNegInt(payload.totalChunks),
        chunksProcessed: asNonNegInt(payload.chunksProcessed),
        currentOperation: payload.operation,
        progressPercentage: asProgressPct(payload.progressPercentage),
        indexingPhase: payload.indexingPhase,
        phaseLabel: payload.phaseLabel ?? payload.phase,
        phaseHint: payload.phase,
        errorMessage: payload.errorMessage,
      });
    };

    window.addEventListener('DocumentIndexingProgressUpdated', onRealtimeProgress as EventListener);
    return () => {
      window.removeEventListener(
        'DocumentIndexingProgressUpdated',
        onRealtimeProgress as EventListener,
      );
    };
  }, [applyIngestionSnapshot, id]);

  useEffect(() => {
    if (!doc || normalizedStatus !== 'pending') {
      setHasOtherProcessingTask(false);
      return;
    }
    let disposed = false;
    const run = async () => {
      try {
        const processingDocs = await getDocuments({ indexingStatus: 'Processing' });
        if (disposed) return;
        setHasOtherProcessingTask(processingDocs.some((item) => item.id !== id));
      } catch {
        if (!disposed) setHasOtherProcessingTask(false);
      }
    };

    void run();
    const timer = window.setInterval(run, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [doc, id, normalizedStatus]);

  const fileOpenHref = useMemo(() => {
    if (!doc?.filePath) return '';
    return withVersionedAssetUrl(resolveApiAssetUrl(doc.filePath), doc.version);
  }, [doc?.filePath, doc?.version]);

  const interactionLocked = normalizedStatus === 'pending' || normalizedStatus === 'processing';
  const totalPages = liveStatus?.totalPages ?? doc?.totalPages ?? 0;

  const overallProgress = Math.min(
    100,
    Math.max(
      0,
      liveStatus?.progressPercentage ?? doc?.indexingProgressPercentage ?? 0,
    ),
  );

  const phaseModel = useMemo(() => {
    return computePhaseBars({
      normalized: normalizedStatus,
      indexingPhase: liveStatus?.indexingPhase,
      operation: liveStatus?.currentOperation,
      phaseHint: liveStatus?.phaseHint ?? liveStatus?.phaseLabel,
      progressPercentage: overallProgress,
    });
  }, [
    normalizedStatus,
    liveStatus?.indexingPhase,
    liveStatus?.currentOperation,
    liveStatus?.phaseHint,
    liveStatus?.phaseLabel,
    overallProgress,
  ]);

  const technicalErrorMessage = liveStatus?.errorMessage?.trim() || null;

  const handleRetryIndexing = async () => {
    setRetryBusy(true);
    try {
      await appToast.promise(
        (async () => {
          await reindexAdminDocument(id);
          applyIngestionSnapshot({
            source: 'rest',
            status: 'Processing',
            currentPageIndexing: 0,
            totalPages: liveStatus?.totalPages ?? doc?.totalPages,
            totalChunks: 0,
            currentOperation: 'Re-index requested…',
            progressPercentage: 0,
            errorMessage: undefined,
          });
          setDoc((prev) =>
            prev
              ? {
                  ...prev,
                  indexingStatus: 'Processing',
                  currentPageIndexing: 0,
                }
              : prev,
          );
          const [data, status] = await Promise.all([
            getAdminDocumentById(id),
            fetchDocumentStatus(id),
          ]);
          setDoc((prevDoc) => bumpDocumentVersion(prevDoc, data));
          applyIngestionSnapshot({
            source: 'rest',
            status: status.status || data.indexingStatus,
            currentPageIndexing: status.currentPageIndexing ?? data.currentPageIndexing,
            totalPages: status.totalPages ?? data.totalPages,
            totalChunks: status.totalChunks,
            chunksProcessed: status.chunksProcessed,
            currentOperation: status.currentOperation ?? undefined,
            progressPercentage: status.progressPercentage,
            indexingPhase: status.indexingPhase,
            phaseLabel: status.phaseLabel ?? undefined,
            errorMessage: undefined,
          });
        })(),
        {
          loading: 'Indexing document…',
          success: 'Re-indexing started successfully.',
          error: 'Could not start re-indexing.',
        },
      );
    } finally {
      setRetryBusy(false);
      setReindexConfirmOpen(false);
    }
  };

  const centerStatusUi = (() => {
    if (normalizedStatus === 'unknown') {
      return {
        title: 'Status',
        icon: <Clock className="h-14 w-14 text-slate-400" />,
        subtitle:
          'Waiting for the server to report indexing status. Refresh or reopen if this persists.',
      };
    }
    if (normalizedStatus === 'completed') {
      return {
        title: 'Completed',
        icon: <CheckCircle2 className="h-14 w-14 text-emerald-600" />,
        subtitle: 'Document indexing is complete and ready for use.',
      };
    }
    if (normalizedStatus === 'failed') {
      return {
        title: 'Failed',
        icon: <XCircle className="h-14 w-14 text-red-600" />,
        subtitle: 'The latest indexing run failed. Review the message below or retry.',
      };
    }
    return {
      title: isReindexingStatus ? 'Reindexing' : 'Processing',
      icon: <RefreshCw className="h-14 w-14 animate-spin text-sky-600" />,
      subtitle: isReindexingStatus
        ? 'Refreshing the document index with the latest file revision.'
        : 'Indexing pipeline is currently running.',
    };
  })();

  const barVariantFor = (
    phase: IndexingPhaseKey,
  ): 'default' | 'success' | 'destructive' => {
    if (normalizedStatus === 'failed' && phaseModel.failedPhase === phase) return 'destructive';
    if (normalizedStatus === 'completed') return 'success';
    return 'default';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white py-32 shadow-sm mt-8">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <p className="animate-pulse text-lg font-medium text-gray-500">Loading document details...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 py-32">
        <AlertCircle className="mb-6 h-16 w-16 text-red-500" />
        <h3 className="mb-3 text-2xl font-bold text-gray-900">Document Not Found</h3>
        <p className="mb-8 max-w-md text-center text-lg text-red-500">
          {error ||
            'The requested document could not be found or you do not have permission to view it.'}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-500">
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="border-b border-gray-100 p-8 sm:p-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div className="flex gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {doc.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-500">
                  <span className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(doc.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1">
                    <Layers className="h-4 w-4" />
                    Version {doc.version}
                  </span>
                  {doc.categoryName ? (
                    <span className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1">
                      <FolderOpen className="h-4 w-4" />
                      Category: {doc.categoryName}
                    </span>
                  ) : null}
                </div>
                {normalizedStatus === 'pending' && hasOtherProcessingTask ? (
                  <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-50 px-3 py-2">
                    <p className="text-xs font-medium text-sky-800">
                      In Queue: Waiting for other tasks...
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3">
              {doc.isOutdated ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                  Outdated Content
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-gray-50/50 p-8 sm:p-10">
          <div className="mx-auto flex w-full max-w-none flex-col items-center">
            <div className="w-full space-y-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-gray-100 bg-gray-50 shadow-inner">
                {centerStatusUi.icon}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">{centerStatusUi.title}</h3>
                <p className="mx-auto max-w-md font-medium text-gray-500">{centerStatusUi.subtitle}</p>
              </div>

              <Card className="w-full border-sky-200/80 bg-sky-50/40 text-left shadow-none">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-base text-sky-950">RAG ingestion pipeline</CardTitle>
                  <CardDescription className="text-sky-900/80">
                    Download PDF → extract text → chunk &amp; persist → enrich metadata → generate embeddings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-h-[320px] space-y-5 pt-0">
                  {(normalizedStatus === 'processing' || normalizedStatus === 'pending') && (
                    <div className="space-y-2 rounded-lg border border-sky-200/70 bg-white/70 px-3 py-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-sky-950">
                        <span>Overall progress</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(overallProgress)}%
                        </span>
                      </div>
                      <Progress value={overallProgress} />
                    </div>
                  )}

                  {INDEXING_PHASE_STEPS.map(({ key, label, phase }) => {
                    const pct = phaseBarValue(phaseModel, key);
                    const isActiveChunkPhase =
                      (phase === 4 || phase === 5) &&
                      phaseModel.activePhaseNumber === phase &&
                      (normalizedStatus === 'processing' || normalizedStatus === 'pending');

                    return (
                      <div
                        key={key}
                        className={cn(
                          'space-y-2 rounded-lg px-1 py-0.5 transition-colors',
                          phaseModel.activePhase === key &&
                            (normalizedStatus === 'processing' || normalizedStatus === 'pending')
                            ? 'bg-sky-100/80 ring-1 ring-sky-300/60'
                            : undefined,
                        )}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-sky-950">
                          <span>{label}</span>
                          <span className="tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} variant={barVariantFor(key)} />
                        {isActiveChunkPhase && displayCurrentOperation ? (
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            {displayCurrentOperation}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}

                  {displayCurrentOperation &&
                  phaseModel.activePhaseNumber !== 4 &&
                  phaseModel.activePhaseNumber !== 5 ? (
                    <p className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Current operation: </span>
                      {displayCurrentOperation}
                    </p>
                  ) : normalizedStatus === 'completed' ? (
                    <p className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                      Indexing completed successfully.
                    </p>
                  ) : (
                    <p className="rounded-lg border border-transparent px-3 py-2 text-xs text-muted-foreground opacity-70">
                      Operation detail will appear here when the worker reports a step name.
                    </p>
                  )}
                </CardContent>
              </Card>

              {normalizedStatus === 'failed' ? (
                <div
                  role="alert"
                  className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive"
                >
                  <p className="font-semibold text-destructive">Indexing failed</p>
                  <p className="mt-1 text-destructive/90">
                    You can retry without re-uploading the file.
                  </p>
                  {technicalErrorMessage ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-destructive/90">
                      {technicalErrorMessage}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={retryBusy}
                      onClick={() => setReindexConfirmOpen(true)}
                      className="rounded-xl"
                    >
                      {retryBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Retry indexing
                    </Button>
                  </div>
                </div>
              ) : null}

              {normalizedStatus === 'completed' && technicalErrorMessage ? (
                <div className="w-full rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-left text-sm text-amber-950">
                  <p className="font-semibold text-amber-950">Last re-index attempt failed</p>
                  <p className="mt-1 text-amber-900/90">
                    The document remains available from the previous successful index. You can retry
                    re-indexing without uploading a new file.
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-destructive">
                    {technicalErrorMessage}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={retryBusy}
                      onClick={() => setReindexConfirmOpen(true)}
                      className="rounded-xl"
                    >
                      {retryBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Retry indexing
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex w-full flex-col flex-wrap items-center justify-center gap-4 pt-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={interactionLocked}
                  onClick={() => {
                    setReplaceModalAction('replace');
                    setReplaceOpen(true);
                  }}
                  className="w-full rounded-xl sm:w-auto"
                >
                  <RefreshCw className="h-5 w-5" />
                  Update/Manage Version
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={interactionLocked || !fileOpenHref}
                  onClick={() => {
                    if (!fileOpenHref) return;
                    window.open(fileOpenHref, '_blank', 'noopener,noreferrer');
                  }}
                  className="w-full rounded-xl sm:w-auto"
                >
                  <ExternalLink className="h-5 w-5" />
                  Open in New Tab
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={interactionLocked || !fileOpenHref}
                  onClick={() => {
                    if (!fileOpenHref) return;
                    window.open(fileOpenHref, '_blank', 'noopener,noreferrer');
                  }}
                  className="w-full rounded-xl sm:w-auto"
                >
                  <Download className="h-5 w-5" />
                  Download File
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminDocumentReplaceFileModal
        open={replaceOpen}
        defaultAction={replaceModalAction}
        documentId={doc.id}
        documentTitle={doc.title}
        onClose={() => setReplaceOpen(false)}
        onSuccess={(result) => {
          setReplaceOpen(false);
          const nextStatus = result.indexingStatus ?? 'Reindexing';
          setDoc((prev) =>
            prev
              ? {
                  ...prev,
                  indexingStatus: nextStatus,
                  currentPageIndexing: 0,
                  totalPages: prev.totalPages,
                  version:
                    replaceModalAction === 'reindex' && prev.version != null
                      ? String(Number(prev.version) + 1)
                      : prev.version,
                  isOutdated: false,
                }
              : prev,
          );
          applyIngestionSnapshot({
            source: 'rest',
            status: nextStatus,
            currentPageIndexing: 0,
            totalPages: liveStatus?.totalPages ?? doc.totalPages,
            totalChunks: liveStatus?.totalChunks,
            currentOperation: 'Re-analyzing Document...',
            errorMessage: undefined,
          });
          void (async () => {
            const [data, status] = await Promise.all([getAdminDocumentById(id), fetchDocumentStatus(id)]);
            setDoc((prevDoc) => bumpDocumentVersion(prevDoc, data));
          applyIngestionSnapshot({
            source: 'rest',
            status: status.status || data.indexingStatus,
            currentPageIndexing: status.currentPageIndexing ?? data.currentPageIndexing,
            totalPages: status.totalPages ?? data.totalPages,
            totalChunks: status.totalChunks,
            chunksProcessed: status.chunksProcessed,
            currentOperation: status.currentOperation ?? undefined,
            progressPercentage: status.progressPercentage,
            indexingPhase: status.indexingPhase,
            phaseLabel: status.phaseLabel ?? undefined,
            errorMessage: undefined,
          });
          })();
        }}
      />

      <DestructiveConfirmDialog
        open={reindexConfirmOpen}
        onOpenChange={setReindexConfirmOpen}
        title="Re-index this document?"
        description="This will re-process the current PDF, rebuild chunks, and re-run metadata/embedding enrichment. Existing vectors may be replaced."
        confirmLabel="Start re-indexing"
        destructive={false}
        isLoading={retryBusy}
        onConfirm={() => void handleRetryIndexing()}
      />
    </div>
  );
}
