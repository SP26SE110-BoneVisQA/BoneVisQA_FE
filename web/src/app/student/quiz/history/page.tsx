'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StudentAppChrome, StudentDashboardFab } from '@/components/student/StudentAppChrome';
import { fetchStudentQuizHistoryPaged } from '@/lib/api/student';
import type { StudentQuizAttemptSummary, StudentQuizAttemptHistoryPageResult } from '@/lib/api/student';
import { useToast } from '@/components/ui/toast';
import {
  BarChart3,
  BotMessageSquare,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  RotateCcw,
  Trophy,
  Lightbulb,
  BookOpen,
  XCircle,
  BrainCircuit,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

type FilterMode = 'all' | 'ai' | 'assigned';

const PAGE_SIZE = 5;

export default function StudentQuizHistoryPage() {
  const toast = useToast();
  const [pageResult, setPageResult] = useState<StudentQuizAttemptHistoryPageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [filterAi, setFilterAi] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    // Map filter mode to isAiGenerated param
    const isAiGenerated = filter === 'ai' ? true : filter === 'assigned' ? false : undefined;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchStudentQuizHistoryPaged({
          pageIndex,
          pageSize: PAGE_SIZE,
          isAiGenerated,
        });
        if (!cancelled) {
          setPageResult(data);
          setFilterAi(isAiGenerated);
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load quiz history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast, pageIndex, filter]);

  const attempts = pageResult?.items ?? [];
  const totalCount = pageResult?.totalCount ?? 0;
  const totalPages = pageResult?.totalPages ?? 0;

  const stats = useMemo(() => {
    const completed = attempts.filter(a => a.completedAt != null).length;
    const ai = attempts.filter(a => a.isAiGenerated).length;
    const scores = attempts.filter(a => a.completedAt && a.score != null).map(a => a.score!);
    const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
    return {
      total: totalCount,
      completed,
      ai,
      avgScore,
    };
  }, [totalCount, attempts]);

  function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function scoreColor(score?: number | null): string {
    if (score == null) return 'text-[#424752]';
    if (score >= 80) return 'text-[#006a68]';
    if (score >= 60) return 'text-[#924e00]';
    return 'text-[#ba1a1a]';
  }

  return (
    <div className="min-h-screen text-[#191c1e]">
      <StudentAppChrome
        breadcrumb="Quizzes"
        title="Quiz History"
        subtitle="Review all your quiz attempts including AI-generated practice quizzes"
      />

      <div className="px-6 pb-16 pt-6 md:px-10">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[#c2c6d4]/30 bg-white">
            <div className="flex items-center gap-3 text-sm text-[#424752]">
              <Loader2 className="h-5 w-5 animate-spin text-[#00478d]" />
              Loading quiz history…
            </div>
          </div>
        ) : (
          <>
            {/* List */}
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#c2c6d4]/30 bg-white p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#424752]">Total Attempts</p>
                    <p className="mt-1 font-['Manrope',sans-serif] text-3xl font-black text-[#191c1e]">{stats.total}</p>
                  </div>
                  <div className="rounded-2xl border border-[#c2c6d4]/30 bg-white p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#424752]">Completed</p>
                    <p className="mt-1 font-['Manrope',sans-serif] text-3xl font-black text-[#006a68]">{stats.completed}</p>
                  </div>
                  <div className="rounded-2xl border border-[#c2c6d4]/30 bg-white p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#424752]">Practice Quizzes</p>
                    <p className="mt-1 font-['Manrope',sans-serif] text-3xl font-black text-[#924e00]">{stats.ai}</p>
                  </div>
                  <div className="rounded-2xl border border-[#c2c6d4]/30 bg-white p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#424752]">Avg Score</p>
                    <p className={`mt-1 font-['Manrope',sans-serif] text-3xl font-black ${scoreColor(stats.avgScore)}`}>
                      {stats.avgScore != null ? `${Math.round(stats.avgScore)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#424752]">
                    <Filter className="h-3.5 w-3.5" />
                    Filter:
                  </div>
                  {([
                    ['all', 'All'],
                    ['ai', 'Practice Quizzes'],
                    ['assigned', 'Assigned'],
                  ] as [FilterMode, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setFilter(val);
                        setPageIndex(0);
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        filter === val
                          ? 'bg-[#00478d] text-white'
                          : 'border border-[#c2c6d4]/40 bg-white text-[#424752] hover:bg-[#f2f4f6]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-[#727783]">
                    {attempts.length} of {totalCount} attempt{totalCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* List */}
                {attempts.length === 0 && !loading ? (
                  <div className="rounded-2xl border border-dashed border-[#c2c6d4] bg-white px-6 py-16 text-center">
                    <Trophy className="mx-auto h-10 w-10 text-[#727783]" />
                    <h3 className="mt-4 text-lg font-semibold text-[#191c1e]">No quiz history yet</h3>
                    <p className="mt-2 text-sm text-[#424752]">
                      {filter === 'ai'
                        ? 'You have not generated any AI practice quizzes yet.'
                        : 'Your completed quiz attempts will appear here.'}
                    </p>
                    {filter === 'ai' && (
                      <div className="mt-6 flex flex-col items-center gap-4">
                        <p className="text-sm text-[#424752]">Want to strengthen your knowledge?</p>
                        <Link
                          href="/student/review"
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-[#007BFF] px-6 py-3 text-sm font-bold text-white shadow-lg hover:opacity-95"
                        >
                          <BrainCircuit className="h-4 w-4" />
                          Review Flashcards
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {attempts.map((attempt) => (
                      <div
                        key={attempt.attemptId}
                        className={`overflow-hidden rounded-2xl border transition-all ${
                          'border-[#c2c6d4]/30 hover:border-[#00478d]/30'
                        } bg-white`}
                      >
                        {/* Row */}
                        <div
                          className="flex cursor-pointer items-center justify-between p-5 hover:bg-[#f2f4f6]/50"
                          onClick={() => {
                            setExpanded(expanded === attempt.attemptId ? null : attempt.attemptId);
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                attempt.isAiGenerated
                                  ? 'bg-[#ffdcc3]/30 text-[#703a00]'
                                  : 'bg-[#d6e3ff] text-[#00478d]'
                              }`}
                            >
                              {attempt.isAiGenerated ? (
                                <BotMessageSquare className="h-5 w-5" />
                              ) : (
                                <Trophy className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-semibold text-[#191c1e]">{attempt.quizTitle}</h3>
                                {attempt.isAiGenerated && (
                                  <span className="shrink-0 rounded-full bg-[#ffdcc3] px-2 py-0.5 text-[10px] font-bold text-[#703a00]">
                                    AI
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#727783]">
                                {attempt.topic && <span>{attempt.topic}</span>}
                                {attempt.difficulty && (
                                  <span className="rounded bg-[#eceef0] px-1.5 py-0.5 text-[10px]">{attempt.difficulty}</span>
                                )}
                                {attempt.className && <span>{attempt.className}</span>}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(attempt.startedAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <BarChart3 className="h-3 w-3" />
                                  {attempt.totalQuestions} Qs
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-4">
                            {/* Score */}
                            {attempt.completedAt ? (
                              <div className="text-right">
                                {attempt.score != null ? (
                                  <>
                                    <p className={`text-xl font-black ${scoreColor(attempt.score)}`}>
                                      {attempt.correctAnswers}/{attempt.totalQuestions}
                                    </p>
                                    <p className="text-xs text-[#727783]">
                                      {Math.round(attempt.score)}%
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-[#727783]">Submitted</p>
                                )}
                              </div>
                            ) : (
                              <span className="rounded-full bg-[#ffdcc3]/40 px-3 py-1 text-xs font-semibold text-[#703a00]">
                                In Progress
                              </span>
                            )}

                            {/* Status badge */}
                            {attempt.completedAt ? (
                              attempt.passed ? (
                                <CheckCircle className="h-5 w-5 text-[#006a68]" />
                              ) : (
                                <XCircle className="h-5 w-5 text-[#ba1a1a]" />
                              )
                            ) : (
                              <RotateCcw className="h-5 w-5 text-[#727783]" />
                            )}

                            <ChevronRight
                              className={`h-4 w-4 text-[#727783] transition-transform ${
                                expanded === attempt.attemptId ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </div>

                        {/* Expanded: detail card */}
                        {expanded === attempt.attemptId && (
                          <div className="border-t border-[#eceef0] p-5">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                              <div className="rounded-xl bg-[#f2f4f6] p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#727783]">Started</p>
                                <p className="mt-1 text-sm font-semibold">{formatDate(attempt.startedAt)}</p>
                              </div>
                              <div className="rounded-xl bg-[#f2f4f6] p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#727783]">Completed</p>
                                <p className="mt-1 text-sm font-semibold">{formatDate(attempt.completedAt)}</p>
                              </div>
                              <div className="rounded-xl bg-[#f2f4f6] p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#727783]">Passing Score</p>
                                <p className="mt-1 text-sm font-semibold">
                                  {attempt.passingScore != null ? `${attempt.passingScore}%` : '—'}
                                </p>
                              </div>
                              <div className="rounded-xl bg-[#f2f4f6] p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#727783]">Result</p>
                                <p className={`mt-1 flex items-center justify-center gap-1 text-sm font-bold ${
                                  attempt.passed ? 'text-[#006a68]' : 'text-[#ba1a1a]'
                                }`}>
                                  {attempt.passed ? (
                                    <><CheckCircle className="h-4 w-4" /> Passed</>
                                  ) : (
                                    <><XCircle className="h-4 w-4" /> Retry</>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              {attempt.isAiGenerated && attempt.completedAt && (
                                <Link
                                  href={`/student/quiz?regenerate=${encodeURIComponent(attempt.topic ?? attempt.quizTitle)}`}
                                  className="flex items-center gap-2 rounded-xl border border-[#924e00]/30 bg-[#ffdcc3]/20 px-4 py-2 text-xs font-bold text-[#703a00] transition-colors hover:bg-[#ffdcc3]/40"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Regenerate this topic
                                </Link>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPageIndex(0)}
                        disabled={pageIndex === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c2c6d4]/40 text-[#424752] transition-colors hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                        disabled={pageIndex === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c2c6d4]/40 text-[#424752] transition-colors hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i;
                          } else if (pageIndex < 3) {
                            pageNum = i;
                          } else if (pageIndex > totalPages - 3) {
                            pageNum = totalPages - 5 + i;
                          } else {
                            pageNum = pageIndex - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setPageIndex(pageNum)}
                              className={`flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                                pageIndex === pageNum
                                  ? 'bg-[#00478d] text-white'
                                  : 'border border-[#c2c6d4]/40 text-[#424752] hover:bg-[#f2f4f6]'
                              }`}
                            >
                              {pageNum + 1}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
                        disabled={pageIndex >= totalPages - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c2c6d4]/40 text-[#424752] transition-colors hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageIndex(totalPages - 1)}
                        disabled={pageIndex >= totalPages - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c2c6d4]/40 text-[#424752] transition-colors hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
      </div>

      <StudentDashboardFab />
    </div>
  );
}