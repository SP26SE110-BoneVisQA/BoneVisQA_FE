'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssignedQuizzes } from '@/lib/api/student';
import type { AssignedQuizItem } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';

function sortAssignedQuizzes(data: AssignedQuizItem[]): AssignedQuizItem[] {
  return [...data].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return a.quizId.localeCompare(b.quizId);
  });
}

export function useStudentAssignedQuizzes() {
  return useQuery({
    queryKey: queryKeys.student.assignedQuizzes(),
    queryFn: async () => sortAssignedQuizzes(await getAssignedQuizzes()),
  });
}
