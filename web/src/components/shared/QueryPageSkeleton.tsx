'use client';

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type QueryPageSkeletonVariant = 'dashboard' | 'list' | 'detail' | 'card-grid';

type QueryPageSkeletonProps = {
  variant?: QueryPageSkeletonVariant;
  className?: string;
  /** Fixed min-height prevents CLS while queries resolve (Refinement 2). */
  minHeight?: string;
  children?: ReactNode;
};

/**
 * Stable skeleton layouts for TanStack Query `isPending` / `isLoading` states.
 * Prefer this over blank screens or spinners-only pages.
 */
export function QueryPageSkeleton({
  variant = 'list',
  className,
  minHeight = 'min-h-[320px]',
  children,
}: QueryPageSkeletonProps) {
  if (children) {
    return (
      <div className={cn('w-full', minHeight, className)} aria-busy="true" aria-live="polite">
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('w-full space-y-6 p-6', minHeight, className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {variant === 'dashboard' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {variant === 'card-grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : null}

      {variant === 'list' ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {variant === 'detail' ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : null}
    </div>
  );
}
