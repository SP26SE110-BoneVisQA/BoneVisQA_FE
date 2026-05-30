'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchLecturerAnalytics } from '@/lib/api/lecturer-dashboard';
import { queryKeys } from '@/lib/query-keys';

export function useLecturerAnalytics() {
  return useQuery({
    queryKey: queryKeys.lecturer.analytics(),
    queryFn: fetchLecturerAnalytics,
    staleTime: 60_000,
  });
}
