'use client';

import type { ReactNode } from 'react';
import { useDashboardHeader, type DashboardHeaderConfig } from '@/components/layouts/dashboard-header-context';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type DashboardOverviewLayoutProps = DashboardHeaderConfig & {
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  maxWidthClass?: string;
  className?: string;
};

export function DashboardOverviewLayout({
  children,
  isLoading = false,
  error = null,
  maxWidthClass = 'max-w-[1600px]',
  className,
  title,
  actions,
  showBack,
}: DashboardOverviewLayoutProps) {
  useDashboardHeader({ title, actions, showBack });

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className={cn('mx-auto w-full flex-1 space-y-8 p-8', maxWidthClass)}>
        {isLoading ? (
          <QueryPageSkeleton variant="dashboard" minHeight="min-h-[480px]" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
