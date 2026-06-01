'use client';

import { useQuery } from '@tanstack/react-query';
import { getLecturerCases } from '@/lib/api/lecturer';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerCasesList() {
  return useQuery({
    queryKey: [...queryKeys.lecturer.all, 'cases-list'] as const,
    queryFn: getLecturerCases,
    staleTime: 30_000,
  });
}
