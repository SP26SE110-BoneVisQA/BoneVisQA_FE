'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStudentProfile,
  fetchStudentProgress,
  fetchStudentRecentActivity,
  updateStudentProfile,
} from '@/lib/api/student';
import type { StudentProfileUpdatePayload } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { emitAuthRefresh } from '@/lib/useAuth';

export function useStudentProfileBundle() {
  return useQuery({
    queryKey: queryKeys.student.profile(),
    queryFn: async () => {
      const [profileResult, progressResult, activityResult] = await Promise.allSettled([
        fetchStudentProfile(),
        fetchStudentProgress(),
        fetchStudentRecentActivity(),
      ]);
      if (profileResult.status === 'rejected') throw profileResult.reason;
      return {
        profile: profileResult.value,
        progress: progressResult.status === 'fulfilled' ? progressResult.value : null,
        activity:
          activityResult.status === 'fulfilled' && Array.isArray(activityResult.value)
            ? activityResult.value
            : [],
      };
    },
    staleTime: 30_000,
  });
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudentProfileUpdatePayload) => updateStudentProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.student.profile(), (prev: unknown) => {
        if (!prev || typeof prev !== 'object') {
          return { profile: updated, progress: null, activity: [] };
        }
        const p = prev as { profile: unknown; progress: unknown; activity: unknown };
        return { ...p, profile: updated };
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.student.dashboard() });
      emitAuthRefresh({
        fullName: updated.fullName ?? undefined,
        avatarUrl: updated.avatarUrl ?? undefined,
      });
    },
  });
}
