'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveMedicalVerification, fetchPendingVerifications } from '@/lib/api/admin-users';
import { queryKeys } from '@/lib/query-keys';

export function useAdminPendingVerifications() {
  return useQuery({
    queryKey: queryKeys.admin.verifications(),
    queryFn: fetchPendingVerifications,
  });
}

export function useVerificationDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; isApproved: boolean; notes?: string }) =>
      approveMedicalVerification(vars.userId, {
        isApproved: vars.isApproved,
        notes: vars.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.verifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });
}
