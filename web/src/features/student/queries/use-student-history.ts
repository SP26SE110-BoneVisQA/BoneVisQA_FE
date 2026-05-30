'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchStudentCaseLibraryHistory,
  fetchStudentPersonalStudiesHistory,
} from '@/lib/api/student';
import { queryKeys } from '@/lib/query-keys';

export function useStudentHistory() {
  return useQuery({
    queryKey: queryKeys.student.history(),
    queryFn: async () => {
      const [personalResponse, caseResponse] = await Promise.all([
        fetchStudentPersonalStudiesHistory(),
        fetchStudentCaseLibraryHistory(),
      ]);
      return {
        personalItems: personalResponse.items,
        caseItems: caseResponse.items,
        totalPersonalCount: personalResponse.totalCount,
        totalCaseCount: caseResponse.totalCount,
      };
    },
  });
}
