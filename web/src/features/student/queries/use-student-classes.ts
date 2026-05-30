'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchStudentClasses } from '@/lib/api/student';

export function useStudentClasses() {
  return useQuery({
    queryKey: ['student', 'classes'] as const,
    queryFn: fetchStudentClasses,
    staleTime: 30_000,
  });
}
