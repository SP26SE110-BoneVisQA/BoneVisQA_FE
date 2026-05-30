'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchBoneSpecialtyOptions,
  fetchCaseCatalog,
  fetchCaseCatalogFilters,
  fetchPathologyCategoryOptions,
} from '@/lib/api/student';
import { queryKeys } from '@/lib/query-keys';

export type CatalogFilters = {
  location: string;
  lesionType: string;
  difficulty: string;
  boneSpecialtyId?: string;
  pathologyCategoryId?: string;
  severity?: string;
  patientAgeGroup?: string;
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
    queryFn: () =>
      fetchCaseCatalog({
        location: filters.location,
        lesionType: filters.lesionType,
        difficulty: filters.difficulty,
        boneSpecialtyId: filters.boneSpecialtyId || undefined,
        pathologyCategoryId: filters.pathologyCategoryId || undefined,
        severity: filters.severity || undefined,
        patientAgeGroup: filters.patientAgeGroup || undefined,
        q: filters.q,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useBoneSpecialtyOptions() {
  return useQuery({
    queryKey: ['common', 'classifications', 'bone-specialties'],
    queryFn: fetchBoneSpecialtyOptions,
  });
}

export function usePathologyCategoryOptions() {
  return useQuery({
    queryKey: ['common', 'classifications', 'pathology-categories'],
    queryFn: fetchPathologyCategoryOptions,
  });
}
