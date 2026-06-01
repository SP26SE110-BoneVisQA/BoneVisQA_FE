'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPageLayout } from '@/components/layouts';
import { AssignedQuizzesList } from '@/features/student/components/AssignedQuizzesList';
import { useStudentAssignedQuizzes } from '@/features/student/queries/use-student-assigned-quizzes';
import { StudentPracticeQuizContent } from '@/components/student/StudentPracticeQuizContent';
import { ClipboardList, Sparkles } from 'lucide-react';

type QuizTab = 'assigned' | 'practice';

const DEFAULT_PAGE_SIZE = 5;

export function QuizzesPage() {
  const searchParams = useSearchParams();
  const initialTab: QuizTab = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
  const [tab, setTab] = useState<QuizTab>(initialTab);
  const [pageIndex, setPageIndex] = useState(0);

  const assignedQuery = useStudentAssignedQuizzes({
    pageIndex,
    pageSize: DEFAULT_PAGE_SIZE,
    enabled: tab === 'assigned',
  });

  useEffect(() => {
    const t = searchParams.get('tab') === 'practice' ? 'practice' : 'assigned';
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (tab === 'assigned') {
      setPageIndex(0);
    }
  }, [tab]);

  const totalPages = assignedQuery.data?.totalPages ?? 1;

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
          items={assignedQuery.data?.items ?? []}
          isPending={assignedQuery.isPending}
          error={assignedQuery.error}
          pageIndex={pageIndex}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={assignedQuery.data?.totalCount}
          totalPages={totalPages}
          onPageChange={setPageIndex}
        />
      ) : (
        <StudentPracticeQuizContent embedded />
      )}
    </ListPageLayout>
  );
}
