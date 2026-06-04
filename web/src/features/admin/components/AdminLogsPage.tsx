'use client';

import Link from 'next/link';
import { ListPageLayout } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export function AdminLogsPage() {
  return (
    <ListPageLayout
      title="System logs"
      maxWidthClass="max-w-3xl"
    >
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-sm text-muted-foreground">
          A dedicated system log API is not exposed in this release. Use the dashboard for recent
          activity and user audit trails.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </ListPageLayout>
  );
}
