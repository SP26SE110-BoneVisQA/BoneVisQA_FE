import { Suspense } from 'react';
import { PageLoadingSkeleton } from '@/components/shared/DashboardSkeletons';
import { WorkspacePageClient } from '@/features/visual-qa/components/WorkspacePageClient';

export default function VisualQaWorkspacePage() {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton className="min-h-full p-8">
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </PageLoadingSkeleton>
      }
    >
      <WorkspacePageClient />
    </Suspense>
  );
}
