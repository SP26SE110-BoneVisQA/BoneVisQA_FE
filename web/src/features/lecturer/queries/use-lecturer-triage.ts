'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLecturerVisualQaTriageQueue, getLecturerClasses, rejectTriageAnswer } from '@/lib/api/lecturer';
import {
  fetchExpertSpecialties,
  respondToQuestion,
  TRIAGE_ALREADY_ESCALATED,
  WORKFLOW_CONFLICT,
} from '@/lib/api/lecturer-triage';
import { getStoredUserId } from '@/lib/getStoredUserId';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerTriageClasses() {
  const lecturerId = getStoredUserId();
  return useQuery({
    queryKey: [...queryKeys.lecturer.classes(), 'triage-portal', lecturerId] as const,
    queryFn: () => getLecturerClasses(lecturerId),
    enabled: Boolean(lecturerId),
    staleTime: 30_000,
  });
}

export function useLecturerTriageQueue(classId: string, status: 'Pending' | 'History' = 'Pending') {
  return useQuery({
    queryKey: queryKeys.lecturer.triageQueue(classId, status),
    queryFn: () => fetchLecturerVisualQaTriageQueue(classId, { status }),
    enabled: Boolean(classId),
    staleTime: 10_000,
  });
}

export function useExpertSpecialties() {
  return useQuery({
    queryKey: [...queryKeys.lecturer.all, 'expert-specialties'] as const,
    queryFn: fetchExpertSpecialties,
    staleTime: 5 * 60_000,
  });
}

export function useEscalateTriageItem(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      body,
    }: {
      questionId: string;
      body: Parameters<typeof respondToQuestion>[2];
    }) => respondToQuestion(classId, questionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.lecturer.all, 'triage-queue', classId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.dashboard() });
    },
  });
}

export function useRejectTriageAnswer(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, reason }: { answerId: string; reason: string }) =>
      rejectTriageAnswer(answerId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.lecturer.all, 'triage-queue', classId],
      });
    },
  });
}

export { TRIAGE_ALREADY_ESCALATED, WORKFLOW_CONFLICT };
