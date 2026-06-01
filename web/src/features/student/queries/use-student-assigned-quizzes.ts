'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAssignedQuizzes } from '@/lib/api/student';
import type { AssignedQuizItem } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';

export interface AssignedQuizzesPageResult {
  items: AssignedQuizItem[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export interface UseStudentAssignedQuizzesOptions {
  pageIndex?: number;
  pageSize?: number;
  enabled?: boolean;
}

function sortAssignedQuizzes(data: AssignedQuizItem[]): AssignedQuizItem[] {
  return [...data].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return a.quizId.localeCompare(b.quizId);
  });
}

export function useStudentAssignedQuizzes(options: UseStudentAssignedQuizzesOptions = {}) {
  const { pageIndex = 0, pageSize = 10, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.student.assignedQuizzes({ pageIndex, pageSize }),
    queryFn: async () => {
      const result = await getAssignedQuizzes(pageIndex, pageSize);
      return {
        ...result,
        items: sortAssignedQuizzes(result.items),
      };
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}
