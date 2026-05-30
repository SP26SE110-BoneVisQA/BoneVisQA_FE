'use client';

import type { ReactNode } from 'react';
import { useDashboardHeader, type DashboardHeaderConfig } from '@/components/layouts/dashboard-header-context';
import { QueryPageSkeleton } from '@/components/shared/QueryPageSkeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type ListSkeletonVariant = 'list' | 'card-grid';

type ListPageLayoutProps = DashboardHeaderConfig & {
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  skeletonVariant?: ListSkeletonVariant;
  toolbar?: ReactNode;
  maxWidthClass?: string;
  className?: string;
};

export function ListPageLayout({
  children,
  isLoading = false,
  error = null,
  skeletonVariant = 'list',
  toolbar,
  maxWidthClass = 'max-w-[1600px]',
  className,
  title,
  actions,
  showBack,
}: ListPageLayoutProps) {
  useDashboardHeader({ title, actions, showBack });

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className={cn('mx-auto w-full flex-1 space-y-8 p-8', maxWidthClass)}>
        {toolbar}
        {isLoading ? (
          <QueryPageSkeleton variant={skeletonVariant} minHeight="min-h-[400px]" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load list</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
