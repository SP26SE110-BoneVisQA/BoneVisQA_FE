'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { fetchCaseCatalogDetail } from '@/lib/api/student';
import { queryKeys } from '@/lib/query-keys';

export function useStudentCaseDetail(caseId: string) {
  return useQuery({
    queryKey: queryKeys.student.caseDetail(caseId),
    queryFn: () => fetchCaseCatalogDetail(caseId),
    enabled: Boolean(caseId?.trim()),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}

export function isCaseDetailNotFound(error: unknown): boolean {
  if (axios.isAxiosError(error)) return error.response?.status === 404;
  return /404|not found/i.test(error instanceof Error ? error.message : '');
}
