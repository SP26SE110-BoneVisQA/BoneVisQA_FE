'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))] font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="medical-bento-card w-full max-w-xl p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
              Medical module temporarily unavailable
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The application hit a global rendering failure. Return to the previous route or restart the demo from a clean state.
            </p>
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs text-slate-500">
              {error?.message?.trim() || 'Unexpected application error.'}
            </p>
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={reset}>
                Try recovery
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
