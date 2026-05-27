import axios from 'axios';
import { http, getApiErrorMessage } from './client';

export type CaseDifficulty = 'Easy' | 'Medium' | 'Hard';
/** Aligns with workbench cards: draft (inactive), pending, approved, rejected. */
export type CaseStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** Values stored in DB (`medical_images.modality` CHECK); BE normalizer maps aliases to these. */
export const DB_IMAGE_MODALITIES = ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Other'] as const;
export type DbImageModality = (typeof DB_IMAGE_MODALITIES)[number];

export interface ExpertCaseTag {
  id: string;
  name: string;
}

export interface ExpertCase {
  id: string;
  createdByExpertId: string;
  categoryId: string;
  title: string;
  categoryName: string;
  difficulty: CaseDifficulty;
  status: CaseStatus;
  isApproved: boolean;
  isActive: boolean;
  addedBy: string;
  expertName: string;
  addedDate: string;
  boneLocation: string;
  description: string;
  suggestedDiagnosis: string;
  reflectiveQuestions: string;
  keyFindings: string;
  medicalImages?: ExpertCaseMedicalImageJson[];
  tags?: ExpertCaseTag[];
  /** Direct thumbnail URL from backend (list view) */
  thumbnailUrl?: string;
}

export function formatCaseDateForDisplay(raw: string | undefined | null): string {
  if (raw == null || !String(raw).trim()) return '—';
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw).trim();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface ExpertCaseListResponse {
  items?: unknown[];
}

interface ExpertCaseApiRow {
  id?: unknown;
  createdByExpertId?: unknown;
  categoryId?: unknown;
  /** Some backends may use snake_case / different casing */
  category_id?: unknown;
  categoryID?: unknown;
  /** Some backends return category as nested object */
  category?: unknown;
  title?: unknown;
  expertName?: unknown;
  difficulty?: unknown;
  categoryName?: unknown;
  category_name?: unknown;
  /** Alternative field names */
  caseTitle?: unknown;
  isApproved?: unknown;
  approved?: unknown;
  isActive?: unknown;
  active?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  description?: unknown;
  suggestedDiagnosis?: unknown;
  reflectiveQuestions?: unknown;
  keyFindings?: unknown;
  boneLocation?: unknown;
  BoneLocation?: unknown;
  status?: unknown;
  Status?: unknown;
  medicalImages?: unknown;
  MedicalImages?: unknown;
  tags?: unknown;
  Tags?: unknown;
  thumbnailUrl?: unknown;
  ThumbnailUrl?: unknown;
}

function mapDifficulty(raw: unknown): CaseDifficulty {
  const val = String(raw ?? '').toLowerCase();
  if (val === 'hard' || val === 'advanced') return 'Hard';
  if (val === 'medium' || val === 'intermediate') return 'Medium';
  return 'Easy';
}

function mapCaseListStatus(item: ExpertCaseApiRow, record: Record<string, unknown>): CaseStatus {
  const s = String(item.status ?? record.status ?? record.Status ?? '').toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'pending') return 'pending';
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  const approved = Boolean(
    item.isApproved ?? item.approved ?? record.isApproved ?? record.approved ?? record.IsApproved,
  );
  const active = Boolean(item.isActive ?? item.active ?? record.isActive ?? record.active ?? record.IsActive);
  if (approved) return 'approved';
  if (active) return 'pending';
  return 'draft';
}

function mapTags(raw: unknown): ExpertCaseTag[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExpertCaseTag[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const name = String(o.name ?? o.Name ?? o.tagName ?? o.TagName ?? '').trim() || 'Tag';
    const id = String(o.id ?? o.Id ?? '').trim() || `tag-${i}-${name}`;
    out.push({ id, name });
  }
  return out.length ? out : undefined;
}

function mapMedicalImagesRaw(raw: unknown): ExpertCaseMedicalImageJson[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExpertCaseMedicalImageJson[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : o.Id != null ? String(o.Id) : o.imageId != null ? String(o.imageId) : o.ImageId != null ? String(o.ImageId) : undefined;
    
    // Support multiple URL field names
    const imageUrl = String(
      o.imageUrl ?? o.ImageUrl ?? o.url ?? o.Url ?? o.URL ?? o.src ?? o.Src ?? o.path ?? o.Path ?? o.filePath ?? o.FilePath ?? ''
    );
    if (!imageUrl.trim()) continue;
    
    const label = o.label ?? o.Label ?? o.fileName ?? o.FileName ?? o.name ?? o.Name ?? null;
    const modality = o.modality ?? o.Modality;
    const annRaw = o.annotations ?? o.Annotations;
    let annotations: ExpertCaseMedicalImageAnnotationJson[] | null = null;
    if (Array.isArray(annRaw)) {
      annotations = annRaw
        .map((a) => {
          if (!a || typeof a !== 'object') return null;
          const ar = a as Record<string, unknown>;
          const lab = String(ar.label ?? ar.Label ?? '').trim();
          const coordinates = String(ar.coordinates ?? ar.Coordinates ?? '{}');
          const ann: ExpertCaseMedicalImageAnnotationJson = lab
            ? { label: lab, coordinates }
            : { coordinates };
          return ann;
        })
        .filter((x): x is ExpertCaseMedicalImageAnnotationJson => x != null);
    }
    out.push({
      ...(id !== undefined ? { id } : {}),
      imageUrl,
      label: label != null ? String(label) : undefined,
      modality: modality != null ? String(modality) : undefined,
      annotations,
    });
  }
  return out.length ? out : undefined;
}

/** Maps BE medical case DTOs (expert list/detail, admin list/detail) to `ExpertCase`. */
export function mapCase(row: unknown): ExpertCase | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as ExpertCaseApiRow;
  const record = row as Record<string, unknown>;

  const id = String(
    item.id ??
      item.caseTitle ??
      record.caseId ??
      record.Id ??
      record.ID ??
      '',
  );
  if (!id) return null;

  const categoryFromNested =
    item.category && typeof item.category === 'object'
      ? (item.category as Record<string, unknown>)
      : null;

  const categoryFromNestedId =
    categoryFromNested?.id ?? categoryFromNested?.Id ?? categoryFromNested?.categoryId ?? categoryFromNested?.CategoryId;
  const categoryFromNestedName =
    categoryFromNested?.name ??
    categoryFromNested?.Name ??
    categoryFromNested?.categoryName ??
    categoryFromNested?.CategoryName ??
    categoryFromNested?.title ??
    categoryFromNested?.Title;

  const categoryIdRaw =
    item.categoryId ??
    item.category_id ??
    item.categoryID ??
    (record as Record<string, unknown>).CategoryId ??
    (record as Record<string, unknown>).CategoryID ??
    (record as Record<string, unknown>).categoryId ??
    (record as Record<string, unknown>).categoryID ??
    categoryFromNested?.id ??
    categoryFromNested?.categoryId ??
    categoryFromNested?.categoryID ??
    categoryFromNestedId ??
    record.categoryId;

  const categoryNameRaw =
    item.categoryName ??
    item.category_name ??
    categoryFromNested?.name ??
    categoryFromNested?.title ??
    (categoryFromNested as Record<string, unknown> | null | undefined)?.categoryName ??
    (categoryFromNested as Record<string, unknown> | null | undefined)?.category_name ??
    categoryFromNestedName ??
    (record as Record<string, unknown>).CategoryName ??
    (record as Record<string, unknown>).categoryName ??
    record.categoryName ??
    'General';

  const expertNameRaw = String(
    item.expertName ?? record.expertName ?? record.ExpertName ?? record.addedBy ?? record.AddedBy ?? '',
  ).trim();
  const addedByDisplay = expertNameRaw || '—';

  const boneRaw = String(
    item.boneLocation ?? item.BoneLocation ?? record.boneLocation ?? record.BoneLocation ?? '',
  ).trim();

  const createdRaw = String(
    item.createdAt ?? item.created_at ?? record.CreatedAt ?? record.createdAt ?? record.addedDate ?? '',
  );

  const medicalImages = mapMedicalImagesRaw(
    item.medicalImages ?? item.MedicalImages ?? 
    record.medicalImages ?? record.MedicalImages ??
    record.images ?? record.Images ?? record.Image ?? record.image
  );
  const tags = mapTags(item.tags ?? item.Tags ?? record.tags ?? record.Tags);
  
  // Get thumbnail URL directly (for list view)
  const thumbnailUrlRaw = String(
    item.thumbnailUrl ?? item.ThumbnailUrl ?? record.thumbnailUrl ?? record.ThumbnailUrl ?? record.thumbnail ?? ''
  ).trim();

  return {
    id,
    createdByExpertId: String(
      item.createdByExpertId ?? record.createdByExpertId ?? record.CreatedByExpertId ?? '',
    ),
    categoryId: String(categoryIdRaw ?? ''),
    title: String(item.title ?? item.caseTitle ?? record.title ?? record.Title ?? 'Untitled case'),
    categoryName: String(categoryNameRaw),
    difficulty: mapDifficulty(item.difficulty ?? record.caseDifficulty ?? record.difficulty ?? record.Difficulty),
    status: mapCaseListStatus(item, record),
    isApproved: Boolean(item.isApproved ?? item.approved ?? record.isApproved ?? record.approved ?? record.IsApproved),
    isActive: Boolean(item.isActive ?? item.active ?? record.isActive ?? record.active ?? record.IsActive),
    addedBy: addedByDisplay,
    expertName: addedByDisplay,
    addedDate: createdRaw,
    boneLocation: boneRaw || '—',
    description: String(item.description ?? ''),
    suggestedDiagnosis: String(item.suggestedDiagnosis ?? record.suggested_diagnosis ?? record.SuggestedDiagnosis ?? ''),
    reflectiveQuestions: String(
      item.reflectiveQuestions ?? record.reflective_questions ?? record.ReflectiveQuestions ?? '',
    ),
    keyFindings: String(item.keyFindings ?? record.key_findings ?? record.KeyFindings ?? ''),
    medicalImages,
    tags,
    thumbnailUrl: thumbnailUrlRaw || undefined,
  };
}

export interface ExpertCasePagedResponse {
  items: ExpertCase[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export async function fetchExpertCasesPaged(pageIndex = 1, pageSize = 5): Promise<ExpertCasePagedResponse> {
  try {
    const { data } = await http.get<any>(`/api/expert/cases?pageIndex=${pageIndex}&pageSize=${pageSize}`);
    const itemsRaw = data?.items ?? data?.result?.items ?? [];
    const items = Array.isArray(itemsRaw) ? itemsRaw.map(mapCase).filter((item): item is ExpertCase => item !== null) : [];
    return {
      items,
      totalCount: Number(data?.totalCount ?? data?.result?.totalCount ?? items.length),
      pageIndex: Number(data?.pageIndex ?? data?.result?.pageIndex ?? pageIndex),
      pageSize: Number(data?.pageSize ?? data?.result?.pageSize ?? pageSize),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface ExpertCategory {
  id: string;
  name: string;
}

async function getExpertListPayload(primaryPath: string, fallbackPath: string): Promise<unknown> {
  try {
    const { data } = await http.get<any>(primaryPath);
    return data;
  } catch {
    const { data } = await http.get<any>(fallbackPath);
    return data;
  }
}

export async function fetchExpertCategories(): Promise<ExpertCategory[]> {
  try {
    const data = await getExpertListPayload(
      `/api/expert/category?pageIndex=1&pageSize=100`,
      `/api/categories?pageIndex=1&pageSize=100`,
    );
    const listRaw = (data as any)?.items ?? (data as any)?.result?.items ?? data;
    const list = Array.isArray(listRaw) ? listRaw : [];
    return list.map((c: any) => ({
      id: String(c.id ?? c.Id ?? ''),
      name: String(c.name ?? c.Name ?? c.categoryName ?? c.CategoryName ?? 'Unknown'),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface SaveExpertCaseInput {
  title: string;
  createdByExpertId: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  isApproved: boolean;
  isActive: boolean;
  categoryId: string;
  suggestedDiagnosis: string;
  reflectiveQuestions: string;
  keyFindings: string;
  /** When set, replaces tags on the case (same idea as create). */
  tagIds?: string[] | null;
}

/** Backend `CreateExpertMedicalCaseJsonRequest` — JSON POST /api/expert/cases (expert from JWT). */
export interface ExpertCaseMedicalImageAnnotationJson {
  /** Optional; when omitted BE may persist finding text for NOT NULL column. */
  label?: string | null;
  /** Normalized axis-aligned box JSON: `{"x","y","width","height"}` each 0–1 (same as Visual QA ROI). */
  coordinates: string;
}

export interface ExpertCaseMedicalImageJson {
  id?: string;
  imageUrl: string;
  label?: string | null;
  modality?: string | null;
  annotations?: ExpertCaseMedicalImageAnnotationJson[] | null;
}

export interface CreateExpertCaseJsonInput {
  title: string;
  description: string;
  difficulty?: string | null;
  categoryId?: string | null;
  suggestedDiagnosis?: string | null;
  reflectiveQuestions?: string | null;
  keyFindings?: string | null;
  tagIds?: string[] | null;
  medicalImages?: ExpertCaseMedicalImageJson[] | null;
}

function parseCreatedCaseId(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string' && data.trim()) return data.trim();
  const row = data as Record<string, unknown>;
  const nested = row.result as Record<string, unknown> | undefined;
  const id =
    row.caseId ??
    row.CaseId ??
    row.id ??
    row.Id ??
    nested?.id ??
    nested?.Id ??
    nested?.caseId ??
    nested?.CaseId;
  return id != null && String(id).trim() ? String(id) : undefined;
}

/** Creates a case via `application/json` (public image URLs + polygon coordinates). */
export async function createExpertCase(input: CreateExpertCaseJsonInput): Promise<string | undefined> {
  try {
    const { data } = await http.post<unknown>('/api/expert/cases', input, {
      headers: { 'Content-Type': 'application/json' },
    });
    return parseCreatedCaseId(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function fetchExpertCase(id: string): Promise<ExpertCase> {
  try {
    const { data } = await http.get<unknown>(`/api/expert/cases/${id}`);
    const row =
      data && typeof data === 'object' && 'result' in data
        ? (data as { result: unknown }).result
        : data;
    const mapped = mapCase(row);
    if (!mapped) throw new Error('Case not found or invalid response.');
    return mapped;
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateExpertCase(id: string, input: SaveExpertCaseInput): Promise<void> {
  try {
    const trimmedId = String(id).trim();
    if (!trimmedId) throw new Error('Missing case id.');
    /** Match `UpdateMedicalCaseDTORequest` — route is PUT `api/expert/cases/{id:guid}` (no duplicate id in path). */
    const body: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      categoryId: input.categoryId?.trim() || null,
      suggestedDiagnosis: input.suggestedDiagnosis?.trim() || null,
      reflectiveQuestions: input.reflectiveQuestions?.trim() || null,
      keyFindings: input.keyFindings?.trim() || null,
      isApproved: input.isApproved,
      isActive: input.isActive,
    };
    if (input.tagIds !== undefined) {
      body.tagIds = input.tagIds;
    }
    await http.request({
      method: 'PUT',
      url: `/api/expert/cases/${encodeURIComponent(trimmedId)}`,
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw e instanceof Error ? e : new Error(getApiErrorMessage(e));
  }
}

export async function approveExpertCase(id: string): Promise<ExpertCase> {
  try {
    const { data } = await http.patch<unknown>(`/api/expert/cases/${id}`, { isApproved: true });
    const row =
      data && typeof data === 'object' && 'result' in data
        ? (data as { result: unknown }).result
        : data;
    const mapped = mapCase(row);
    if (!mapped) throw new Error('Invalid case response from server');
    return mapped;
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw new Error(getApiErrorMessage(e));
  }
}

function messageFromDeleteResponse(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (typeof data !== 'object') return undefined;
  const row = data as Record<string, unknown>;
  const nested = row.result && typeof row.result === 'object' ? (row.result as Record<string, unknown>) : null;
  for (const src of [row, nested].filter(Boolean) as Record<string, unknown>[]) {
    for (const key of ['message', 'Message', 'detail', 'Detail', 'title', 'Title']) {
      const v = src[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export async function deleteExpertCase(id: string): Promise<{ message?: string }> {
  try {
    const trimmed = String(id).trim();
    if (!trimmed) throw new Error('Missing case id.');
    const { data } = await http.delete<unknown>(`/api/expert/cases/${encodeURIComponent(trimmed)}`);
    return { message: messageFromDeleteResponse(data) };
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw e instanceof Error ? e : new Error(getApiErrorMessage(e));
  }
}

// ==== Image & Annotation & Case Tag APIs ====

export async function createExpertImage(payload: FormData): Promise<{ id: string; imageUrl: string; modality: string; caseTitle: string }> {
  try {
    const { data } = await http.post('/api/expert/images', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return (data as any)?.result || data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createExpertAnnotation(payload: {
  imageId: string;
  coordinates: string;
  label?: string | null;
}): Promise<void> {
  try {
    const body: Record<string, string> = {
      imageId: payload.imageId.trim(),
      coordinates: payload.coordinates.trim(),
    };
    const lab = payload.label?.trim();
    if (lab) body.label = lab;
    await http.post('/api/expert/annotations', body);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function createExpertCaseTag(payload: { medicalCaseId: string; tagId: string }): Promise<void> {
  try {
    await http.post('/api/expert/case-tag', payload);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** Removes a tag from a case (`DELETE /api/expert/tags?caseId=&tagId=`). */
export async function deleteExpertCaseTag(payload: { caseId: string; tagId: string }): Promise<void> {
  const caseId = String(payload.caseId).trim();
  const tagId = String(payload.tagId).trim();
  if (!caseId || !tagId) throw new Error('Missing case id or tag id.');
  try {
    await http.delete(
      `/api/expert/tags?caseId=${encodeURIComponent(caseId)}&tagId=${encodeURIComponent(tagId)}`,
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface ExpertTag {
  id: string;
  name: string;
}

export async function fetchExpertTags(pageIndex = 1, pageSize = 100): Promise<ExpertTag[]> {
  try {
    const data = await getExpertListPayload(
      `/api/expert/tags?pageIndex=${pageIndex}&pageSize=${pageSize}`,
      `/api/expert/tag?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    );
    const listRaw = (data as any)?.items ?? (data as any)?.result?.items ?? data;
    const list = Array.isArray(listRaw) ? listRaw : [];
    return list.map((t: any) => ({
      id: String(t.id ?? t.Id ?? ''),
      name: String(t.name ?? t.Name ?? t.tagName ?? t.TagName ?? 'Unknown Tag'),
    }));
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface ExpertImageDto {
  id: string;
  caseId: string;
  imageUrl: string;
  fileName: string;
}

export interface ExpertImagePagedResponse {
  items: ExpertImageDto[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export async function fetchExpertImages(pageIndex = 1, pageSize = 100, caseId?: string): Promise<ExpertImagePagedResponse> {
  try {
    const data = await getExpertListPayload(
      `/api/expert/images?pageIndex=${pageIndex}&pageSize=${pageSize}`,
      `/api/expert/image?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    );
    const listRaw = (data as any)?.items ?? (data as any)?.result?.items ?? data;
    const list = Array.isArray(listRaw) ? listRaw : [];
    const items = list.map((i: any) => ({
      id: String(i.id ?? i.Id ?? ''),
      caseId: String(i.caseId ?? i.CaseId ?? ''),
      imageUrl: String(i.imageUrl ?? i.ImageUrl ?? ''),
      fileName: String(i.fileName ?? i.FileName ?? 'Unknown File'),
    }));
    const filteredItems = caseId ? items.filter((i) => i.caseId === caseId) : items;
    const d = data as Record<string, unknown>;
    const res = d?.result as Record<string, unknown> | undefined;
    return {
      items: filteredItems,
      totalCount: Number(d?.totalCount ?? res?.totalCount ?? filteredItems.length),
      pageIndex: Number(d?.pageIndex ?? res?.pageIndex ?? pageIndex),
      pageSize: Number(d?.pageSize ?? res?.pageSize ?? pageSize),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

export interface ExpertAnnotationDto {
  id: string;
  imageId: string;
  imageUrl: string;
  label: string;
  coordinates: string;
}

export interface ExpertAnnotationPagedResponse {
  items: ExpertAnnotationDto[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export async function fetchExpertAnnotations(pageIndex = 1, pageSize = 10, imageId?: string): Promise<ExpertAnnotationPagedResponse> {
  try {
    const data = await getExpertListPayload(
      `/api/expert/annotations?pageIndex=${pageIndex}&pageSize=${pageSize}`,
      `/api/expert/annotation?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    );
    const itemsRaw = (data as any)?.items ?? (data as any)?.result?.items ?? [];
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((a: any) => ({
          id: String(a.id ?? a.Id ?? ''),
          imageId: String(a.imageId ?? a.ImageId ?? ''),
          imageUrl: String(a.imageUrl ?? a.ImageUrl ?? ''),
          label: String(a.label ?? a.Label ?? ''),
          coordinates: String(a.coordinates ?? a.Coordinates ?? '{}'),
        }))
      : [];
    const filteredItems = imageId ? items.filter((a) => a.imageId === imageId) : items;
    const d = data as Record<string, unknown>;
    const res = d?.result as Record<string, unknown> | undefined;
    return {
      items: filteredItems,
      totalCount: Number(d?.totalCount ?? res?.totalCount ?? filteredItems.length),
      pageIndex: Number(d?.pageIndex ?? res?.pageIndex ?? pageIndex),
      pageSize: Number(d?.pageSize ?? res?.pageSize ?? pageSize),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Upload a new medical image for an expert case.
 * POST /api/expert/images (multipart/form-data)
 */
export async function createExpertCaseImage(
  caseId: string,
  file: File,
  modality?: string
): Promise<{ id: string; imageUrl: string; modality: string }> {
  const form = new FormData();
  form.append('CaseId', caseId);
  form.append('Image', file);
  if (modality && modality.trim()) {
    form.append('Modality', modality.trim());
  }

  try {
    const { data } = await http.post('/api/expert/images', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // Backend returns: { message, result: { id, imageUrl, modality, caseTitle, annotations } }
    const result = (data as any)?.result || data;
    return {
      id: String(result?.id ?? ''),
      imageUrl: String(result?.imageUrl ?? ''),
      modality: String(result?.modality ?? ''),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/**
 * Delete a medical image from an expert case.
 * DELETE /api/expert/images/{imageId}
 */
export async function deleteExpertCaseImage(imageId: string): Promise<void> {
  try {
    await http.delete(`/api/expert/images/${encodeURIComponent(imageId)}`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
