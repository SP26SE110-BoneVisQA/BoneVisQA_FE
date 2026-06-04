import { Suspense } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { LecturerQaTriagePage } from '@/features/lecturer/components/LecturerQaTriagePage';

export default function LecturerQaTriageRoute() {
  return (
    <Suspense fallback={<QueryPageSkeleton variant="list" minHeight="min-h-[400px]" />}>
      <LecturerQaTriagePage />
    </Suspense>
  );
}
