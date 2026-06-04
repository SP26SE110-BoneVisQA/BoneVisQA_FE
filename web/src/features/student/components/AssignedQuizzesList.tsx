'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AssignedQuizItem } from '@/lib/api/types';
import { getQueryErrorMessage } from '@/lib/query-utils';
import { BookOpen, ClipboardList, Timer, ChevronLeft, ChevronRight } from 'lucide-react';

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

type AssignedQuizzesListProps = {
  items: AssignedQuizItem[];
  isPending: boolean;
  error: Error | null;
  totalItems: number;
  pageSize: number;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
};

export function AssignedQuizzesList({
  items,
  isPending,
  error,
  totalItems,
  pageSize,
  pageIndex,
  onPageChange,
}: AssignedQuizzesListProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalItems);

  if (isPending) {
    return null;
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load assigned quizzes"
      />
    );
  }

  if (totalItems === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6 text-muted-foreground" />}
        title="No practice quizzes yet"
      />
    );
  }

  return (
    <div className="space-y-4">
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
                <span className="text-sm font-semibold text-foreground">
                  Last score: {Math.round(q.score)}%
                </span>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {q.isCompleted ? (
                  <>
                    <Link
                      href={`/student/quiz/${q.quizId}`}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100 sm:w-auto"
                    >
                      Review
                    </Link>
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

      {totalPages > 1 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {start}-{end} of {totalItems}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[2.5rem] text-center text-sm font-semibold text-foreground">
              {pageIndex + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
              disabled={pageIndex >= totalPages - 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
