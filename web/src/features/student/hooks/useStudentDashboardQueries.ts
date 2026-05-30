'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchStudentProgress,
  fetchStudentRecentActivity,
  fetchStudentTopicStats,
} from '@/lib/api/student';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';

export function useStudentDashboardQueries() {
  const progressQuery = useQuery({
    queryKey: [...queryKeys.student.dashboard(), 'progress'] as const,
    queryFn: fetchStudentProgress,
  });

  const topicQuery = useQuery({
    queryKey: [...queryKeys.student.dashboard(), 'topic-stats'] as const,
    queryFn: fetchStudentTopicStats,
  });

  const activityQuery = useQuery({
    queryKey: [...queryKeys.student.dashboard(), 'recent-activity'] as const,
    queryFn: fetchStudentRecentActivity,
  });

  const isLoading =
    progressQuery.isPending && topicQuery.isPending && activityQuery.isPending;

  const error =
    progressQuery.error ?? topicQuery.error ?? activityQuery.error ?? null;

  return {
    progress: progressQuery.data ?? null,
    topicStats: topicQuery.data ?? [],
    recentActivity: activityQuery.data ?? [],
    isLoading,
    progressPending: progressQuery.isPending,
    topicPending: topicQuery.isPending,
    activityPending: activityQuery.isPending,
    errorMessage: error ? getQueryErrorMessage(error) : null,
    progressError: progressQuery.error,
    topicError: topicQuery.error,
    activityError: activityQuery.error,
  };
}
