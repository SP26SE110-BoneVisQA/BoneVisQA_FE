import { Suspense, type ReactNode } from 'react';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';

function HistoryFallback() {
  return <QueryPageSkeleton variant="card-grid" minHeight="min-h-[480px]" />;
}

export default function StudentHistoryLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<HistoryFallback />}>{children}</Suspense>;
}
