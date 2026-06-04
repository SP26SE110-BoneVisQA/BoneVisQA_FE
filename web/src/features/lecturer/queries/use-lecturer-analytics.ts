'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchLecturerAnalytics } from '@/lib/api/lecturer-dashboard';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';

function readLecturerId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId')?.trim() || null;
}

export function useLecturerAnalytics() {
  const lecturerId = readLecturerId();

  return useQuery({
    queryKey: queryKeys.lecturer.analytics(),
    queryFn: fetchLecturerAnalytics,
    enabled: Boolean(lecturerId),
    staleTime: 60_000,
  });
}
