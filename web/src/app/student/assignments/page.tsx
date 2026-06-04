'use client';

import Link from 'next/link';
import { ListPageLayout } from '@/components/layouts';
import { EmptyState } from '@/components/shared/EmptyState';
import { ClipboardList } from 'lucide-react';

export default function StudentAssignmentsPlaceholderPage() {
  return (
    <ListPageLayout
      title="Assignments"
      maxWidthClass="max-w-xl"
    >
      <EmptyState
        icon={<ClipboardList className="h-6 w-6 text-primary" />}
        title="Coming soon"
      />
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/student/classes"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
        >
          My classes
        </Link>
        <Link
          href="/student/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
        >
          Dashboard
        </Link>
      </div>
    </ListPageLayout>
  );
}
