'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExpertQuiz,
  deleteExpertQuiz,
  fetchExpertQuizzesPaged,
  updateExpertQuiz,
  type CreateExpertQuizRequest,
  type UpdateExpertQuizRequest,
} from '@/lib/api/expert-quizzes';
import { queryKeys } from '@/lib/query-keys';

export function useExpertQuizzes() {
  return useQuery({
    queryKey: queryKeys.expert.quizzes(),
    queryFn: () => fetchExpertQuizzesPaged(1, 500),
    staleTime: 30_000,
  });
}

export function useCreateExpertQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExpertQuizRequest) => createExpertQuiz(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.quizzes() });
    },
  });
}

export function useUpdateExpertQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateExpertQuizRequest }) =>
      updateExpertQuiz(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.quizzes() });
    },
  });
}

export function useDeleteExpertQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpertQuiz(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.quizzes() });
    },
  });
}
