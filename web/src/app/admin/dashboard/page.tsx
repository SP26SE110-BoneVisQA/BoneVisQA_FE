'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/StatCard';
import { DashboardOverviewLayout } from '@/components/layouts';
import RecentUsersTable from '@/components/admin/dashboard/RecentUsersTable';
import RoleDistributionChart from '@/components/admin/dashboard/RoleDistributionChart';
import SystemActivityFeed from '@/components/admin/dashboard/SystemActivityFeed';
import {
  Users,
  GraduationCap,
  UserCog,
  TrendingUp,
  FileText,
  Award,
  Clock,
} from 'lucide-react';
import {
  fetchAdminUserStats,
  fetchAdminActivityStats,
  fetchAdminRagStats,
  fetchAdminExpertReviewStats,
  fetchAdminRecentUsersPage,
} from '@/lib/api/admin-dashboard';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';

const RECENT_USERS_PAGE_SIZE = 8;

export default function AdminDashboardPage() {
  const [recentPage, setRecentPage] = useState(1);

  const overviewQuery = useQuery({
    queryKey: queryKeys.admin.dashboardOverview(),
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = new Date();
      const [userStats, ragStats, expertStats, activityStats] = await Promise.all([
        fetchAdminUserStats(),
        fetchAdminRagStats(),
        fetchAdminExpertReviewStats(),
        fetchAdminActivityStats(from, to),
      ]);
      return { userStats, ragStats, expertStats, activityStats };
    },
  });

  const recentUsersQuery = useQuery({
    queryKey: queryKeys.admin.recentUsers(recentPage, RECENT_USERS_PAGE_SIZE),
    queryFn: () => fetchAdminRecentUsersPage(recentPage, RECENT_USERS_PAGE_SIZE),
    staleTime: 0,
  });

  const userStats = overviewQuery.data?.userStats ?? null;
  const ragStats = overviewQuery.data?.ragStats ?? null;
  const expertStats = overviewQuery.data?.expertStats ?? null;
  const activityStats = overviewQuery.data?.activityStats ?? null;
  const recentUsers = recentUsersQuery.data?.users ?? [];
  const recentTotal = recentUsersQuery.data?.totalCount ?? 0;

  const statsError = overviewQuery.error
    ? getQueryErrorMessage(overviewQuery.error)
    : null;

  const totalUsers = userStats?.totalUsers || 0;
  const newUsers = userStats?.newUsersThisMonth || 0;
  const students = userStats?.usersByRole?.['Student'] || 0;
  const lecturers = userStats?.usersByRole?.['Lecturer'] || 0;
  const experts = userStats?.usersByRole?.['Expert'] || 0;
  const admins = userStats?.usersByRole?.['Admin'] || 0;

  const roleDistribution = useMemo(
    () =>
      [
        { role: 'Students', count: students, color: 'bg-primary' },
        { role: 'Lecturers', count: lecturers, color: 'bg-accent' },
        { role: 'Experts', count: experts, color: 'bg-warning' },
        { role: 'Admins', count: admins, color: 'bg-destructive' },
      ]
        .map((item) => ({
          ...item,
          percentage: totalUsers > 0 ? Number(((item.count / totalUsers) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.count - a.count),
    [admins, experts, lecturers, students, totalUsers],
  );

  const currentStats = [
    {
      title: 'Total Users',
      value: totalUsers.toString(),
      change: `+${newUsers} this month`,
      changeType: 'positive' as const,
      icon: Users,
      iconColor: 'bg-primary/10 text-primary',
    },
    {
      title: 'Students',
      value: students.toString(),
      change: 'active members',
      changeType: 'positive' as const,
      icon: GraduationCap,
      iconColor: 'bg-accent/10 text-accent',
    },
    {
      title: 'Lecturers',
      value: lecturers.toString(),
      change: 'active teaching',
      changeType: 'positive' as const,
      icon: UserCog,
      iconColor: 'bg-warning/10 text-warning',
    },
    {
      title: 'Experts',
      value: experts.toString(),
      change: 'reviewing cases',
      changeType: 'positive' as const,
      icon: Award,
      iconColor: 'bg-success/10 text-success',
    },
  ];

  const isLoading = overviewQuery.isPending || recentUsersQuery.isPending;

  return (
    <DashboardOverviewLayout
      title="Dashboard"
      isLoading={isLoading}
      error={statsError}
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {currentStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecentUsersTable
            users={recentUsers}
            isLoading={false}
            isPaging={recentUsersQuery.isFetching}
            page={recentPage}
            pageSize={RECENT_USERS_PAGE_SIZE}
            totalCount={recentTotal}
            onPageChange={setRecentPage}
          />
          <RoleDistributionChart isLoading={false} roleDistribution={roleDistribution} />
        </div>

        <div className="space-y-6">
          <SystemActivityFeed activityStats={activityStats} />
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-card-foreground">Platform Stats</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Total Cases</span>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  {ragStats?.totalDocuments?.toLocaleString() ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Total Reviews</span>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  {expertStats?.totalReviews?.toLocaleString() ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Pending Reviews</span>
                </div>
                <span className="text-sm font-semibold text-warning">
                  {expertStats?.pendingAnswers?.toLocaleString() ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Document Chunks</span>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  {ragStats?.totalChunks?.toLocaleString() ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-primary">
            {expertStats?.approvedReviews?.toLocaleString() ?? '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Approved Reviews</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-success">
            {ragStats?.totalCitations?.toLocaleString() ?? '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Citations</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-warning">
            {ragStats?.outdatedDocuments?.toLocaleString() ?? '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Outdated Documents</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-accent">
            {userStats?.pendingUsers?.toLocaleString() ?? '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Pending Users</p>
        </div>
      </div>
    </DashboardOverviewLayout>
  );
}
