import { Suspense } from 'react';
import { PageLoadingSkeleton } from '@/components/shared/DashboardSkeletons';
import { WorkspacePageClient } from '@/features/visual-qa/components/WorkspacePageClient';

export default function VisualQaCaseWorkspacePage() {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton className="min-h-full p-8">
          <p className="text-sm text-muted-foreground">Loading case workspace…</p>
        </PageLoadingSkeleton>
      }
    >
      <WorkspacePageClient variant="catalog" />
    </Suspense>
  );
}
