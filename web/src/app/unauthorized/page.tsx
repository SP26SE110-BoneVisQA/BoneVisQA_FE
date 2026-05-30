import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { UnauthorizedPageClient } from '@/app/unauthorized/UnauthorizedPageClient';

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <Skeleton className="h-40 w-full max-w-md rounded-xl" />
        </div>
      }
    >
      <UnauthorizedPageClient />
    </Suspense>
  );
}
