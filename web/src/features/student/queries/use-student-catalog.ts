'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchCaseCatalog, fetchCaseCatalogFilters } from '@/lib/api/student';
import { queryKeys } from '@/lib/query-keys';

export type CatalogFilters = {
  location: string;
  lesionType: string;
  difficulty: string;
  q?: string;
};

export function useStudentCatalogFilters() {
  return useQuery({
    queryKey: queryKeys.student.catalogFilters(),
    queryFn: fetchCaseCatalogFilters,
  });
}

export function useStudentCatalog(filters: CatalogFilters) {
  return useQuery({
    queryKey: queryKeys.student.catalog(filters),
    queryFn: () => fetchCaseCatalog(filters),
    placeholderData: keepPreviousData,
  });
}
