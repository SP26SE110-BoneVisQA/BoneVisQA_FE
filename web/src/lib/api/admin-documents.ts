import { http, getApiErrorMessage } from './client';
import type {
  CategoryOption,
  DocumentStatusResponse,
  DocumentUploadRequest,
  DocumentUploadResponse,
  TagOption,
} from './types';

const ADMIN_DOCUMENTS = '/api/admin/documents';

export async function fetchDocumentCategories(): Promise<CategoryOption[]> {
  const { data } = await http.get<unknown[] | { items?: unknown[] }>(`${ADMIN_DOCUMENTS}/categories`);
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return list.map((row) => mapCategory(row));
}

export async function fetchDocumentTags(): Promise<TagOption[]> {
  const { data } = await http.get<unknown[] | { items?: unknown[] }>(`${ADMIN_DOCUMENTS}/tags`);
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return list.map((row) => mapTag(row));
}

function mapCategory(row: unknown): CategoryOption {
  if (row && typeof row === 'object') {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? r.categoryId ?? ''),
      name: String(r.name ?? r.title ?? ''),
    };
  }
  return { id: '', name: '' };
}

function mapTag(row: unknown): TagOption {
  if (row && typeof row === 'object') {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? r.tagId ?? ''),
      name: String(r.name ?? ''),
    };
  }
  return { id: '', name: '' };
}

export interface UploadDocumentParams extends DocumentUploadRequest {
  file: File;
  onUploadProgress?: (percent: number) => void;
}

export async function uploadAdminDocument(
  params: UploadDocumentParams,
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append('file', params.file);
  form.append('title', (params.title ?? '').trim() || params.file.name);
  form.append('Title', (params.title ?? '').trim() || params.file.name);
  if (params.categoryId?.trim()) {
    form.append('categoryId', params.categoryId.trim());
    form.append('CategoryId', params.categoryId.trim());
  }
  if (params.modality?.trim()) {
    form.append('defaultModality', params.modality.trim());
    form.append('Modality', params.modality.trim());
  }
  if (params.defaultPathologyGroup?.trim()) {
    form.append('DefaultPathologyGroup', params.defaultPathologyGroup.trim());
  }
  params.tagIds.forEach((id) => {
    form.append('tagIds', id);
    form.append('TagIds', id);
  });

  try {
    const { data } = await http.post<Record<string, unknown>>(
      `${ADMIN_DOCUMENTS}/upload`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total && params.onUploadProgress) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            params.onUploadProgress(pct);
          }
        },
      },
    );
    return {
      documentId:
        typeof data.documentId === 'string'
          ? data.documentId
          : typeof data.id === 'string'
            ? data.id
            : undefined,
      indexingStatus: typeof data.indexingStatus === 'string' ? data.indexingStatus : undefined,
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface AdminDocumentDetail {
  id: string;
  title: string;
  createdAt: string;
  version?: string;
  categoryId?: string;
  categoryName?: string;
  indexingStatus: string;
  isOutdated?: boolean;
  filePath?: string;
  /** Page-level progress when API includes it on list/detail DTOs. */
  currentPageIndexing?: number;
  totalPages?: number;
  indexingProgressPercentage?: number;
}

export type DocumentDto = AdminDocumentDetail;

function optNonNegInt(v: unknown): number | undefined {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? parseInt(v, 10)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function optPct(v: unknown): number | undefined {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? parseFloat(v)
        : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

function mapAdminDocumentDetail(row: unknown): AdminDocumentDetail {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const curPage =
    optNonNegInt(r.currentPageIndexing) ??
    optNonNegInt(r.current_page_indexing) ??
    optNonNegInt(r.CurrentPageIndexing);
  const totPages =
    optNonNegInt(r.totalPages) ?? optNonNegInt(r.total_pages) ?? optNonNegInt(r.TotalPages);
  const idxPct =
    optPct(r.indexingProgress) ??
    optPct(r.indexing_progress) ??
    optPct(r.progressPercentage) ??
    optPct(r.progress_percentage);

  return {
    id: String(r.id ?? r.documentId ?? ''),
    title: String(r.title ?? r.fileName ?? r.name ?? ''),
    createdAt: String(r.createdAt ?? r.uploadedAt ?? new Date().toISOString()),
    version: r.version != null ? String(r.version) : undefined,
    categoryId: r.categoryId != null ? String(r.categoryId) : undefined,
    categoryName:
      r.categoryName != null
        ? String(r.categoryName)
        : r.category != null
          ? String(r.category)
          : undefined,
    indexingStatus: String(r.indexingStatus ?? r.status ?? 'Unknown'),
    isOutdated: Boolean(r.isOutdated ?? false),
    filePath:
      r.filePath != null
        ? String(r.filePath)
        : r.documentUrl != null
          ? String(r.documentUrl)
          : undefined,
    currentPageIndexing: curPage,
    totalPages: totPages,
    indexingProgressPercentage: idxPct,
  };
}

export async function getAdminDocumentById(id: string): Promise<AdminDocumentDetail> {
  try {
    const { data } = await http.get<unknown>(`${ADMIN_DOCUMENTS}/${id}`);
    return mapAdminDocumentDetail(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** Query params for GET /api/admin/documents — backend may ignore unsupported keys. */
export interface GetDocumentsFilters {
  search?: string;
  categoryId?: string;
  indexingStatus?: string;
  page?: number;
  pageSize?: number;
}

export async function getDocuments(filters?: GetDocumentsFilters): Promise<DocumentDto[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    if (filters?.categoryId?.trim()) params.set('categoryId', filters.categoryId.trim());
    if (filters?.indexingStatus?.trim()) params.set('indexingStatus', filters.indexingStatus.trim());
    if (filters?.page != null && filters.page > 0) params.set('page', String(filters.page));
    if (filters?.pageSize != null && filters.pageSize > 0) params.set('pageSize', String(filters.pageSize));
    const qs = params.toString();
    const url = qs ? `${ADMIN_DOCUMENTS}?${qs}` : ADMIN_DOCUMENTS;
    const { data } = await http.get<unknown>(url);
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? ((data as { items?: unknown[] }).items ?? [])
        : [];
    return list.map(mapAdminDocumentDetail);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** Same as {@link getDocuments} with no filters. */
export async function getAdminDocuments(): Promise<DocumentDto[]> {
  return getDocuments();
}

/** Multipart upload — alias for {@link uploadAdminDocument}. */
export const uploadDocument = uploadAdminDocument;

export interface UpdateDocumentPayload {
  title?: string;
  categoryId?: string;
  tagIds?: string[];
}

export async function updateDocument(id: string, payload: UpdateDocumentPayload): Promise<void> {
  try {
    await http.put(`${ADMIN_DOCUMENTS}/${id}`, payload);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Replace the stored PDF/file for a document (restarts chunking & indexing).
 * BE: PUT multipart — `/api/admin/documents/{id}/file` (adjust if your API uses another route).
 */
export async function replaceDocumentFile(
  documentId: string,
  file: File,
  onUploadProgress?: (percent: number) => void,
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await http.put<Record<string, unknown>>(`${ADMIN_DOCUMENTS}/${documentId}/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (ev) => {
        if (ev.total && onUploadProgress) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          onUploadProgress(pct);
        }
      },
    });
    return {
      documentId:
        typeof data.documentId === 'string'
          ? data.documentId
          : typeof data.id === 'string'
            ? data.id
            : documentId,
      indexingStatus: typeof data.indexingStatus === 'string' ? data.indexingStatus : undefined,
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function reindexAdminDocument(
  id: string,
): Promise<{ message?: string; indexingStatus?: string }> {
  try {
    const { data } = await http.post<{ message?: string; indexingStatus?: string }>(
      `${ADMIN_DOCUMENTS}/${id}/reindex`,
    );
    return data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface ReindexDocumentMetadataResponse {
  message?: string;
  chunksUpdated?: number;
}

/** Re-apply Tier-1 chunk metadata to an already-indexed document without re-uploading the PDF. */
export async function reindexDocumentMetadata(
  id: string,
): Promise<ReindexDocumentMetadataResponse> {
  try {
    const { data } = await http.post<ReindexDocumentMetadataResponse>(
      `${ADMIN_DOCUMENTS}/${id}/reindex-metadata`,
    );
    return data ?? {};
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

function mapDocumentStatus(row: unknown): DocumentStatusResponse {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const progressRaw = r.progressPercentage ?? r.progress ?? r.indexingProgress ?? 0;
  const progressParsed =
    typeof progressRaw === 'number'
      ? progressRaw
      : typeof progressRaw === 'string'
        ? parseFloat(progressRaw)
        : 0;
  const progressPercentage = Number.isFinite(progressParsed)
    ? Math.min(100, Math.max(0, progressParsed))
    : 0;

  const currentPageIndexing =
    optNonNegInt(r.currentPageIndexing) ??
    optNonNegInt(r.current_page_indexing) ??
    optNonNegInt(r.currentPage) ??
    optNonNegInt(r.current_page);
  const totalPages =
    optNonNegInt(r.totalPages) ?? optNonNegInt(r.total_pages) ?? optNonNegInt(r.pageCount);
  const totalChunks =
    optNonNegInt(r.totalChunks) ?? optNonNegInt(r.total_chunks) ?? optNonNegInt(r.chunkCount);

  return {
    status: String(r.status ?? r.indexingStatus ?? 'Unknown'),
    progressPercentage,
    currentOperation: String(r.currentOperation ?? r.operation ?? ''),
    currentPageIndexing,
    totalPages,
    totalChunks,
  };
}

export async function fetchDocumentStatus(id: string): Promise<DocumentStatusResponse> {
  try {
    const { data } = await http.get<unknown>(`${ADMIN_DOCUMENTS}/${id}/status`);
    return mapDocumentStatus(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface PendingProcessingDataRow {
  documentId: string;
  pendingChunkCount: number;
}

export interface PendingProcessingCleanupResult {
  deletedRows: number;
  message?: string;
}

function toInt(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return 0;
}

function mapPendingProcessingRow(row: unknown): PendingProcessingDataRow {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  return {
    documentId: String(r.documentId ?? r.DocumentId ?? r.id ?? ''),
    pendingChunkCount: toInt(r.pendingChunkCount ?? r.PendingChunkCount ?? r.count),
  };
}

export async function fetchPendingProcessingData(): Promise<PendingProcessingDataRow[]> {
  try {
    const { data } = await http.get<unknown>(`${ADMIN_DOCUMENTS}/ops/pending-chunks`);
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'items' in data
        ? (((data as { items?: unknown[] }).items ?? []) as unknown[])
        : [];
    return list.map(mapPendingProcessingRow).filter((row) => row.documentId);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function clearPendingProcessingData(): Promise<PendingProcessingCleanupResult> {
  try {
    const { data } = await http.delete<unknown>(`${ADMIN_DOCUMENTS}/ops/pending-chunks`);
    const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      deletedRows: toInt(r.deletedRows ?? r.DeletedRows ?? r.count),
      message: typeof r.message === 'string' ? r.message : undefined,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export type NormalizedIndexingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';

export function normalizeIndexingStatus(raw: string | undefined): NormalizedIndexingStatus {
  const s = (raw ?? '').trim().toLowerCase();
  if (['pending', 'queued'].includes(s)) return 'pending';
  if (['processing', 'indexing', 'reindexing', 're-indexing', 'reindex'].includes(s)) return 'processing';
  if (['completed', 'complete', 'success'].includes(s)) return 'completed';
  if (['failed', 'error'].includes(s)) return 'failed';
  return 'unknown';
}

/** True when list polling should run (Pending or Processing rows). */
export function documentListNeedsActivePolling(docs: Pick<DocumentDto, 'indexingStatus'>[]): boolean {
  return docs.some((d) => {
    const n = normalizeIndexingStatus(d.indexingStatus);
    return n === 'pending' || n === 'processing';
  });
}

export function documentListHasProcessing(docs: Pick<DocumentDto, 'indexingStatus'>[]): boolean {
  return docs.some((d) => normalizeIndexingStatus(d.indexingStatus) === 'processing');
}
