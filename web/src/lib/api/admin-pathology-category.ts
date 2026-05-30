import { authHeader, getResponse } from "@/lib/api/client";
import { getPublicApiOrigin } from "@/lib/api/client";

const API_BASE = () => `${getPublicApiOrigin()}/api/admin`;

export interface PathologyCategoryDto {
  id: string;
  code: string;
  name: string;
  boneSpecialtyId: string | null;
  boneSpecialtyName: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PathologyCategoryCreateDto {
  code: string;
  name: string;
  boneSpecialtyId?: string | null;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface PathologyCategoryUpdateDto {
  id: string;
  code: string;
  name: string;
  boneSpecialtyId?: string | null;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface PathologyCategoryQueryParams {
  boneSpecialtyId?: string;
  isActive?: boolean;
}

const pathologyCategoryApi = {
  async getAll(params?: PathologyCategoryQueryParams): Promise<PathologyCategoryDto[]> {
    let url = `${API_BASE()}/pathology-categories`;
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.boneSpecialtyId) searchParams.append("boneSpecialtyId", params.boneSpecialtyId);
      if (params.isActive !== undefined) searchParams.append("isActive", String(params.isActive));
    }
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
    const response = await fetch(url, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<PathologyCategoryDto[]>(response);
  },

  async getById(id: string): Promise<PathologyCategoryDto> {
    const response = await fetch(`${API_BASE()}/pathology-categories/${id}`, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<PathologyCategoryDto>(response);
  },

  async create(dto: PathologyCategoryCreateDto): Promise<PathologyCategoryDto> {
    const response = await fetch(`${API_BASE()}/pathology-categories`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return getResponse<PathologyCategoryDto>(response);
  },

  async update(dto: PathologyCategoryUpdateDto): Promise<PathologyCategoryDto> {
    const response = await fetch(`${API_BASE()}/pathology-categories`, {
      method: "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return getResponse<PathologyCategoryDto>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE()}/pathology-categories/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    return getResponse<void>(response);
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const response = await fetch(
      `${API_BASE()}/pathology-categories/${id}/toggle?isActive=${isActive}`,
      {
        method: "PATCH",
        headers: authHeader(),
      }
    );
    return getResponse<void>(response);
  },
};

export default pathologyCategoryApi;
