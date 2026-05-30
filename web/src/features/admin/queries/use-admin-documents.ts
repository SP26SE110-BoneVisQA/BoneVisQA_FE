'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDocumentCategories,
  fetchDocumentTags,
  getDocuments,
  type DocumentDto,
} from '@/lib/api/admin-documents';
import { queryKeys } from '@/lib/query-keys';

export type AdminDocumentsFilters = {
  search?: string;
  categoryId?: string;
  indexingStatus?: string;
};

export function useAdminDocumentMeta() {
  return useQuery({
    queryKey: queryKeys.admin.documentMeta(),
    queryFn: async () => {
      const [categories, tags] = await Promise.all([
        fetchDocumentCategories(),
        fetchDocumentTags(),
      ]);
      return {
        categories: categories.filter((x) => x.id),
        tags: tags.filter((x) => x.id),
      };
    },
    staleTime: 60_000,
  });
}

export function useAdminDocuments(filters: AdminDocumentsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.documents(filters),
    queryFn: () =>
      getDocuments({
        search: filters.search?.trim() || undefined,
        categoryId: filters.categoryId || undefined,
        indexingStatus: filters.indexingStatus || undefined,
      }),
    refetchInterval: (query) => {
      const docs = query.state.data as DocumentDto[] | undefined;
      if (!docs?.length) return false;
      const needsPoll = docs.some((d) => {
        const s = (d.indexingStatus ?? '').toLowerCase();
        return s === 'pending' || s === 'processing';
      });
      return needsPoll ? 3000 : false;
    },
  });
}

export function useInvalidateAdminDocuments() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'documents'] });
  };
}
