import { http } from './client';

export interface ClassExpertAssignmentDto {
  id: string;
  classId: string;
  className: string | null;
  expertId: string;
  expertName: string | null;
  boneSpecialtyId: string;
  boneSpecialtyName: string | null;
  roleInClass: string;
  assignedAt: string | null;
  isActive: boolean;
}

export interface ClassExpertAssignmentCreateDto {
  classId: string;
  expertId: string;
  boneSpecialtyId: string;
  roleInClass?: string;
}

export interface ClassExpertAssignmentUpdateDto {
  id: string;
  roleInClass?: string;
  isActive?: boolean;
}

export const classExpertAssignmentApi = {
  // Lấy danh sách Expert trong một lớp
  getByClass: async (classId: string): Promise<ClassExpertAssignmentDto[]> => {
    const response = await http.get<ClassExpertAssignmentDto[]>(`/class-expert-assignments/class/${classId}`);
    return response.data;
  },

  // Lấy danh sách lớp của một Expert
  getByExpert: async (expertId: string): Promise<ClassExpertAssignmentDto[]> => {
    const response = await http.get<ClassExpertAssignmentDto[]>(`/class-expert-assignments/expert/${expertId}`);
    return response.data;
  },

  // Lấy chi tiết một assignment
  getById: async (id: string): Promise<ClassExpertAssignmentDto> => {
    const response = await http.get<ClassExpertAssignmentDto>(`/class-expert-assignments/${id}`);
    return response.data;
  },

  // Gán Expert vào lớp
  create: async (data: ClassExpertAssignmentCreateDto): Promise<ClassExpertAssignmentDto> => {
    const response = await http.post<ClassExpertAssignmentDto>('/class-expert-assignments', data);
    return response.data;
  },

  // Cập nhật assignment
  update: async (data: ClassExpertAssignmentUpdateDto): Promise<ClassExpertAssignmentDto> => {
    const response = await http.put<ClassExpertAssignmentDto>('/class-expert-assignments', data);
    return response.data;
  },

  // Xóa assignment (soft delete)
  delete: async (id: string): Promise<void> => {
    await http.delete(`/class-expert-assignments/${id}`);
  },
};
