'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brain, BookOpen, History, ImageUp, Library, Trophy, User } from 'lucide-react';
import { DashboardOverviewLayout } from '@/components/layouts';
import { SectionCard } from '@/components/shared/SectionCard';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { useStudentDashboardQueries } from '@/features/student/hooks/useStudentDashboardQueries';
import ProgressRing from '@/components/student/ProgressRing';
import QuickActionCard from '@/components/student/QuickActionCard';
import { StudentDashboardFab } from '@/components/student/StudentAppChrome';
import { resolveStudentRecentActivityHref } from '@/lib/student/recent-activity-href';
import { useAuth } from '@/lib/useAuth';
import type { StudentTopicStat } from '@/lib/api/types';

function clampPercent(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatQuizPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [tutorDraft, setTutorDraft] = useState('');

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

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';
  const mastery = clampPercent(progress?.quizAccuracyRate ?? progress?.avgQuizScore ?? null);
  const casesViewedPct = Math.min(100, (progress?.totalCasesViewed ?? 0) * 5);

  const displayTopics = topicStats.slice(0, 3);
  const paddedTopics: (StudentTopicStat | null)[] = [...displayTopics];
  while (paddedTopics.length < 3) paddedTopics.push(null);

  return (
    <DashboardOverviewLayout title="Student dashboard" isLoading={isLoading}>
      <>
        {/* ── Hero greeting ── */}
        <section className="flex flex-col justify-between gap-6 rounded-3xl border border-[#c2c6d4]/30 bg-gradient-to-br from-[#00478d] to-[#005eb8] p-8 text-white md:flex-row md:items-center md:px-10">
          <div className="flex items-center gap-4">
            <div className="hidden h-16 w-16 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md sm:flex sm:items-center sm:justify-center">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-xs/false font-bold uppercase tracking-widest text-white/60">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="font-['Manrope',sans-serif] text-3xl font-black tracking-tight md:text-4xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-1 max-w-lg text-sm text-white/70">
                {progress
                  ? `${progress.completedQuizzes} quizzes completed \u2022 ${progress.totalCasesViewed} cases explored`
                  : 'Explore cases, ask questions, and master radiology skills'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/student/visual-qa/workspace"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#00478d] shadow-lg transition-all hover:scale-[1.03] active:scale-95"
            >
              <ImageUp className="h-5 w-5" />
              New Visual QA
            </Link>
            <Link
              href="/student/quiz"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all hover:scale-[1.03] active:scale-95"
            >
              <Trophy className="h-5 w-5" />
              Practice Quiz
            </Link>
          </div>
        </section>

        {/* ── Mastery ring + quick stats (2-col) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Mastery ring card */}
          <div className="flex flex-col items-center rounded-3xl border border-[#c2c6d4]/30 bg-white p-8 text-center shadow-sm">
            <ProgressRing progress={mastery} size={150} strokeWidth={12} color="#00478d" />
            <div className="mt-4">
              <p className="text-2xl font-black text-[#191c1e]">{mastery}%</p>
              <p className="text-xs font-bold uppercase tracking-widest text-[#727783]">Mastery</p>
            </div>
            <div className="mt-6 w-full space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[#f2f4f6] px-4 py-3">
                <span className="text-xs font-medium text-[#424752]">Latest score</span>
                <span className="text-sm font-bold text-[#191c1e]">{formatQuizPercent(progress?.latestQuizScore)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#f2f4f6] px-4 py-3">
                <span className="text-xs font-medium text-[#424752]">Total attempts</span>
                <span className="text-sm font-bold text-[#191c1e]">{progress?.totalQuizAttempts ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#f2f4f6] px-4 py-3">
                <span className="text-xs font-medium text-[#424752]">Escalated</span>
                <span className="text-sm font-bold text-[#191c1e]">{progress?.escalatedAnswers ?? 0}</span>
              </div>
            </div>
          </div>

          {/* 3-col stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Cases Viewed',
                value: progress?.totalCasesViewed ?? 0,
                sub: `${casesViewedPct}% weekly`,
                color: 'bg-[#d6e3ff] text-[#00478d]',
                Icon: BookOpen,
              },
              {
                label: 'Avg Quiz Score',
                value: formatQuizPercent(progress?.avgQuizScore),
                sub: `${progress?.completedQuizzes ?? 0} completed`,
                color: 'bg-[#ffdcc3] text-[#703a00]',
                Icon: Trophy,
              },
              {
                label: 'Accuracy Rate',
                value: formatQuizPercent(progress?.quizAccuracyRate),
                sub: `${progress?.totalQuizAttempts ?? 0} attempts`,
                color: 'bg-[#94efec] text-[#006e6d]',
                Icon: History,
              },
            ].map((stat) => {
              const Icon = stat.Icon;
              return (
                <div
                  key={stat.label}
                  className="flex flex-col justify-between gap-4 rounded-3xl border border-[#c2c6d4]/20 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-['Manrope',sans-serif] text-2xl font-black text-[#191c1e]">{stat.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#727783]">{stat.label}</p>
                    <p className="mt-1 text-xs text-[#424752]">{stat.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI Tutor + Topic Mastery (2-col) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* AI Tutor */}
          <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-[#2d3133] p-8 text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#00478d]/30 blur-3xl" />
            <div className="relative">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
                <Brain className="h-6 w-6 text-[#97f2ef]" />
              </div>
              <h2 className="mb-2 font-['Manrope',sans-serif] text-xl font-bold">AI Clinical Tutor</h2>
              <p className="text-sm leading-relaxed text-white/60">
                Get instant differential diagnosis support and evidence-based clinical reasoning.
              </p>
            </div>
            <form
              className="relative flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const q = tutorDraft.trim();
                if (q) sessionStorage.setItem('studentQaPrefill', q);
                router.push('/student/visual-qa/workspace');
              }}
            >
              <input
                value={tutorDraft}
                onChange={(e) => setTutorDraft(e.target.value)}
                className="flex-1 rounded-full border-0 bg-white/10 px-5 py-3 text-sm text-white outline-none ring-1 ring-transparent placeholder:text-white/40 focus:ring-[#97f2ef]"
                placeholder="Ask about a case..."
                type="text"
              />
              <button
                type="submit"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#97f2ef] text-[#00201f] transition-transform hover:scale-105"
                aria-label="Go to visual QA"
              >
                <ImageUp className="h-5 w-5" />
              </button>
            </form>
          </div>

          {/* Topic Mastery */}
          <SectionCard title="Topic Mastery" className="rounded-3xl !p-6">
            {topicPending ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
                ))}
              </div>
            ) : topicError ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                {topicError instanceof Error ? topicError.message : String(topicError)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {paddedTopics.map((t, i) => {
                  const pct = t ? clampPercent(t.accuracyRate) : 0;
                  const titles = ['Bone Pathology', 'Joint Articulation', 'Spinal Anatomy'];
                  const colors = ['bg-[#d6e3ff] text-[#00478d]', 'bg-[#94efec] text-[#006e6d]', 'bg-[#ffdcc3] text-[#703a00]'];
                  const bars = ['bg-[#00478d]', 'bg-[#006a68]', 'bg-[#924e00]'];
                  const title = t?.topicName ?? titles[i] ?? 'Topic';

                  return (
                    <div key={title} className="rounded-2xl border border-[#eceef0] bg-[#f2f4f6] p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`rounded-xl p-2 text-xs ${colors[i] ?? colors[0]}`}>
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-black text-[#191c1e]">{t ? `${Math.round(pct)}%` : '—'}</span>
                      </div>
                      <p className="mb-3 text-sm font-bold text-[#191c1e]">{title}</p>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eceef0]">
                        <div
                          className={`h-full rounded-full ${bars[i] ?? bars[0]}`}
                          style={{ width: `${t ? Math.max(8, pct) : 8}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#727783]">
                        {t ? `${t.quizAttempts} attempts` : 'No data yet'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Quick Actions + Recent Activity (2-col) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Quick Actions */}
          <SectionCard title="Quick Actions" className="rounded-3xl !p-6">
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
              {[
                { title: 'New Visual QA', icon: ImageUp, href: '/student/visual-qa/workspace', bg: 'bg-[#d6e3ff]', text: 'text-[#00478d]' },
                { title: 'Case Catalog', icon: Library, href: '/student/catalog', bg: 'bg-[#94efec]', text: 'text-[#006e6d]' },
                { title: 'Practice Quiz', icon: Trophy, href: '/student/quiz', bg: 'bg-[#ffdcc3]', text: 'text-[#703a00]' },
                { title: 'View History', icon: History, href: '/student/history', bg: 'bg-[#f2f4f6]', text: 'text-[#424752]' },
                { title: 'My Profile', icon: User, href: '/student/profile', bg: 'bg-[#e8eaf0]', text: 'text-[#191c1e]' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group flex items-center gap-4 rounded-2xl border border-[#eceef0] bg-[#f2f4f6] p-5 transition-all hover:-translate-y-0.5 hover:border-[#00478d]/30 hover:bg-white hover:shadow-md"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.bg}`}>
                      <Icon className={`h-5 w-5 ${action.text}`} />
                    </div>
                    <span className="text-sm font-bold text-[#191c1e] transition-colors group-hover:text-[#00478d]">
                      {action.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          {/* Recent Activity */}
          <SectionCard title="Recent Activity" className="rounded-3xl !p-6">
            {activityPending ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/60" />
                ))}
              </div>
            ) : activityError ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                {activityError instanceof Error ? activityError.message : String(activityError)}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              <ol className="space-y-3">
                {recentActivity.slice(0, 6).map((activity, actIdx) => {
                  const normalizedStatus = activity.status?.toLowerCase();
                  const activityHref = resolveStudentRecentActivityHref(activity);
                  const statusBadge =
                    normalizedStatus === 'approved' || normalizedStatus === 'revised'
                      ? { label: 'Verified', className: 'bg-[#94efec] text-[#006e6d]' }
                      : normalizedStatus === 'pending' || normalizedStatus === 'pendingexpert'
                        ? { label: 'Under Review', className: 'bg-[#ffdcc3] text-[#703a00]' }
                        : null;

                  return (
                    <li key={activity.id?.trim() || `activity-${actIdx}`}>
                      <Link
                        href={activityHref}
                        className="flex items-start gap-3 rounded-2xl border border-[#eceef0] bg-[#f2f4f6] p-4 transition-all hover:-translate-y-0.5 hover:border-[#00478d]/30 hover:bg-white hover:shadow-sm"
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d6e3ff]">
                          <BookOpen className="h-4 w-4 text-[#00478d]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#191c1e]">{activity.title?.trim() || 'Activity'}</p>
                          <p className="mt-0.5 text-xs text-[#727783] line-clamp-1">
                            {activity.description?.trim() || '—'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-[10px] font-medium text-[#727783]">
                            {activity.occurredAt?.trim() || '—'}
                          </span>
                          {statusBadge ? (
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusBadge.className}`}>
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
      </>
      <StudentDashboardFab />
    </DashboardOverviewLayout>
  );
}
