'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import { StudentPracticeQuizContent } from '@/components/student/StudentPracticeQuizContent';
import { useToast } from '@/components/ui/toast';
import { fetchStudentQuizHistory, getAssignedQuizzes } from '@/lib/api/student';
import type { AssignedQuizItem } from '@/lib/api/types';
import type { StudentQuizAttemptSummary } from '@/lib/api/student';
import {
  BookOpen,
  ClipboardList,
  Loader2,
  Sparkles,
  Timer,
  BarChart3,
  BotMessageSquare,
  CheckCircle,
  ChevronRight,
  Clock,
  Trophy,
  XCircle,
  RotateCcw,
  Filter,
  History,
} from 'lucide-react';

type QuizTab = 'assigned' | 'practice' | 'history';

type FilterMode = 'all' | 'ai' | 'assigned';

function formatDue(closeTime?: string | null, openTime?: string | null) {
  if (closeTime) {
    const d = new Date(closeTime);
    if (!Number.isNaN(d.getTime())) return `Closes ${d.toLocaleString()}`;
  }
  if (openTime) {
    const d = new Date(openTime);
    if (!Number.isNaN(d.getTime())) return `Opens ${d.toLocaleString()}`;
  }
  return 'Schedule set by your lecturer';
}

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

/**
 * Normalize score to percentage (0-100).
 * Handles cases where backend might return score as decimal (0.85) or percentage (85).
 */
function normalizeScoreToPercentage(score: number | null | undefined): number | null {
  if (score == null) return null;
  // If score > 100, assume it's already a percentage
  // If score is between 0-1, assume it's a decimal that needs to be converted to percentage
  if (score > 100) return score;
  if (score <= 1 && score >= 0) return Math.round(score * 100);
  return score;
}

function QuizHistoryPanel() {
  const toast = useToast();
  const [attempts, setAttempts] = useState<StudentQuizAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStudentQuizHistory();
        if (!cancelled) setAttempts(data);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load quiz history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    if (filter === 'ai') return attempts.filter((a) => a.isAiGenerated);
    if (filter === 'assigned') return attempts.filter((a) => !a.isAiGenerated);
    return attempts;
  }, [attempts, filter]);

  const stats = useMemo(() => {
    const completed = attempts.filter((a) => a.completedAt);
    const aiAttempts = attempts.filter((a) => a.isAiGenerated);
    // Include all scores > 0 or scores === 0 (0 is a valid score)
    // Only exclude null/undefined values
    const scores = completed.map((a) => normalizeScoreToPercentage(a.score)).filter((s) => s !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { total: attempts.length, completed: completed.length, ai: aiAttempts.length, avgScore: avg };
  }, [attempts]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading quiz history…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-black text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-black text-[#006a68]">{stats.completed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Practice</p>
          <p className="mt-1 text-2xl font-black text-[#924e00]">{stats.ai}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg Score</p>
          <p className={`mt-1 text-2xl font-black ${scoreColor(stats.avgScore)}`}>
            {stats.avgScore != null ? `${Math.round(stats.avgScore)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filter:
        </div>
        {(['all', 'ai', 'assigned'] as FilterMode[]).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === val
                ? 'bg-primary text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {val === 'all' ? 'All' : val === 'ai' ? 'Practice' : 'Assigned'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} attempt{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No quiz history yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your completed quiz attempts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((attempt) => (
            <div key={attempt.attemptId} className="overflow-hidden rounded-xl border border-border bg-card">
              <div
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50"
                onClick={() => setExpanded(expanded === attempt.attemptId ? null : attempt.attemptId)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      attempt.isAiGenerated ? 'bg-[#ffdcc3]/30 text-[#703a00]' : 'bg-[#d6e3ff] text-[#00478d]'
                    }`}
                  >
                    {attempt.isAiGenerated ? <BotMessageSquare className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{attempt.quizTitle}</h3>
                      {attempt.isAiGenerated && (
                        <span className="shrink-0 rounded-full bg-[#ffdcc3] px-2 py-0.5 text-[10px] font-bold text-[#703a00]">
                          AI
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {attempt.topic && <span>{attempt.topic}</span>}
                      {attempt.difficulty && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{attempt.difficulty}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(attempt.startedAt)}</span>
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{attempt.totalQuestions > 0 ? `${attempt.totalQuestions} Qs` : '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {attempt.completedAt ? (
                    <div className="text-right">
                      {attempt.score != null ? (
                        <>
                          <p className={`text-lg font-black ${scoreColor(normalizeScoreToPercentage(attempt.score))}`}>{normalizeScoreToPercentage(attempt.score)}%</p>
                          <p className="text-[10px] text-muted-foreground">
                            {attempt.totalQuestions > 0 ? `${attempt.correctAnswers}/${attempt.totalQuestions}` : `${attempt.correctAnswers} correct`}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Submitted</p>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-full bg-[#ffdcc3]/40 px-2 py-1 text-[10px] font-semibold text-[#703a00]">In Progress</span>
                  )}
                  {attempt.completedAt ? (
                    attempt.passed ? <CheckCircle className="h-4 w-4 text-[#006a68]" /> : <XCircle className="h-4 w-4 text-[#ba1a1a]" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  )}
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === attempt.attemptId ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {expanded === attempt.attemptId && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Started</p>
                      <p className="mt-1 text-xs font-semibold">{formatDate(attempt.startedAt)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Completed</p>
                      <p className="mt-1 text-xs font-semibold">{formatDate(attempt.completedAt)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Passing</p>
                      <p className="mt-1 text-xs font-semibold">{attempt.passingScore != null ? `${attempt.passingScore}%` : '70%'}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Result</p>
                      <p className={`mt-1 flex items-center justify-center gap-1 text-xs font-bold ${attempt.passed ? 'text-[#006a68]' : 'text-[#ba1a1a]'}`}>
                        {attempt.passed ? <><CheckCircle className="h-3 w-3" /> Passed</> : <><XCircle className="h-3 w-3" /> Retry</>}
                      </p>
                    </div>
                  </div>
                  {attempt.isAiGenerated && attempt.completedAt && (
                    <div className="mt-3">
                      <Link
                        href={`/student/quiz?regenerate=${encodeURIComponent(attempt.topic ?? attempt.quizTitle)}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#924e00]/30 bg-[#ffdcc3]/20 px-3 py-1.5 text-xs font-bold text-[#703a00] hover:bg-[#ffdcc3]/40"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Regenerate this topic
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignedPracticeQuizzesPanel() {
  const toast = useToast();
  const [items, setItems] = useState<AssignedQuizItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssignedQuizzes();
      // Sort by newest first (by createdAt descending, fallback to quizId)
      const sorted = [...data].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        // Fallback: sort by quizId to keep consistent order
        return a.quizId.localeCompare(b.quizId);
      });
      setItems(sorted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assigned quizzes.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading your class quizzes…
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">No practice quizzes yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          When your lecturer assigns a quiz to one of your classes, it will appear here. You can still use Practice
          Quizzes to study on your own.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((q) => (
        <li
          key={`${q.classId}-${q.quizId}`}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Required
              </span>
              {q.isCompleted ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  Completed
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 font-semibold text-foreground">{q.quizName}</h3>
            <p className="text-sm text-muted-foreground">{q.className}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {q.totalQuestions || '—'} questions
              </span>
              {q.timeLimit != null ? (
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {q.timeLimit} min
                </span>
              ) : null}
              {q.topic ? <span>Topic: {q.topic}</span> : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatDue(q.closeTime, q.openTime)}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {q.score != null ? (
              <span className="text-sm font-semibold text-foreground">Last score: {Math.round(q.score)}%</span>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              {q.isCompleted ? (
                <>
                  {q.answersReleased ? (
                    <Link
                      href={`/student/quiz/${q.quizId}`}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:w-auto"
                    >
                      Review
                    </Link>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center rounded-lg border border-muted bg-muted/50 px-4 text-sm font-medium text-muted-foreground sm:w-auto">
                      Awaiting Release
                    </span>
                  )}
                  <Link
                    href={`/student/quiz/${q.quizId}?retake=true`}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-white hover:opacity-95 sm:w-auto"
                  >
                    Retake
                  </Link>
                </>
              ) : (
                <Link
                  href={`/student/quiz/${q.quizId}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-white hover:opacity-95 sm:w-auto"
                >
                  Start quiz
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuizzesPageInner() {
  const searchParams = useSearchParams();
  const initialTab: QuizTab = searchParams.get('tab') === 'practice' ? 'practice' : searchParams.get('tab') === 'history' ? 'history' : 'assigned';
  const [tab, setTab] = useState<QuizTab>(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab') === 'practice' ? 'practice' : searchParams.get('tab') === 'history' ? 'history' : 'assigned';
    setTab(t);
  }, [searchParams]);

  return (
    <div className="min-h-screen">
      <Header
        title="Quizzes"
        subtitle="Practice quizzes can be assigned by lecturers or self-generated for revision."
      />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <div
          className="mb-8 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 p-1"
          role="tablist"
          aria-label="Quiz categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'assigned'}
            className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'assigned'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('assigned')}
          >
            <ClipboardList className="h-4 w-4" />
            Assigned
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'practice'}
            className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'practice'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('practice')}
          >
            <Sparkles className="h-4 w-4" />
            Practice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'history'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('history')}
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>

        {tab === 'assigned' && <AssignedPracticeQuizzesPanel />}
        {tab === 'practice' && <StudentPracticeQuizContent embedded />}
        {tab === 'history' && <QuizHistoryPanel />}
      </div>
    </div>
  );
}

export default function StudentQuizzesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <QuizzesPageInner />
    </Suspense>
  );
}
