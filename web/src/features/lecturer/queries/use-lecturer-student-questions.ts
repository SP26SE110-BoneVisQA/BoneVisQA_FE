'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStudentQuestions } from '@/lib/api/lecturer';
import { escalateToExpert } from '@/lib/api/lecturer-triage';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerStudentQuestions(
  classId: string,
  source?: 'all' | 'visual-qa' | 'case-qa',
) {
  return useQuery({
    queryKey: [...queryKeys.lecturer.all, 'student-questions', classId, source ?? 'legacy'] as const,
    queryFn: () =>
      getStudentQuestions(classId, source ? { source } : {}),
    enabled: Boolean(classId),
    staleTime: 15_000,
  });
}

export function useEscalateStudentQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answerId: string) => escalateToExpert(answerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.lecturer.all, 'student-questions'],
      });
    },
  });
}
