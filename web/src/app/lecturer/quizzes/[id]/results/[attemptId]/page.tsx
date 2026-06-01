import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LecturerQuizAttemptDetailPage } from '@/features/lecturer/components/LecturerQuizAttemptDetailPage';

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; attemptId: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LecturerQuizAttemptDetailPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}
