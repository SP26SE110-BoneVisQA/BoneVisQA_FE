'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveExpertReview,
  deleteExpertReviewDraft,
  fetchExpertReviewDetail,
  fetchExpertReviewQueue,
  promoteExpertReview,
  putExpertReviewDraft,
  resolveExpertReview,
  type ExpertReviewUpdatePayload,
  type PromoteExpertReviewPayload,
} from '@/lib/api/expert-reviews';
import { queryKeys } from '@/lib/query-keys';

export function useExpertReviewQueue(status: 'Pending' | 'History' = 'Pending') {
  return useQuery({
    queryKey: queryKeys.expert.reviews(status),
    queryFn: () => fetchExpertReviewQueue({ status }),
    staleTime: 15_000,
  });
}

export function useExpertReviewDetail(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.expert.reviewDetail(sessionId),
    queryFn: () => fetchExpertReviewDetail(sessionId),
    enabled: enabled && Boolean(sessionId),
  });
}

export function useSaveExpertReviewDraft() {
  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: Parameters<typeof putExpertReviewDraft>[1];
    }) => putExpertReviewDraft(sessionId, payload),
  });
}

export function useApproveExpertReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => approveExpertReview(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.expert.all, 'reviews'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
    },
  });
}

export function useResolveExpertReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: ExpertReviewUpdatePayload;
    }) => resolveExpertReview(sessionId, payload),
    onSuccess: (_, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.expert.all, 'reviews'] });
      void deleteExpertReviewDraft(sessionId).catch(() => {});
    },
  });
}

export function usePromoteExpertReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: PromoteExpertReviewPayload;
    }) => promoteExpertReview(sessionId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.expert.all, 'reviews'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
    },
  });
}
