'use client';

import axios from 'axios';
import { getApiErrorMessage, http } from './client';
import type {
  CaseDto,
  ClassCaseAssignmentDto,
  ClassItem,
  ClassQuizSessionDto,
  QuizDto,
  StudentEnrollment,
} from './types';

export class ForbiddenApiError extends Error {
  constructor(message = 'You are not allowed to access this resource.') {
    super(message);
    this.name = 'ForbiddenApiError';
  }
}

function throwApiError(error: unknown): never {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    throw new ForbiddenApiError(getApiErrorMessage(error));
  }
  throw new Error(getApiErrorMessage(error));
}

export type AssignCasesPayload = {
  caseIds: string[];
  dueDate?: string;
  isMandatory: boolean;
};

export type AssignQuizPayload = {
  quizId: string;
  openTime?: string;
  closeTime?: string;
  timeLimitMinutes?: number;
  passingScore?: number;
};

export async function fetchLecturerClasses(): Promise<ClassItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/lecturer/classes');
    return (Array.isArray(data) ? data : []).map(normalizeClassItem).filter((x): x is ClassItem => x !== null);
  } catch (error) {
    throwApiError(error);
  }
}

/** Normalize ClassDto (PascalCase from BE) to ClassItem (camelCase for FE). */
function normalizeClassItem(raw: unknown): ClassItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id) return null;

  return {
    id,
    className: String(r.className ?? r.ClassName ?? '').trim(),
    semester: String(r.semester ?? r.Semester ?? '').trim(),
    lecturerId: String(r.lecturerId ?? r.LecturerId ?? '').trim(),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? '').trim(),
    expertId: (typeof r.expertId === 'object' && r.expertId !== null) ? null : ((r.expertId ?? r.ExpertId) as string | null),
    expertName: (typeof r.expertName === 'object' && r.expertName !== null) ? null : ((r.expertName ?? r.ExpertName) as string | null),
  };
}

export async function fetchLecturerClassById(classId: string): Promise<ClassItem> {
  try {
    const { data } = await http.get<ClassItem>(`/api/lecturer/classes/${classId}`);
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function fetchClassStudents(classId: string): Promise<StudentEnrollment[]> {
  try {
    const { data } = await http.get<StudentEnrollment[]>(`/api/lecturer/classes/${classId}/students`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throwApiError(error);
  }
}

export async function assignCasesToLecturerClass(
  classId: string,
  payload: AssignCasesPayload,
): Promise<ClassCaseAssignmentDto[]> {
  try {
    const { data } = await http.post<ClassCaseAssignmentDto[]>(
      `/api/lecturer/classes/${classId}/assignments/cases`,
      payload
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throwApiError(error);
  }
}

export async function assignQuizToLecturerClass(
  classId: string,
  payload: AssignQuizPayload,
): Promise<ClassQuizSessionDto> {
  try {
    const { data } = await http.post<ClassQuizSessionDto>(
      `/api/lecturer/classes/${classId}/assignments/quizzes`,
      payload
    );
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function fetchAssignedCases(classId: string): Promise<CaseDto[]> {
  try {
    const { data } = await http.get<unknown>(`/api/lecturer/classes/${classId}/assignments/cases`);
    const items = Array.isArray(data) ? data : [];
    // Map response to CaseDto for compatibility with the UI
    return items.map((item: Record<string, unknown>) => ({
      id: String(item.caseId ?? item.CaseId ?? item.caseID ?? ''),
      title: (item.caseTitle ?? item.CaseTitle ?? item.title ?? item.Title ?? null) as string | null,
      description: (item.caseDescription ?? item.Description ?? null) as string | null,
      categoryName: (item.categoryName ?? item.CategoryName ?? null) as string | null,
      difficulty: (item.difficulty ?? item.Difficulty ?? null) as string | null,
      imageUrl: (item.imageUrl ?? item.ImageUrl ?? null) as string | null,
      isActive: true,
      isApproved: true,
      createdAt:
        item.createdAt != null
          ? String(item.createdAt)
          : item.CreatedAt != null
            ? String(item.CreatedAt)
            : item.assignedAt != null
              ? String(item.assignedAt)
              : null,
    }));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throwApiError(error);
  }
}

export async function fetchAssignedQuizzes(classId: string): Promise<QuizDto[]> {
  try {
    const { data } = await http.get<QuizDto[]>(`/api/lecturer/classes/${classId}/quizzes`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throwApiError(error);
  }
}

export async function fetchLecturerCaseLibrary(): Promise<CaseDto[]> {
  try {
    const { data } = await http.get<CaseDto[]>('/api/lecturer/cases');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throwApiError(error);
  }
}

export async function fetchLecturerQuizLibrary(): Promise<QuizDto[]> {
  try {
    const { data } = await http.get<QuizDto[]>('/api/lecturer/quizzes');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throwApiError(error);
  }
}
