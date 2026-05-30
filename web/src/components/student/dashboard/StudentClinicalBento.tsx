'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bone,
  Brain,
  Loader2,
  Scan,
  Star,
  TrendingUp,
  AlignVerticalJustifyCenter,
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
      dot: 'bg-[#006a68]',
      wrap: 'bg-[#94efec]/40 text-[#006e6d]',
    };
  }
  return {
    label: 'Under Review',
    dot: 'bg-[#703a00]',
    wrap: 'bg-[#ffdcc3]/60 text-[#6e3900]',
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

  return (
    <>
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#00478d]">
            Welcome Back
          </span>
          <h2 className="font-['Manrope',sans-serif] text-3xl font-extrabold tracking-tight text-[#191c1e] md:text-4xl">
            Clinical Performance Insight
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadProgressJson(progress, topicStats)}
            className="rounded-full bg-[#e6e8ea] px-6 py-3 text-sm font-bold text-[#00468c] transition-all hover:bg-[#e0e3e5]"
          >
            Download Report
          </button>
          <Link
            href="/student/catalog"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00478d] to-[#005eb8] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#00478d]/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span className="text-lg leading-none">+</span>
            Start New Case
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* Mastery hero */}
        <div className="col-span-12 flex flex-col items-center gap-10 rounded-3xl border border-[#c2c6d4]/30 bg-white p-8 lg:col-span-7 lg:flex-row">
          <div className="relative h-56 w-56 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 224 224" aria-hidden>
              <circle
                className="text-[#eceef0]"
                cx="112"
                cy="112"
                fill="transparent"
                r={RING_R}
                stroke="currentColor"
                strokeWidth="12"
              />
              <circle
                className="text-[#00478d]"
                cx="112"
                cy="112"
                fill="transparent"
                r={RING_R}
                stroke="currentColor"
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                strokeWidth="12"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Manrope',sans-serif] text-5xl font-black text-[#191c1e]">
                {mastery}%
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#424752]">
                Mastery
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="mb-3 font-['Manrope',sans-serif] text-2xl font-bold text-[#191c1e]">
              Diagnostic Precision
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-[#424752]">
              {buildInsight(progress)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#f2f4f6] p-4">
                <p className="mb-1 text-xs font-medium text-[#424752]">Weekly Growth</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#006a68]" />
                  <span className="text-lg font-bold text-[#191c1e]">{weeklyLabel}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-[#f2f4f6] p-4">
                <p className="mb-1 text-xs font-medium text-[#424752]">Peer context</p>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#00478d]" />
                  <span className="text-lg font-bold text-[#191c1e]">Track locally</span>
                </div>
                <p className="mt-1 text-[10px] text-[#727783]">
                  Global rank is not provided by the API yet.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI tutor */}
        <div className="col-span-12 flex flex-col justify-between overflow-hidden rounded-3xl bg-[#2d3133] p-8 text-white md:col-span-6 lg:col-span-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-[#00478d]/20 blur-3xl" />
          <div className="relative">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
              <Brain className="h-6 w-6 text-[#97f2ef]" />
            </div>
            <h3 className="mb-2 font-['Manrope',sans-serif] text-2xl font-bold">AI Clinical Tutor</h3>
            <p className="mb-8 text-sm leading-relaxed text-white/60">
              Instant differential diagnosis support and evidence-based clinical reasoning — start from the topic Q&amp;A
              hub (RAG). Image-based Visual QA stays on its dedicated flow.
            </p>
          </div>
          <form
            className="relative flex gap-3"
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
        <div className="col-span-12 rounded-3xl border border-[#c2c6d4]/20 bg-[#f2f4f6] p-8 lg:col-span-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-[#191c1e]">
              Topic Specialization
            </h3>
            <div className="flex items-center gap-2 text-xs font-bold text-[#424752]">
              <span>LIFETIME PROGRESS</span>
              <span className="text-[#727783]" title="Based on quiz attempts and accuracy from the API">
                ⓘ
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {paddedTopics.map((t, i) => {
              const pct = t ? clampPct(t.accuracyRate) : 0;
              const labels = ['Bone Pathology', 'Joint Articulation', 'Spinal Anatomy'];
              const icons = [Bone, Scan, AlignVerticalJustifyCenter];
              const Icon = icons[i] ?? Activity;
              const barColors = ['bg-[#00478d]', 'bg-[#006a68]', 'bg-[#924e00]'];
              const iconBg = ['bg-[#d6e3ff]', 'bg-[#94efec]', 'bg-[#ffdcc3]'];
              const title = t?.topicName ?? labels[i] ?? 'Topic';

              return (
                <div key={`${title}-${i}`} className="rounded-2xl bg-white p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <span className={`rounded-xl p-3 ${iconBg[i] ?? 'bg-slate-100'}`}>
                      <Icon className={`h-5 w-5 ${i === 0 ? 'text-[#00478d]' : i === 1 ? 'text-[#006a68]' : 'text-[#703a00]'}`} />
                    </span>
                    <span className="text-xs font-bold text-[#424752]">
                      {t ? `${Math.round(pct)}%` : '—'}
                    </span>
                  </div>
                  <p className="mb-3 font-bold text-[#191c1e]">{title}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eceef0]">
                    <div
                      className={`h-full rounded-full ${barColors[i] ?? 'bg-primary'}`}
                      style={{ width: `${t ? pct : 8}%` }}
                    />
                  </div>
                  {t ? (
                    <p className="mt-2 text-xs text-[#727783]">{t.quizAttempts} quiz attempts</p>
                  ) : (
                    <p className="mt-2 text-xs text-[#727783]">No data yet</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily challenge */}
        <div className="col-span-12 flex flex-col justify-between rounded-3xl border border-[#006a68]/20 bg-[#94efec]/30 p-8 lg:col-span-4">
          <div>
            <h3 className="mb-2 font-['Manrope',sans-serif] text-xl font-bold text-[#006e6d]">
              Daily Quiz Challenge
            </h3>
            <p className="text-sm leading-relaxed text-[#006e6d]/80">
              Boost your mastery in <span className="font-bold text-[#006e6d]">{challengeTopic}</span>{' '}
              with a practice or class quiz.
            </p>
          </div>
          <div className="mt-8">
            <div className="mb-4 flex -space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#006a68] text-[10px] font-bold text-white">
                BV
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#00478d] text-[10px] font-bold text-white">
                QA
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-400 text-[10px] font-bold text-white">
                +12
              </div>
            </div>
            <Link
              href="/student/quiz"
              className="block w-full rounded-2xl bg-[#006a68] py-4 text-center text-sm font-bold text-white shadow-lg shadow-[#006a68]/10 transition-colors hover:bg-[#006e6d]"
            >
              Start Challenge
            </Link>
          </div>
        </div>

        {/* History table */}
        <div className="col-span-12 rounded-3xl border border-[#c2c6d4]/20 bg-white p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-[#191c1e]">
              Diagnostic History
            </h3>
            <Link href="/student/history" className="text-sm font-bold text-[#00478d] hover:underline">
              View All History
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-[#eceef0] text-xs font-bold uppercase tracking-widest text-[#424752]">
                  <th className="pb-4">Case Reference</th>
                  <th className="pb-4">Diagnosis Category</th>
                  <th className="pb-4">Completion Date</th>
                  <th className="pb-4">Performance</th>
                  <th className="pb-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0]">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-[#727783]">
                      No case history yet. Open the case library or complete a quiz to populate this table.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => {
                    const stars = statusToStars(row.status);
                    const badge = diagnosticStatusBadge(row.status);
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-[#f2f4f6]/80">
                        <td className="py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2d3133]">
                              <Scan className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#191c1e]">
                                Case {shortCaseRef(row.id)}
                              </p>
                              <p className="text-xs text-[#424752]">{row.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 text-sm text-[#424752]">{row.lesionType}</td>
                        <td className="py-5 text-sm text-[#424752]">
                          {formatHistoryDate(row.askedAt)}
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, si) => (
                              <Star
                                key={si}
                                className={`h-4 w-4 ${
                                  si < stars ? 'fill-[#94efec] text-[#94efec]' : 'text-[#eceef0]'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-5 text-right">
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
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#c2c6d4]/30 bg-white">
      <div className="flex items-center gap-3 text-sm text-[#424752]">
        <Loader2 className="h-6 w-6 animate-spin text-[#00478d]" />
        Loading clinical dashboard…
      </div>
    </div>
  );
}
