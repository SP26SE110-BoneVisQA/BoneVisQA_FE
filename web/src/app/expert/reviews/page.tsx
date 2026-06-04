import { Suspense } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { ExpertReviewsPage } from '@/features/expert/components/ExpertReviewsPage';

export default function ExpertReviewsRoute() {
  return (
    <Suspense fallback={<QueryPageSkeleton variant="list" minHeight="min-h-[400px]" />}>
      <ExpertReviewsPage />
    </Suspense>
  );
}
