'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchExpertProfile,
  updateExpertProfile,
  type UpdateExpertProfilePayload,
} from '@/lib/api/lecturer-dashboard';
import { queryKeys } from '@/lib/query-keys';

export function useExpertProfile() {
  return useQuery({
    queryKey: queryKeys.expert.profile(),
    queryFn: fetchExpertProfile,
    staleTime: 30_000,
  });
}

export function useUpdateExpertProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateExpertProfilePayload) => updateExpertProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.expert.profile(), updated);
    },
  });
}
