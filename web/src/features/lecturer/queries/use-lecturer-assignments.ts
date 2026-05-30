'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAssignment,
  getAllLecturerAssignments,
  getAssignmentById,
  getAssignmentSubmissions,
  updateAssignment,
  updateAssignmentSubmissions,
} from '@/lib/api/lecturer';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerAssignments() {
  const lecturerId = getStoredUserId();
  return useQuery({
    queryKey: queryKeys.lecturer.assignments(),
    queryFn: () => getAllLecturerAssignments(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerAssignmentDetail(assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.lecturer.assignmentDetail(assignmentId),
    queryFn: () => getAssignmentById(assignmentId),
    enabled: Boolean(assignmentId),
  });
}

export function useLecturerAssignmentSubmissions(assignmentId: string) {
  return useQuery({
    queryKey: [...queryKeys.lecturer.assignmentDetail(assignmentId), 'submissions'] as const,
    queryFn: () => getAssignmentSubmissions(assignmentId),
    enabled: Boolean(assignmentId),
  });
}

export function useUpdateLecturerAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateAssignment>[1] }) =>
      updateAssignment(id, body),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignmentDetail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignments() });
    },
  });
}

export function useDeleteLecturerAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.assignments() });
    },
  });
}

export function useUpdateAssignmentSubmissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      body,
    }: {
      assignmentId: string;
      body: Parameters<typeof updateAssignmentSubmissions>[1];
    }) => updateAssignmentSubmissions(assignmentId, body),
    onSuccess: (_, { assignmentId }) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.lecturer.assignmentDetail(assignmentId), 'submissions'] as const,
      });
    },
  });
}
