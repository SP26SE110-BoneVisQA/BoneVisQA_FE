'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchLecturerAnalytics,
  fetchLecturerClassLeaderboard,
  fetchLecturerDashboardStats,
} from '@/lib/api/lecturer-dashboard';
import { fetchLecturerClasses, fetchLecturerTriageList } from '@/lib/api/lecturer-triage';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';

function readLecturerId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId')?.trim() || null;
}

export function useLecturerDashboardQueries() {
  const lecturerId = useMemo(() => readLecturerId(), []);
  const [selectedClassId, setSelectedClassId] = useState('');

  const statsQuery = useQuery({
    queryKey: queryKeys.lecturer.dashboard(),
    queryFn: fetchLecturerDashboardStats,
  });

  const classesQuery = useQuery({
    queryKey: [...queryKeys.lecturer.classes(), lecturerId] as const,
    queryFn: () => fetchLecturerClasses(lecturerId!),
    enabled: Boolean(lecturerId),
  });

  const analyticsQuery = useQuery({
    queryKey: [...queryKeys.lecturer.all, 'analytics'] as const,
    queryFn: fetchLecturerAnalytics,
  });

  const classes = classesQuery.data ?? [];
  const effectiveClassId = selectedClassId || classes[0]?.id || '';

  const leaderboardQuery = useQuery({
    queryKey: [...queryKeys.lecturer.all, 'leaderboard', effectiveClassId] as const,
    queryFn: () => fetchLecturerClassLeaderboard(effectiveClassId),
    enabled: Boolean(effectiveClassId),
  });

  const triageQuery = useQuery({
    queryKey: queryKeys.lecturer.triage({ classId: effectiveClassId }),
    queryFn: () => fetchLecturerTriageList(effectiveClassId),
    enabled: Boolean(effectiveClassId),
  });

  const isLoading =
    statsQuery.isPending ||
    classesQuery.isPending ||
    analyticsQuery.isPending ||
    (Boolean(effectiveClassId) && (leaderboardQuery.isPending || triageQuery.isPending));

  const error =
    statsQuery.error ??
    classesQuery.error ??
    analyticsQuery.error ??
    leaderboardQuery.error ??
    triageQuery.error;

  const errorMessage = error ? getQueryErrorMessage(error, 'Failed to load lecturer dashboard.') : null;

  const topActive = useMemo(() => {
    return [...(leaderboardQuery.data ?? [])]
      .sort((a, b) => (b.totalQuestionsAsked ?? 0) - (a.totalQuestionsAsked ?? 0))
      .slice(0, 6);
  }, [leaderboardQuery.data]);

  const pendingTriageCount =
    triageQuery.data?.filter((q) => !q.escalated).length ?? 0;

  return {
    lecturerId,
    selectedClassId,
    setSelectedClassId,
    effectiveClassId,
    stats: statsQuery.data ?? null,
    classes,
    analytics: analyticsQuery.data ?? null,
    leaderboard: leaderboardQuery.data ?? [],
    triage: triageQuery.data ?? [],
    topActive,
    pendingTriageCount,
    isLoading,
    errorMessage,
    isFetchingSecondary:
      leaderboardQuery.isFetching || triageQuery.isFetching || classesQuery.isFetching,
  };
}
