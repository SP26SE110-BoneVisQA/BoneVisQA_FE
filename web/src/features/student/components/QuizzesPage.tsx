'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import { AssignedQuizzesList } from '@/features/student/components/AssignedQuizzesList';
import { useStudentAssignedQuizzes } from '@/features/student/queries/use-student-assigned-quizzes';
import { StudentPracticeQuizContent } from '@/components/student/StudentPracticeQuizContent';
import { ClipboardList, Sparkles } from 'lucide-react';

type QuizTab = 'assigned' | 'practice';

const PAGE_SIZE = 5;

export function QuizzesPage() {
  const searchParams = useSearchParams();
  const initialTab: QuizTab = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
  const [tab, setTab] = useState<QuizTab>(initialTab);
  const [pageIndex, setPageIndex] = useState(0);
  const assignedQuery = useStudentAssignedQuizzes();

  useEffect(() => {
    const t = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    setPageIndex(0);
  }, [assignedQuery.data]);

  const assignedQuizzes = assignedQuery.data ?? [];
  const totalItems = assignedQuizzes.length;
  const pageItems = assignedQuizzes.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  return (
    <ListPageLayout
      title="Quizzes"
      isLoading={tab === 'assigned' && assignedQuery.isPending}
      skeletonVariant="list"
      maxWidthClass="max-w-7xl"
      toolbar={
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
        />
      ) : (
        <StudentPracticeQuizContent embedded />
      )}
    </ListPageLayout>
  );
}
