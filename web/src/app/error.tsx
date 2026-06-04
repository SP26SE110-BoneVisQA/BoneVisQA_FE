'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))] px-6">
      <div className="medical-bento-card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <p className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
          Medical module temporarily unavailable
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A workspace component crashed unexpectedly. Use the recovery action below instead of refreshing the entire demo flow.
        </p>
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs text-slate-500">
          {error?.message?.trim() || 'Unexpected application error.'}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={reset}>
            <RefreshCcw className="h-4 w-4" />
            Recover module
          </Button>
        </div>
      </div>
    </div>
  );
}
