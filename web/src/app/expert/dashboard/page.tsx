'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardOverviewLayout } from '@/components/layouts';
import QuickStatsCard from '@/components/expert/QuickStatsCard';
import ReviewCard from '@/components/expert/ReviewCard';
import CaseManagementCard from '@/components/expert/CaseManagementCard';
import ExpertActivityPanel from '@/components/expert/dashboard/ExpertActivityPanel';
import {
  FolderOpen,
  CheckCircle,
  Clock,
  Users,
  Plus,
  Filter,
} from 'lucide-react';
import { fetchExpertDashboardBundle } from '@/lib/api/expert-dashboard';
import { queryKeys } from '@/lib/query-keys';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';

export default function ExpertDashboardPage() {
  const router = useRouter();

  const { data: bundle, error, isPending } = useQuery({
    queryKey: queryKeys.expert.dashboard(),
    queryFn: fetchExpertDashboardBundle,
  });

  const errorMessage = error ? getQueryErrorMessage(error, 'Failed to load dashboard data.') : null;

  const stats = bundle?.stats ?? null;
  const pendingReviews = bundle?.pendingReviews ?? [];
  const recentCases = useMemo(() => bundle?.recentCases ?? [], [bundle?.recentCases]);
  const activity = bundle?.activity ?? null;

  const expertStats = useMemo(() => {
    if (!stats) return [];
    return [
      {
        title: 'Total Cases',
        value: stats.totalCases.toString(),
        change: stats.totalCases,
        trend: 'up' as const,
        icon: FolderOpen,
        iconColor: 'bg-primary/10 text-primary',
      },
      {
        title: 'Pending Reviews',
        value: stats.pendingReviews.toString(),
        change: -stats.pendingReviews,
        trend: stats.pendingReviews > 0 ? ('down' as const) : ('up' as const),
        icon: Clock,
        iconColor: 'bg-warning/10 text-warning',
      },
      {
        title: 'Approved This Month',
        value: stats.approvedThisMonth.toString(),
        change: stats.approvedThisMonth,
        trend: 'up' as const,
        icon: CheckCircle,
        iconColor: 'bg-success/10 text-success',
      },
      {
        title: 'Student Interactions',
        value: stats.studentInteractions.toLocaleString(),
        change: stats.studentInteractions,
        trend: 'up' as const,
        icon: Users,
        iconColor: 'bg-accent/10 text-accent',
      },
    ];
  }, [stats]);

  const avgDailyReviews = activity?.avgDailyReviews.toFixed(1) ?? '0';
  const [caseTab, setCaseTab] = useState<'all' | 'pending' | 'approved' | 'draft'>('all');
  const filteredRecentCases = useMemo(() => {
    if (caseTab === 'all') return recentCases;
    return recentCases.filter((item) => item.status === caseTab);
  }, [caseTab, recentCases]);

  return (
    <DashboardOverviewLayout
      title="Expert workbench"
      isLoading={isPending && !bundle}
      error={errorMessage && !bundle ? errorMessage : null}
      maxWidthClass="max-w-[1200px]"
    >
      {bundle ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {expertStats.map((stat) => (
                <QuickStatsCard key={stat.title} {...stat} />
              ))}
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Link
                href="/expert/cases"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,123,255,0.22)] transition-all hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
                Case library
              </Link>
              <Button type="button" variant="outline" className="gap-2" disabled title="Coming soon">
                <Filter className="h-5 w-5" />
                Filter cases
              </Button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-card-foreground">Pending Q&A Reviews</h2>
                    <Link href="/expert/reviews" className="text-sm font-medium text-primary hover:underline">
                      View all
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {pendingReviews.length === 0 ? (
                      <EmptyState
                        title="No pending reviews right now"
                        action={
                          <Button type="button" variant="outline" onClick={() => router.push('/expert/reviews')}>
                            Open review queue
                          </Button>
                        }
                      />
                    ) : (
                      pendingReviews.map((review) => (
                        <ReviewCard
                          key={review.id}
                          id={review.id}
                          studentName={review.studentName}
                          caseTitle={review.caseTitle}
                          caseId={review.caseId}
                          question={review.questionSnippet}
                          aiAnswer={review.aiAnswerSnippet}
                          submittedAt={formatSubmittedAt(review.submittedAt)}
                          priority={review.priority}
                          category={review.category}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-card-foreground">Case Management</h2>
                    <Link href="/expert/cases" className="text-sm font-medium text-primary hover:underline">
                      View all cases
                    </Link>
                  </div>
                  <div
                    className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 p-1"
                    role="tablist"
                    aria-label="Case status tabs"
                  >
                    {(
                      [
                        ['all', 'All'],
                        ['pending', 'Pending'],
                        ['approved', 'Approved'],
                        ['draft', 'Draft'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={caseTab === id}
                        className={`flex min-w-[calc(50%-4px)] flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:min-w-0 ${
                          caseTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setCaseTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filteredRecentCases.length === 0 ? (
                      <EmptyState
                        title={`No ${caseTab === 'all' ? '' : caseTab + ' '}cases`}
                        action={
                          <button
                            type="button"
                            onClick={() => setCaseTab('all')}
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-all hover:bg-muted/60 active:scale-[0.98]"
                          >
                            Show all cases
                          </button>
                        }
                      />
                    ) : (
                      filteredRecentCases.map((caseItem) => (
                        <CaseManagementCard
                          key={caseItem.id}
                          id={caseItem.id}
                          title={caseItem.title}
                          boneLocation={caseItem.boneLocation}
                          lesionType={caseItem.lesionType}
                          difficulty={caseItem.difficulty}
                          status={caseItem.status}
                          addedBy={caseItem.addedBy}
                          addedDate={caseItem.addedDate}
                          viewCount={caseItem.viewCount}
                          usageCount={caseItem.usageCount}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <ExpertActivityPanel
                  weeklyActivity={activity?.weeklyActivity ?? []}
                  avgDailyReviews={avgDailyReviews}
                />
              </div>
            </div>

          </>
      ) : null}
    </DashboardOverviewLayout>
  );
}

function formatSubmittedAt(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
