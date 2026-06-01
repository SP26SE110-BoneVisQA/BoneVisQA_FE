'use client';

import { useQuery } from '@tanstack/react-query';
import { getLecturerCasesPaged, type PagedCasesResult } from '@/lib/api/lecturer';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 8;

export function useLecturerCasesPaged(pageIndex: number = 1) {
  return useQuery({
    queryKey: [...queryKeys.lecturer.all, 'cases-paged', pageIndex] as const,
    queryFn: () => getLecturerCasesPaged(pageIndex, PAGE_SIZE),
    staleTime: 30_000,
  });
}

export function useLecturerCasesList() {
  return useQuery({
    queryKey: [...queryKeys.lecturer.all, 'cases-list'] as const,
    queryFn: () => getLecturerCasesPaged(1, 1000).then(r => r.items),
    staleTime: 30_000,
  });
}

export { PAGE_SIZE };
