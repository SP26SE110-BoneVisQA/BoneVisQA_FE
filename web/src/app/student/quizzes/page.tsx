import { Suspense } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { QuizzesPage } from '@/features/student/components/QuizzesPage';

export default function StudentQuizzesPage() {
  return (
    <Suspense fallback={<QueryPageSkeleton variant="list" minHeight="min-h-[320px]" />}>
      <QuizzesPage />
    </Suspense>
  );
}
