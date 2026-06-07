import axios from 'axios';
import { getApiErrorMessage, http } from './client';
import {
  mapCase,
  type CreateExpertCaseJsonInput,
  type ExpertCase,
  type SaveExpertCaseInput,
} from './expert-cases';

import { inferCaseLibraryOrigin, type CaseLibraryOrigin } from '@/lib/case-origin';

export interface AdminCaseRow {
  id: string;
  title: string;
  boneLocation: string;
  lesionType: string;
  difficulty: string;
  caseOrigin: CaseLibraryOrigin;
  createdAt: string;
}

export interface AdminCasesPagedResponse {
  items: AdminCaseRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

/** BE list envelope: `{ message, data, result }` with `data` / `result` = `PagedResult<GetMedicalCaseDTO>`. */
function unwrapAdminPagedBody(payload: unknown): Record<string, unknown> {
  if (payload == null || typeof payload !== 'object') return {};
  const root = payload as Record<string, unknown>;
  const inner = (root.data ?? root.result ?? root) as Record<string, unknown>;
  return inner && typeof inner === 'object' ? inner : {};
}

function mapCaseRow(row: unknown): AdminCaseRow {
  const mapped = mapCase(row);
  if (mapped) {
    return {
      id: mapped.id,
      title: mapped.title,
      boneLocation: mapped.boneLocation || '—',
      lesionType: asString(
        (row as Record<string, unknown>).lesionType ??
          (row as Record<string, unknown>).LesionType ??
          (row as Record<string, unknown>).type ??
          (row as Record<string, unknown>).Type,
        '—',
      ),
      difficulty: mapped.difficulty,
      caseOrigin: mapped.caseOrigin,
      createdAt: mapped.addedDate || asString((row as Record<string, unknown>).createdAt ?? (row as Record<string, unknown>).CreatedAt, ''),
    };
  }
  const r = asRecord(row);
  return {
    id: asString(r.id ?? r.caseId ?? r.CaseId),
    title: asString(r.title ?? r.Title, 'Untitled case'),
    boneLocation: asString(r.boneLocation ?? r.location ?? r.BoneLocation ?? r.Location, 'Unknown'),
    lesionType: asString(r.lesionType ?? r.type ?? r.LesionType ?? r.Type, 'Unknown'),
    difficulty: asString(r.difficulty ?? r.Difficulty, 'Unknown'),
    caseOrigin: inferCaseLibraryOrigin(r),
    createdAt: asString(r.createdAt ?? r.uploadedAt ?? r.updatedAt ?? r.CreatedAt ?? r.UploadedAt, ''),
  };
}

export async function fetchAdminCasesPaged(
  pageIndex = 1,
  pageSize = 20,
): Promise<AdminCasesPagedResponse> {
  const pi = Math.max(1, Math.floor(pageIndex));
  const ps = Math.min(100, Math.max(1, Math.floor(pageSize)));
  try {
    const { data } = await http.get<unknown>('/api/admin/cases', {
      params: { pageIndex: pi, pageSize: ps },
    });
    const inner = unwrapAdminPagedBody(data);
    const itemsRaw = inner.items ?? inner.Items ?? [];
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map(mapCaseRow).filter((item) => item.id)
      : [];
    return {
      items,
      totalCount: Number(inner.totalCount ?? inner.TotalCount ?? items.length),
      pageIndex: Number(inner.pageIndex ?? inner.PageIndex ?? pi),
      pageSize: Number(inner.pageSize ?? inner.PageSize ?? ps),
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}

/** First page, up to 100 rows — for callers that expect a flat array. */
export async function fetchAdminCases(): Promise<AdminCaseRow[]> {
  const res = await fetchAdminCasesPaged(1, 100);
  return res.items;
}

function unwrapAdminDetailPayload(payload: unknown): unknown {
  if (payload == null) return payload;
  if (typeof payload !== 'object') return payload;
  const row = payload as Record<string, unknown>;
  return row.data ?? row.result ?? payload;
}

export async function fetchAdminCaseDetail(id: string): Promise<ExpertCase> {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) throw new Error('Case id is required.');
  try {
    const { data } = await http.get<unknown>(`/api/admin/cases/${encodeURIComponent(trimmed)}`);
    const row = unwrapAdminDetailPayload(data);
    const mapped = mapCase(row);
    if (!mapped) throw new Error('Case not found or invalid response.');
    return mapped;
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw new Error(getApiErrorMessage(e));
  }
}

export async function updateAdminCase(id: string, input: SaveExpertCaseInput): Promise<void> {
  const trimmedId = String(id).trim();
  if (!trimmedId) throw new Error('Missing case id.');
  const body = {
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
  try {
    await http.request({
      method: 'PUT',
      url: `/api/admin/cases/${encodeURIComponent(trimmedId)}`,
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw e instanceof Error ? e : new Error(getApiErrorMessage(e));
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

export async function deleteAdminCase(id: string): Promise<{ message?: string }> {
  const trimmed = String(id).trim();
  if (!trimmed) throw new Error('Missing case id.');
  try {
    const { data } = await http.delete<unknown>(`/api/admin/cases/${encodeURIComponent(trimmed)}`);
    return { message: messageFromDeleteResponse(data) };
  } catch (e) {
    if (axios.isAxiosError(e)) throw e;
    throw e instanceof Error ? e : new Error(getApiErrorMessage(e));
  }
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

/** POST `/api/admin/cases?expertUserId={guid}` — admin acts on behalf of expert. */
export async function createAdminCase(
  expertUserId: string,
  input: CreateExpertCaseJsonInput,
): Promise<string | undefined> {
  const expert = String(expertUserId ?? '').trim();
  if (!expert) throw new Error('expertUserId is required for admin case creation.');
  try {
    const { data } = await http.post<unknown>('/api/admin/cases', input, {
      params: { expertUserId: expert },
      headers: { 'Content-Type': 'application/json' },
    });
    return parseCreatedCaseId(data);
  } catch (e) {
    throw new Error(getApiErrorMessage(e));
  }
}
