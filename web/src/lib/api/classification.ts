import { authHeader, getResponse } from "@/lib/api/client";
import { getPublicApiOrigin } from "@/lib/api/client";

const API_BASE = () => `${getPublicApiOrigin()}/api/common`;

// DTO cho Bone Specialty Tree (hierarchical)
export interface BoneSpecialtyTreeDto {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  level: number;
  children: BoneSpecialtyTreeDto[];
}

// DTO cho Pathology Category (flat list)
export interface PathologyCategorySimpleDto {
  id: string;
  code: string;
  name: string;
  boneSpecialtyId: string | null;
  boneSpecialtyName: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}

const classificationApi = {
  /**
   * Lấy danh sách Bone Specialty dạng tree (hierarchical).
   * Dùng cho dropdown trong form Create/Edit Quiz.
   */
  async getBoneSpecialtiesTree(): Promise<BoneSpecialtyTreeDto[]> {
    const response = await fetch(`${API_BASE()}/classifications/bone-specialties/tree`, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<BoneSpecialtyTreeDto[]>(response);
  },

  /**
   * Lấy danh sách Pathology Category dạng flat list.
   * Dùng cho dropdown trong form Create/Edit Quiz.
   */
  async getPathologyCategories(): Promise<PathologyCategorySimpleDto[]> {
    const response = await fetch(`${API_BASE()}/classifications/pathology-categories`, {
      headers: { ...authHeader(), "Content-Type": "application/json" },
    });
    return getResponse<PathologyCategorySimpleDto[]>(response);
  },
};

export default classificationApi;
