'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  allowRetakeAll,
  allowRetakeForAttempt,
  exportQuizResultsExcel,
  getClassQuizAttempts,
  getQuizAttemptDetail,
  updateQuizAttempt,
} from '@/lib/api/lecturer';
import { queryKeys } from '@/lib/query-keys';

export function useClassQuizAttempts(classId: string, quizId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.quizResults(quizId),
    queryFn: () => getClassQuizAttempts(classId, quizId),
    enabled: Boolean(classId && quizId),
    staleTime: 60_000, // 60 seconds - reduce unnecessary refetches
  });
}

export function useQuizAttemptDetail(classId: string, quizId: string, attemptId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.quizAttempt(quizId, attemptId),
    queryFn: () => getQuizAttemptDetail(classId, quizId, attemptId),
    enabled: Boolean(classId && quizId && attemptId),
  });
}

export function useUpdateQuizAttempt(classId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      body,
    }: {
      attemptId: string;
      body: Parameters<typeof updateQuizAttempt>[3];
    }) => updateQuizAttempt(classId, quizId, attemptId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizResults(quizId) });
    },
  });
}

export function useAllowQuizRetake(classId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) => allowRetakeForAttempt(classId, quizId, attemptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizResults(quizId) });
    },
  });
}

export function useAllowQuizRetakeAll(classId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => allowRetakeAll(classId, quizId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizResults(quizId) });
    },
  });
}

export function useExportQuizResults(classId: string, quizId: string) {
  return useMutation({
    mutationFn: () => exportQuizResultsExcel(classId, quizId),
  });
}
