'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addQuizQuestion,
  addQuizQuestionsBatched,
  assignQuizToClass,
  createQuiz,
  deleteQuiz,
  deleteQuizQuestion,
  getAssignedQuizzes,
  getClassQuizzes,
  getLecturerQuizzes,
  getMyQuizzesWithClasses,
  getQuiz,
  getQuizQuestions,
  getQuizzesByIds,
  getUnassignedLecturerQuizzes,
  removeQuizFromClass,
  updateQuiz,
  updateQuizQuestion,
} from '@/lib/api/lecturer-quiz';
import { fetchLecturerClasses } from '@/lib/api/lecturer-triage';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { queryKeys } from '@/lib/query-keys';

function readLecturerId(): string {
  return getStoredUserId();
}

export function useLecturerMyQuizzes() {
  const lecturerId = readLecturerId();
  return useQuery({
    queryKey: queryKeys.lecturer.myQuizzes(),
    queryFn: () => getMyQuizzesWithClasses(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerAssignedQuizzes() {
  const lecturerId = readLecturerId();
  return useQuery({
    queryKey: queryKeys.lecturer.assignedQuizzes(),
    queryFn: () => getAssignedQuizzes(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerQuizCatalog() {
  const lecturerId = readLecturerId();
  return useQuery({
    queryKey: queryKeys.lecturer.quizzes(),
    queryFn: () => getLecturerQuizzes(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerUnassignedQuizzes() {
  const lecturerId = readLecturerId();
  return useQuery({
    queryKey: [...queryKeys.lecturer.quizzes(), 'unassigned'] as const,
    queryFn: () => getUnassignedLecturerQuizzes(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerQuizDetail(quizId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.quizDetail(quizId),
    queryFn: () => getQuiz(quizId),
    enabled: Boolean(quizId),
  });
}

export function useLecturerQuizQuestions(quizId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.quizQuestions(quizId),
    queryFn: () => getQuizQuestions(quizId),
    enabled: Boolean(quizId),
  });
}

export function useLecturerQuizzesByIds(ids: string[]) {
  return useQuery({
    queryKey: [...queryKeys.lecturer.quizzes(), 'by-ids', ids] as const,
    queryFn: () => getQuizzesByIds(ids),
    enabled: ids.length > 0,
  });
}

export function useLecturerPortalClasses() {
  const lecturerId = getStoredUserId();
  return useQuery({
    queryKey: [...queryKeys.lecturer.classes(), lecturerId] as const,
    queryFn: () => fetchLecturerClasses(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 60_000,
  });
}

export function useClassQuizzes(classId: string) {
  return useQuery({
    queryKey: [...queryKeys.lecturer.quizzes(), 'class', classId] as const,
    queryFn: () => getClassQuizzes(classId),
    enabled: Boolean(classId),
  });
}

export function useCreateLecturerQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createQuiz,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.myQuizzes() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizzes() });
    },
  });
}

export function useUpdateLecturerQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateQuiz>[1] }) =>
      updateQuiz(id, body),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizDetail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.myQuizzes() });
    },
  });
}

export function useDeleteLecturerQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteQuiz,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.myQuizzes() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizzes() });
    },
  });
}

export function useAddQuizQuestionsBatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quizId,
      questions,
    }: {
      quizId: string;
      questions: Parameters<typeof addQuizQuestionsBatched>[1];
    }) => addQuizQuestionsBatched(quizId, questions),
    onSuccess: (_, { quizId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizQuestions(quizId) });
    },
  });
}

export function useAddQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addQuizQuestion,
    onSuccess: (result) => {
      const quizId = result?.quizId;
      if (quizId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizQuestions(quizId) });
      }
    },
  });
}

export function useUpdateQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      body,
      quizId,
    }: {
      questionId: string;
      body: Parameters<typeof updateQuizQuestion>[1];
      quizId: string;
    }) => updateQuizQuestion(questionId, body),
    onSuccess: (_, { quizId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizQuestions(quizId) });
    },
  });
}

export function useDeleteQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, quizId }: { questionId: string; quizId: string }) =>
      deleteQuizQuestion(questionId),
    onSuccess: (_, { quizId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.quizQuestions(quizId) });
    },
  });
}

export function useAssignQuizToClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, quizId }: { classId: string; quizId: string }) =>
      assignQuizToClass(classId, quizId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignedQuizzes() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignments() });
    },
  });
}

export function useRemoveQuizFromClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, quizId }: { classId: string; quizId: string }) =>
      removeQuizFromClass(classId, quizId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignedQuizzes() });
    },
  });
}
