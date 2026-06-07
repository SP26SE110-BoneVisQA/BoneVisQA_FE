'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveExpertCategories } from '@/features/expert/lib/expert-ontology';
import {
  createExpertCase,
  fetchExpertCase,
  fetchExpertCategories,
  fetchExpertTags,
  updateExpertCase,
  fetchExpertCasesPaged,
  type CreateExpertCaseJsonInput,
  type ExpertCategory,
  type SaveExpertCaseInput,
} from '@/lib/api/expert-cases';
import { queryKeys } from '@/lib/query-keys';

export interface ExpertCaseLibraryResponse {
  items: import('@/lib/api/expert-cases').ExpertCase[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export function useExpertCaseLibrary(params?: { pageIndex?: number; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.expert.cases(),
    queryFn: async (): Promise<ExpertCaseLibraryResponse> => {
      const pagedResult = await fetchExpertCasesPaged(params?.pageIndex ?? 1, params?.pageSize ?? 100);
      return {
        items: pagedResult.items,
        totalCount: pagedResult.totalCount,
        pageIndex: pagedResult.pageIndex,
        pageSize: pagedResult.pageSize,
      };
    },
    staleTime: 15_000,
    refetchOnMount: true,
  });
}

export function useExpertCaseMeta() {
  return useQuery({
    queryKey: queryKeys.expert.caseMeta(),
    queryFn: async () => {
      const [apiCategories, tags] = await Promise.all([
        fetchExpertCategories().catch(() => [] as ExpertCategory[]),
        fetchExpertTags(1, 200).catch(() => []),
      ]);
      return { categories: resolveExpertCategories(apiCategories), tags };
    },
    staleTime: 60_000,
  });
}

export function useExpertCaseDetail(caseId: string) {
  return useQuery({
    queryKey: queryKeys.expert.caseDetail(caseId),
    queryFn: () => fetchExpertCase(caseId),
    enabled: Boolean(caseId),
  });
}

export function useCreateExpertCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpertCaseJsonInput) => createExpertCase(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.dashboard() });
    },
  });
}

export function useUpdateExpertCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, body }: { caseId: string; body: SaveExpertCaseInput }) =>
      updateExpertCase(caseId, body),
    onSuccess: (_, { caseId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.caseDetail(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expert.cases() });
    },
  });
}
