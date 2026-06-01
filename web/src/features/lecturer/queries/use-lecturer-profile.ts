'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchLecturerProfile,
  fetchLecturerDashboardStats,
  updateLecturerProfile,
  type UpdateLecturerProfilePayload,
} from '@/lib/api/lecturer-dashboard';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerProfile() {
  return useQuery({
    queryKey: queryKeys.lecturer.profile(),
    queryFn: fetchLecturerProfile,
    staleTime: 30_000,
  });
}

export function useLecturerDashboardStats() {
  return useQuery({
    queryKey: queryKeys.lecturer.dashboardStats(),
    queryFn: fetchLecturerDashboardStats,
    staleTime: 60_000,
  });
}

export function useUpdateLecturerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLecturerProfilePayload) => updateLecturerProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.lecturer.profile(), updated);
    },
  });
}
