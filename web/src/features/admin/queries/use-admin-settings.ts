'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminProfile, updateAdminProfile, type UpdateAdminProfilePayload } from '@/lib/api/lecturer-dashboard';
import { queryKeys } from '@/lib/query-keys';

export function useAdminProfile() {
  return useQuery({
    queryKey: queryKeys.admin.profile(),
    queryFn: fetchAdminProfile,
    staleTime: 30_000,
  });
}

export function useUpdateAdminProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAdminProfilePayload) => updateAdminProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.admin.profile(), updated);
    },
  });
}
