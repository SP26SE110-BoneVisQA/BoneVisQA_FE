import { authHeader, getResponse } from "@/lib/api/client";
import { getPublicApiOrigin } from "@/lib/api/client";

const API_BASE = () => `${getPublicApiOrigin()}/api/admin`;

export interface BoneSpecialtyDto {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  level: number;
  children: BoneSpecialtyDto[];
}

export interface BoneSpecialtyCreateDto {
  code: string;
  name: string;
  parentId?: string | null;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface BoneSpecialtyUpdateDto {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface BoneSpecialtyQueryParams {
  parentId?: string;
  isActive?: boolean;
  flat?: boolean;
}

const boneSpecialtyApi = {
  async getAll(params?: BoneSpecialtyQueryParams): Promise<BoneSpecialtyDto[]> {
    let url = `${API_BASE()}/bone-specialties`;
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.parentId) searchParams.append("parentId", params.parentId);
      if (params.isActive !== undefined) searchParams.append("isActive", String(params.isActive));
      if (params.flat !== undefined) searchParams.append("flat", String(params.flat));
    }
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
    const response = await fetch(url, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<BoneSpecialtyDto[]>(response);
  },

  async getTree(): Promise<BoneSpecialtyDto[]> {
    const response = await fetch(`${API_BASE()}/bone-specialties/tree`, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<BoneSpecialtyDto[]>(response);
  },

  async getById(id: string): Promise<BoneSpecialtyDto> {
    const response = await fetch(`${API_BASE()}/bone-specialties/${id}`, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<BoneSpecialtyDto>(response);
  },

  async create(dto: BoneSpecialtyCreateDto): Promise<BoneSpecialtyDto> {
    const response = await fetch(`${API_BASE()}/bone-specialties`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return getResponse<BoneSpecialtyDto>(response);
  },

  async update(dto: BoneSpecialtyUpdateDto): Promise<BoneSpecialtyDto> {
    const response = await fetch(`${API_BASE()}/bone-specialties`, {
      method: "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return getResponse<BoneSpecialtyDto>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE()}/bone-specialties/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    return getResponse<void>(response);
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const response = await fetch(
      `${API_BASE()}/bone-specialties/${id}/toggle?isActive=${isActive}`,
      {
        method: "PATCH",
        headers: authHeader(),
      }
    );
    return getResponse<void>(response);
  },

  async reorder(id: string, moveUp: boolean): Promise<void> {
    const response = await fetch(
      `${API_BASE()}/bone-specialties/${id}/reorder?moveUp=${moveUp}`,
      {
        method: "PATCH",
        headers: authHeader(),
      }
    );
    return getResponse<void>(response);
  },
};

export default boneSpecialtyApi;
