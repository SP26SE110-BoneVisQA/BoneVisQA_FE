'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignCasesToLecturerClass,
  assignQuizToLecturerClass,
  fetchAssignedCases,
  fetchAssignedQuizzes,
  fetchClassStudents,
  fetchLecturerCaseLibrary,
  fetchLecturerClassById,
  fetchLecturerClasses,
  fetchLecturerQuizLibrary,
  type AssignCasesPayload,
  type AssignQuizPayload,
} from '@/lib/api/lecturer-classes';
import { getClassAnnouncements } from '@/lib/api/lecturer';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerClasses() {
  return useQuery({
    queryKey: queryKeys.lecturer.classes(),
    queryFn: fetchLecturerClasses,
    staleTime: 30_000,
  });
}

export function useLecturerClassDetail(classId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.classDetail(classId),
    queryFn: () => fetchLecturerClassById(classId),
    enabled: Boolean(classId),
  });
}

export function useLecturerClassStudents(classId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.classStudents(classId),
    queryFn: () => fetchClassStudents(classId),
    enabled: Boolean(classId),
  });
}

export function useLecturerClassAssignedCases(classId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.classAssignedCases(classId),
    queryFn: () => fetchAssignedCases(classId),
    enabled: Boolean(classId),
  });
}

export function useLecturerClassAssignedQuizzes(classId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.classAssignedQuizzes(classId),
    queryFn: () => fetchAssignedQuizzes(classId),
    enabled: Boolean(classId),
  });
}

export function useLecturerClassAnnouncements(classId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.classAnnouncements(classId),
    queryFn: () => getClassAnnouncements(classId),
    enabled: Boolean(classId),
  });
}

export function useLecturerCaseLibrary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.lecturer.caseLibrary(),
    queryFn: fetchLecturerCaseLibrary,
    enabled,
    staleTime: 60_000,
  });
}

export function useLecturerQuizLibrary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.lecturer.quizLibrary(),
    queryFn: fetchLecturerQuizLibrary,
    enabled,
    staleTime: 60_000,
  });
}

export function useAssignCasesToClass(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignCasesPayload) => assignCasesToLecturerClass(classId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.classAssignedCases(classId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignments() });
    },
  });
}

export function useAssignQuizToClass(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignQuizPayload) => assignQuizToLecturerClass(classId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.classAssignedQuizzes(classId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignments() });
    },
  });
}
