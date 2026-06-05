'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import { AssignedQuizzesList } from '@/features/student/components/AssignedQuizzesList';
import { useStudentAssignedQuizzes } from '@/features/student/queries/use-student-assigned-quizzes';
import { StudentPracticeQuizContent } from '@/components/student/StudentPracticeQuizContent';
import { ClipboardList, Sparkles, Search, X, Filter } from 'lucide-react';

type QuizTab = 'assigned' | 'practice';
type QuizStatusFilter = 'all' | 'completed' | 'not-completed';
type QuizModeFilter = 'all' | '1' | '2';

const PAGE_SIZE = 5;

export function QuizzesPage() {
  const searchParams = useSearchParams();
  const initialTab: QuizTab = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
  const [tab, setTab] = useState<QuizTab>(initialTab);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuizStatusFilter>('all');
  const [modeFilter, setModeFilter] = useState<QuizModeFilter>('all');
  const assignedQuery = useStudentAssignedQuizzes();

  useEffect(() => {
    const t = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    setPageIndex(0);
  }, [assignedQuery.data, searchTerm, statusFilter, modeFilter]);

  const assignedQuizzes = assignedQuery.data ?? [];
  const filteredQuizzes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return assignedQuizzes.filter((quiz) => {
      const matchesSearch =
        term.length === 0 ||
        quiz.quizName?.toLowerCase().includes(term) ||
        quiz.className?.toLowerCase().includes(term) ||
        quiz.topic?.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && quiz.isCompleted) ||
        (statusFilter === 'not-completed' && !quiz.isCompleted);

      const matchesMode = modeFilter === 'all' || String(quiz.quizMode ?? '') === modeFilter;

      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [assignedQuizzes, searchTerm, statusFilter, modeFilter]);

  const totalItems = filteredQuizzes.length;
  const pageItems = filteredQuizzes.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== 'all' || modeFilter !== 'all';

  function clearFilters() {
    setSearchTerm('');
    setStatusFilter('all');
    setModeFilter('all');
  }

  return (
    <ListPageLayout
      title="Quizzes"
      isLoading={tab === 'assigned' && assignedQuery.isPending}
      skeletonVariant="list"
      maxWidthClass="max-w-7xl"
      toolbar={
        <div className="flex flex-col gap-3">
          <div
            className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 p-1"
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
              Assigned quizzes
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
              Practice quizzes
            </button>
          </div>

          {tab === 'assigned' ? (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by quiz, class, or topic"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as QuizStatusFilter)}
                    className="h-11 min-w-[150px] bg-transparent text-sm outline-none"
                    aria-label="Filter by completion status"
                  >
                    <option value="all">All status</option>
                    <option value="completed">Completed</option>
                    <option value="not-completed">Not completed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value as QuizModeFilter)}
                    className="h-11 min-w-[150px] bg-transparent text-sm outline-none"
                    aria-label="Filter by quiz mode"
                  >
                    <option value="all">All modes</option>
                    <option value="1">Exam mode</option>
                    <option value="2">Practice mode</option>
                  </select>
                </div>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      {tab === 'assigned' ? (
        <AssignedQuizzesList
          items={pageItems}
          isPending={assignedQuery.isPending}
          error={assignedQuery.error}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          hasActiveFilters={hasActiveFilters}
        />
      ) : (
        <StudentPracticeQuizContent embedded />
      )}
    </ListPageLayout>
  );
}
