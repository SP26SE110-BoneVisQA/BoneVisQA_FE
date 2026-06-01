'use client';

import { useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { DashboardOverviewLayout } from '@/components/layouts';
import { SectionCard } from '@/components/shared/SectionCard';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { useStudentDashboardQueries } from '@/features/student/hooks/useStudentDashboardQueries';
import ProgressRing from '@/components/student/ProgressRing';
import QuickActionCard from '@/components/student/QuickActionCard';
import { StudentDashboardFab } from '@/components/student/StudentAppChrome';
import { resolveStudentRecentActivityHref } from '@/lib/student/recent-activity-href';
import { useAuth } from '@/lib/useAuth';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  History,
  ImageUp,
  Library,
  MessageSquare,
  PlayCircle,
  ShieldAlert,
  Target,
  Trophy,
  User,
} from 'lucide-react';

type StatCardModel = {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
};

/** API-backed destinations only — no legacy topic chat routes. */
const quickActions = [
  {
    title: 'New visual QA',
    icon: ImageUp,
    href: '/student/visual-qa/workspace',
    iconColor: 'bg-primary/15 text-primary',
  },
  {
    title: 'View history',
    icon: History,
    href: '/student/history',
    iconColor: 'bg-slate-500/15 text-slate-700',
  },
  {
    title: 'Case catalog',
    icon: Library,
    href: '/student/catalog',
    iconColor: 'bg-sky-500/15 text-sky-800',
  },
  {
    title: 'Practice quiz',
    icon: Trophy,
    href: '/student/quiz',
    iconColor: 'bg-cyan-accent/15 text-primary',
  },
  {
    title: 'My profile',
    icon: User,
    href: '/student/profile',
    iconColor: 'bg-emerald-500/15 text-emerald-800',
  },
];

function formatQuizPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

function clampPercent(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const {
    progress,
    topicStats,
    recentActivity,
    isLoading,
    progressPending,
    topicPending,
    activityPending,
    progressError,
    topicError,
    activityError,
  } = useStudentDashboardQueries();

  const statCards = useMemo<StatCardModel[]>(
    () =>
      progress
        ? [
            {
              title: 'Cases viewed',
              value: progress.totalCasesViewed,
              change: 'From live progress analytics',
              changeType: 'neutral' as const,
              icon: BookOpen,
              iconColor: 'bg-primary/10 text-primary',
            },
            {
              title: 'Questions asked',
              value: progress.totalQuestionsAsked,
              change: `${progress.escalatedAnswers} escalated to experts`,
              changeType: 'neutral' as const,
              icon: MessageSquare,
              iconColor: 'bg-cyan-accent/10 text-primary',
            },
            {
              title: 'Average quiz score',
              value: formatQuizPercent(progress.avgQuizScore),
              change: `${progress.completedQuizzes} completed quizzes`,
              changeType:
                progress.avgQuizScore != null && !Number.isNaN(progress.avgQuizScore) && progress.avgQuizScore >= 70
                  ? 'positive'
                  : 'neutral',
              icon: Trophy,
              iconColor: 'bg-amber-500/10 text-amber-700',
            },
            {
              title: 'Quiz accuracy',
              value: formatQuizPercent(progress.quizAccuracyRate),
              change: `${progress.totalQuizAttempts} total attempts`,
              changeType:
                progress.quizAccuracyRate != null &&
                !Number.isNaN(progress.quizAccuracyRate) &&
                progress.quizAccuracyRate >= 70
                  ? 'positive'
                  : 'neutral',
              icon: Target,
              iconColor: 'bg-emerald-500/10 text-emerald-700',
            },
          ]
        : [],
    [progress],
  );

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';
  const goalTopic = topicStats[0]?.topicName ?? 'Musculoskeletal focus';
  const casesViewedPct = Math.min(100, (progress?.totalCasesViewed ?? 0) * 5);

  return (
    <DashboardOverviewLayout
      title="Student dashboard"
      isLoading={isLoading}
    >
      <>
            <section className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div>
                <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  Welcome back, {firstName}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/student/visual-qa/workspace"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <PlayCircle className="h-5 w-5 shrink-0" aria-hidden />
                  New visual QA
                </Link>
                <Link
                  href="/student/quiz"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  Practice quiz
                </Link>
              </div>
            </section>

            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  Welcome back, {firstName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track your cases, quizzes and study goals.
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Link
                  href="/student/visual-qa/workspace"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                  New visual QA
                </Link>
                <Link
                  href="/student/quiz"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  Practice quiz
                </Link>
              </div>
            </div>

            {/* ── Top stat strip (compact 4 cards in a row) ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.title}
                    className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconColor}`}
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-headline text-xl font-bold leading-none text-foreground">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{stat.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Main content: 2 columns ────────────────────── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">

              {/* Left column */}
              <div className="space-y-6">

                {/* Quick actions — horizontal pill row */}
                <SectionCard title="Quick actions">
                  <div className="flex flex-wrap gap-3">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          key={action.title}
                          href={action.href}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm hover:text-primary"
                        >
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${action.iconColor}`}>
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                          {action.title}
                        </Link>
                      );
                    })}
                  </div>
                </SectionCard>

                {/* Topic mastery */}
                <SectionCard title="Topic mastery">
                  {topicPending ? (
                    <div className="space-y-3">
                      <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                      <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                    </div>
                  ) : topicError ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      {topicError instanceof Error ? topicError.message : String(topicError)}
                    </div>
                  ) : topicStats.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      No topic analytics available yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topicStats.map((topic, idx) => (
                        <div
                          key={topic.topicName?.trim() || `topic-${idx}`}
                          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {topic.topicName?.trim() || 'Unnamed topic'}
                              </p>
                              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                {typeof topic.accuracyRate === 'number' && Number.isFinite(topic.accuracyRate)
                                  ? `${topic.accuracyRate.toFixed(1)}%`
                                  : '—'}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {typeof topic.quizAttempts === 'number' && Number.isFinite(topic.quizAttempts)
                                ? topic.quizAttempts
                                : 0}{' '}
                              quiz attempts
                            </p>
                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={
                                  {
                                    '--accuracy-pct': `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        typeof topic.accuracyRate === 'number' &&
                                          Number.isFinite(topic.accuracyRate)
                                          ? topic.accuracyRate
                                          : 0,
                                      ),
                                    )}%`,
                                    width: 'var(--accuracy-pct)',
                                  } as CSSProperties
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Recent activity */}
                <SectionCard title="Recent activity">
                  {activityPending ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <SkeletonBlock className="h-4 w-48 max-w-full" />
                              <SkeletonBlock className="h-3 w-36" />
                            </div>
                            <SkeletonBlock className="h-3 w-16 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityError ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      {activityError instanceof Error ? activityError.message : String(activityError)}
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      No recent activity has been recorded yet.
                    </div>
                  ) : (
                    <ol className="space-y-3">
                      {recentActivity.map((activity, actIdx) => {
                        const normalizedStatus = activity.status?.toLowerCase();
                        const activityHref = resolveStudentRecentActivityHref(activity);
                        const statusBadge =
                          normalizedStatus === 'approved' || normalizedStatus === 'revised'
                            ? {
                                label: 'Verified',
                                className: 'bg-emerald-500/10 text-emerald-700',
                                icon: CheckCircle2,
                              }
                            : normalizedStatus === 'pending' || normalizedStatus === 'pendingexpert'
                              ? {
                                  label: 'In Review',
                                  className: 'bg-amber-500/10 text-amber-700',
                                  icon: ShieldAlert,
                                }
                              : null;
                        const StatusIcon = statusBadge?.icon;

                        return (
                          <li
                            key={activity.id?.trim() || `activity-${actIdx}`}
                            className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/30 hover:bg-primary/5"
                          >
                            <Link href={activityHref} className="block">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {activity.title?.trim() || 'Activity'}
                                  </p>
                                  {activity.description?.trim() ? (
                                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                                      {activity.description}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {activity.occurredAt?.trim() || '—'}
                                </span>
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                                  {activity.type?.trim() || 'General'}
                                </span>
                                {statusBadge && StatusIcon ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {statusBadge.label}
                                  </span>
                                ) : null}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </SectionCard>
              </div>

              {/* Right column */}
              <div className="space-y-6">

                {/* Overall progress ring */}
                <SectionCard title="Overall progress">
                  <div className="flex flex-col items-center py-2">
                    <ProgressRing
                      progress={clampPercent(progress?.quizAccuracyRate)}
                      size={130}
                      strokeWidth={9}
                    />
                    <div className="mt-4 text-center">
                      <p className="font-headline text-2xl font-bold text-foreground">
                        {formatQuizPercent(progress?.latestQuizScore)}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">Latest quiz score</p>
                    </div>
                  </div>
                </SectionCard>

                {/* Mini stat row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
                    </div>
                    <p className="font-headline text-xl font-bold text-foreground">
                      {progress?.totalQuizAttempts ?? 0}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Quiz attempts</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-accent/10">
                      <MessageSquare className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
                    </div>
                    <p className="font-headline text-xl font-bold text-foreground">
                      {progress?.escalatedAnswers ?? 0}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Escalated</p>
                  </div>
                </div>

                {/* Study goal */}
                <SectionCard title="Study focus">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{goalTopic}</p>
                      <p className="text-xs text-muted-foreground">Current study goal</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ '--cases-pct': `${casesViewedPct}%`, width: 'var(--cases-pct)' } as CSSProperties}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {Math.round(casesViewedPct)}% toward your weekly goal
                  </p>
                </SectionCard>
              </div>
            </div>

      </>
      <StudentDashboardFab />
    </DashboardOverviewLayout>
  );
}
