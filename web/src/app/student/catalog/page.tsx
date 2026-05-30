import { Suspense } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { CatalogPage } from '@/features/student/components/CatalogPage';

export default function StudentCaseCatalogPage() {
  return (
    <Suspense fallback={<QueryPageSkeleton variant="card-grid" minHeight="min-h-[480px]" />}>
      <CatalogPage />
    </Suspense>
  );
}
