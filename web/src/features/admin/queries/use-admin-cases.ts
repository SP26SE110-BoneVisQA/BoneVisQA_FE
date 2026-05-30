'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAdminCase,
  fetchAdminCaseDetail,
  fetchAdminCasesPaged,
  updateAdminCase,
} from '@/lib/api/admin-cases';
import type { SaveExpertCaseInput } from '@/lib/api/expert-cases';
import { queryKeys } from '@/lib/query-keys';

export function useAdminCasesPaged(pageIndex: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.admin.cases(pageIndex, pageSize),
    queryFn: () => fetchAdminCasesPaged(pageIndex, pageSize),
    placeholderData: (prev) => prev,
  });
}

export function useAdminCaseDetail(caseId: string) {
  return useQuery({
    queryKey: queryKeys.admin.caseDetail(caseId),
    queryFn: () => fetchAdminCaseDetail(caseId),
    enabled: Boolean(caseId),
  });
}

export function useUpdateAdminCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, body }: { caseId: string; body: SaveExpertCaseInput }) =>
      updateAdminCase(caseId, body),
    onSuccess: (_, { caseId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.caseDetail(caseId) });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'cases'] });
    },
  });
}

export function useDeleteAdminCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => deleteAdminCase(caseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'cases'] });
    },
  });
}
