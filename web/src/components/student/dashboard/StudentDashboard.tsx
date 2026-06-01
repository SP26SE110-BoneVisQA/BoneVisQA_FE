'use client';

import Link from 'next/link';
import { DashboardOverviewLayout } from '@/components/layouts';
import { SectionCard } from '@/components/shared/SectionCard';
import { useStudentDashboardQueries } from '@/features/student/hooks/useStudentDashboardQueries';
import QuickActionCard from '@/components/student/QuickActionCard';
import { StudentDashboardFab } from '@/components/student/StudentAppChrome';
import { resolveStudentRecentActivityHref } from '@/lib/student/recent-activity-href';
import { useAuth } from '@/lib/useAuth';
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
  Trophy,
  User,
  ArrowRight,
  Brain,
  Target,
} from 'lucide-react';
import MiniProgressRing from '@/components/student/MiniProgressRing';

function formatQuizPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

function clampPercent(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

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

export default function StudentDashboard() {
  const { user } = useAuth();
  const {
    progress,
    topicStats,
    recentActivity,
    isLoading,
    activityPending,
    activityError,
  } = useStudentDashboardQueries();

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';
  const mastery = clampPercent(progress?.quizAccuracyRate ?? progress?.avgQuizScore ?? null);

  return (
    <DashboardOverviewLayout title="Student dashboard" isLoading={isLoading}>
      <>
        {/* Header */}
        <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Welcome back
            </p>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {firstName}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/student/visual-qa/workspace"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <PlayCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
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

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-6">

          {/* Hero: Mastery ring + 3 stat chips */}
          <div className="col-span-12 rounded-2xl border border-border bg-card p-8 shadow-sm lg:col-span-5">
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
              <MiniProgressRing
                progress={mastery}
                size={160}
                strokeWidth={12}
                label="Mastery"
              />
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Cases viewed</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-headline text-3xl font-bold text-foreground">
                      {progress?.totalCasesViewed ?? 0}
                    </span>
                  </div>
                </div>
                <div className="h-px w-full bg-border" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Avg. quiz score</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-headline text-3xl font-bold text-foreground">
                      {formatQuizPercent(progress?.avgQuizScore)}
                    </span>
                  </div>
                </div>
                <div className="h-px w-full bg-border" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Quiz accuracy</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-headline text-3xl font-bold text-foreground">
                      {formatQuizPercent(progress?.quizAccuracyRate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center rounded-xl bg-muted/60 p-3 text-center">
                <MessageSquare className="mb-1.5 h-4 w-4 text-primary" />
                <span className="font-headline text-xl font-bold text-foreground">
                  {progress?.totalQuestionsAsked ?? 0}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Questions
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-muted/60 p-3 text-center">
                <Trophy className="mb-1.5 h-4 w-4 text-amber-600" />
                <span className="font-headline text-xl font-bold text-foreground">
                  {progress?.completedQuizzes ?? 0}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quizzes
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-muted/60 p-3 text-center">
                <Clock className="mb-1.5 h-4 w-4 text-slate-600" />
                <span className="font-headline text-xl font-bold text-foreground">
                  {progress?.totalQuizAttempts ?? 0}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Attempts
                </span>
              </div>
            </div>
          </div>

          {/* AI Tutor card */}
          <div className="col-span-12 flex flex-col justify-between overflow-hidden rounded-2xl bg-[#2d3133] p-8 text-white lg:col-span-4">
            <div className="relative">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md">
                <Brain className="h-5 w-5 text-[#97f2ef]" />
              </div>
              <h3 className="font-headline text-xl font-bold text-white">
                AI Clinical Tutor
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                Get instant differential diagnosis support and evidence-based clinical reasoning.
              </p>
            </div>
            <Link
              href="/student/visual-qa/workspace"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#97f2ef] px-5 py-2.5 text-sm font-bold text-[#00201f] transition-all hover:scale-[1.02] active:scale-95"
            >
              Ask AI Tutor
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Quiz CTA card */}
          <div className="col-span-12 flex flex-col justify-between rounded-2xl border border-border bg-card p-8 shadow-sm lg:col-span-3">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-headline text-xl font-bold text-foreground">
                Daily Quiz Challenge
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Sharpen your diagnostic skills with a quick practice quiz.
              </p>
            </div>
            <Link
              href="/student/quiz"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90"
            >
              Start Quiz
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Quick actions */}
          <div className="col-span-12">
            <SectionCard title="Quick actions">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {quickActions.map((action) => (
                  <QuickActionCard key={action.title} {...action} />
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Topic mastery */}
          <div className="col-span-12 lg:col-span-7">
            <SectionCard title="Topic mastery">
              {topicStats.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                  No topic analytics available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topicStats.map((topic, idx) => {
                    const pct = Math.min(
                      100,
                      Math.max(
                        0,
                        topic.accuracyRate != null && Number.isFinite(topic.accuracyRate)
                          ? Math.round(topic.accuracyRate)
                          : 0,
                      ),
                    );
                    const hasAccuracy = topic.accuracyRate != null && Number.isFinite(topic.accuracyRate);
                    return (
                      <div
                        key={topic.topicName?.trim() || `topic-${idx}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/25"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            {topic.topicName?.trim() || 'Unnamed topic'}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {hasAccuracy ? `${pct}% accuracy` : '—'}
                        </span>
                        <span className="w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {typeof topic.quizAttempts === 'number' && Number.isFinite(topic.quizAttempts)
                            ? topic.quizAttempts
                            : 0}{' '}
                          attempts
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Recent activity */}
          <div className="col-span-12 lg:col-span-5">
            <SectionCard
              title="Recent activity"
              actions={
                <Link
                  href="/student/history"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all
                </Link>
              }
            >
              {activityPending ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-muted/60"
                    />
                  ))}
                </div>
              ) : activityError ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
                  {activityError instanceof Error ? activityError.message : activityError}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
                  No recent activity has been recorded yet.
                </div>
              ) : (
                <ol className="space-y-2">
                  {recentActivity.slice(0, 5).map((activity, actIdx) => {
                    const normalizedStatus = activity.status?.toLowerCase();
                    const activityHref = resolveStudentRecentActivityHref(activity);
                    const statusBadge =
                      normalizedStatus === 'approved' || normalizedStatus === 'revised'
                        ? {
                            label: 'Verified',
                            className: 'bg-emerald-500/10 text-emerald-800',
                            icon: CheckCircle2,
                          }
                        : normalizedStatus === 'pending' || normalizedStatus === 'pendingexpert'
                          ? {
                              label: 'Under Review',
                              className: 'bg-amber-500/10 text-amber-800',
                              icon: ShieldAlert,
                            }
                          : null;
                    const StatusIcon = statusBadge?.icon;

                    return (
                      <li key={activity.id?.trim() || `activity-${actIdx}`}>
                        <Link
                          href={activityHref}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/25 hover:bg-muted/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {activity.title?.trim() || 'Activity'}
                            </p>
                            {activity.description?.trim() ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {activity.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
                              {activity.type?.trim() || 'General'}
                            </span>
                            {statusBadge && StatusIcon ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
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

        </div>
      </>
      <StudentDashboardFab />
    </DashboardOverviewLayout>
  );
}
