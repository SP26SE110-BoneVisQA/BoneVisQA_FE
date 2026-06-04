'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Brain,
  Download,
  Loader2,
  Star,
  TrendingUp,
} from 'lucide-react';
import type { StudentCaseHistoryItem, StudentProgress, StudentTopicStat } from '@/lib/api/types';

const RING_R = 100;
const RING_C = 2 * Math.PI * RING_R;

function clampPct(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function formatHistoryDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortCaseRef(id: string): string {
  const clean = id.replace(/-/g, '').slice(0, 4).toUpperCase();
  return clean ? `#BV-${clean}` : '#BV-0000';
}

function statusToStars(status?: string): number {
  const s = (status ?? '').toLowerCase();
  if (s.includes('approved') || s.includes('revised')) return 5;
  if (s.includes('pending')) return 3;
  if (s.includes('reject')) return 2;
  return 4;
}

function diagnosticStatusBadge(status?: string): { label: string; dot: string; wrap: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('approved') || s.includes('revised')) {
    return {
      label: 'Verified',
      dot: 'bg-emerald-500',
      wrap: 'bg-emerald-500/10 text-emerald-800',
    };
  }
  return {
    label: 'Under Review',
    dot: 'bg-amber-600',
    wrap: 'bg-amber-500/10 text-amber-800',
  };
}

function buildInsight(progress: StudentProgress): string {
  const acc = progress.quizAccuracyRate;
  const cases = progress.totalCasesViewed;
  const q = progress.totalQuestionsAsked;
  if (acc != null && !Number.isNaN(acc)) {
    return `Your quiz accuracy is around ${Math.round(acc)}%. You have viewed ${cases} case(s) and asked ${q} question(s). Keep practicing multi-region patterns to balance speed and precision.`;
  }
  return `You have viewed ${cases} case(s) and asked ${q} question(s). Complete a quiz to unlock accuracy insights and tailored study tips.`;
}

export function downloadProgressJson(progress: StudentProgress, topicStats: StudentTopicStat[]) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          progress,
          topicStats,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bonevisqa-student-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function StudentClinicalBento({
  progress,
  topicStats,
  caseHistory,
}: {
  progress: StudentProgress;
  topicStats: StudentTopicStat[];
  caseHistory: StudentCaseHistoryItem[];
}) {
  const router = useRouter();
  const [tutorDraft, setTutorDraft] = useState('');

  const mastery = Math.round(
    clampPct(progress.quizAccuracyRate ?? progress.avgQuizScore ?? null) || 0,
  );
  const ringOffset = RING_C * (1 - mastery / 100);

  const displayTopics = topicStats.slice(0, 3);
  const paddedTopics: (StudentTopicStat | null)[] = [...displayTopics];
  while (paddedTopics.length < 3) paddedTopics.push(null);

  const challengeTopic = topicStats[0]?.topicName ?? 'Spinal Anatomy';

  const tableRows = caseHistory.slice(0, 6);

  const weeklyLabel =
    progress.completedQuizzes > 0
      ? `+${Math.min(99, progress.completedQuizzes * 4)}% vs idle`
      : 'Start your first quiz';

  const topicColors = [
    { bar: 'bg-primary', iconBg: 'bg-primary/10', iconText: 'text-primary' },
    { bar: 'bg-teal-500', iconBg: 'bg-teal-500/10', iconText: 'text-teal-600' },
    { bar: 'bg-orange-500', iconBg: 'bg-orange-500/10', iconText: 'text-orange-600' },
  ];
  const topicLabels = ['Bone Pathology', 'Joint Articulation', 'Spinal Anatomy'];
  const topicIcons = [Activity, TrendingUp, Star];

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Welcome back
          </p>
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Clinical Performance Insight
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadProgressJson(progress, topicStats)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <Link
            href="/student/catalog"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Start New Case
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">

        {/* Mastery hero */}
        <div className="col-span-12 flex flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 shadow-sm lg:col-span-7 lg:flex-row">
          <div className="relative h-48 w-48 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 224 224" aria-hidden="true">
              <circle
                cx="112"
                cy="112"
                fill="none"
                r={RING_R}
                stroke="var(--muted)"
                strokeWidth="12"
              />
              <circle
                cx="112"
                cy="112"
                fill="none"
                r={RING_R}
                stroke="var(--primary)"
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                strokeWidth="12"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-5xl font-black text-foreground">
                {mastery}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Mastery
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-headline mb-2 text-xl font-bold text-foreground">
              Diagnostic Precision
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {buildInsight(progress)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Weekly Growth</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-headline text-lg font-bold text-foreground">{weeklyLabel}</span>
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Peer context</p>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-headline text-lg font-bold text-foreground">Track locally</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Global rank is not provided by the API yet.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI tutor */}
        <div className="col-span-12 flex flex-col justify-between overflow-hidden rounded-2xl bg-[#2d3133] p-8 text-white md:col-span-6 lg:col-span-5">
          <div className="relative">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md">
              <Brain className="h-5 w-5 text-[#97f2ef]" />
            </div>
            <h3 className="font-headline text-xl font-bold text-white">
              AI Clinical Tutor
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Instant differential diagnosis support and evidence-based clinical reasoning — start from the topic Q&amp;A hub (RAG). Image-based Visual QA stays on its dedicated flow.
            </p>
          </div>
          <form
            className="relative mt-6 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const q = tutorDraft.trim();
              if (q) {
                sessionStorage.setItem('studentQaPrefill', q);
              }
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
              aria-label="Go to topic Q&A"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* Topics */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-8 lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-headline text-lg font-bold text-foreground">
              Topic Specialization
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lifetime Progress
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {paddedTopics.map((t, i) => {
              const pct = t ? clampPct(t.accuracyRate) : 0;
              const title = t?.topicName ?? topicLabels[i] ?? 'Topic';
              const Icon = topicIcons[i] ?? Activity;
              const colors = topicColors[i];
              return (
                <div key={`${title}-${i}`} className="rounded-xl border border-border bg-muted/30 p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <span className={`rounded-lg p-2.5 ${colors.iconBg}`}>
                      <Icon className={`h-5 w-5 ${colors.iconText}`} />
                    </span>
                    <span className="font-headline text-lg font-bold text-foreground">
                      {t ? `${Math.round(pct)}%` : '—'}
                    </span>
                  </div>
                  <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${colors.bar}`}
                      style={{ width: `${t ? pct : 8}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t ? `${t.quizAttempts} quiz attempts` : 'No data yet'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily challenge */}
        <div className="col-span-12 flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary/5 p-8 lg:col-span-4">
          <div>
            <h3 className="font-headline text-lg font-bold text-foreground">
              Daily Quiz Challenge
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Boost your mastery in <span className="font-semibold text-foreground">{challengeTopic}</span> with a practice or class quiz.
            </p>
          </div>
          <div className="mt-8">
            <div className="mb-4 flex -space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-white">
                BV
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-sky-600 text-[10px] font-bold text-white">
                QA
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold text-muted-foreground">
                +12
              </div>
            </div>
            <Link
              href="/student/quiz"
              className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90"
            >
              Start Challenge
            </Link>
          </div>
        </div>

        {/* History table */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-headline text-lg font-bold text-foreground">
              Diagnostic History
            </h3>
            <Link href="/student/history" className="text-sm font-semibold text-primary hover:underline">
              View All History
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="pb-4">Case Reference</th>
                  <th className="pb-4">Diagnosis Category</th>
                  <th className="pb-4">Completion Date</th>
                  <th className="pb-4">Performance</th>
                  <th className="pb-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No case history yet. Open the case library or complete a quiz to populate this table.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => {
                    const stars = statusToStars(row.status);
                    const badge = diagnosticStatusBadge(row.status);
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-muted/30">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3133]">
                              <Activity className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Case {shortCaseRef(row.id)}
                              </p>
                              <p className="text-xs text-muted-foreground">{row.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">{row.lesionType}</td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {formatHistoryDate(row.askedAt)}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, si) => (
                              <Star
                                key={si}
                                className={`h-4 w-4 ${
                                  si < stars ? 'fill-primary text-primary' : 'fill-muted text-muted'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.wrap}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}

export function StudentClinicalBentoSkeleton() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Loading clinical dashboard…
      </div>
    </div>
  );
}
