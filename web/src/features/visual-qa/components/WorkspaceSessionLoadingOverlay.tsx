'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  visible: boolean;
  message?: string;
  variant?: 'overlay' | 'fullscreen';
};

function WorkspaceLoadingCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-6 py-5 shadow-xl">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-slate-100">{message}</p>
    </div>
  );
}

/** Full-panel overlay over chat + DICOM viewer while a session thread loads. */
export function WorkspaceSessionLoadingOverlay({
  visible,
  message = 'Loading session…',
  variant = 'overlay',
}: Props) {
  if (!visible) return null;

  if (variant === 'fullscreen') {
    return (
      <div
        className="flex min-h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))]"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex min-h-[min(100dvh,720px)] w-full items-center justify-center bg-slate-950/25 backdrop-blur-[2px]">
          <WorkspaceLoadingCard message={message} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/25 backdrop-blur-[2px]',
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-auto">
        <WorkspaceLoadingCard message={message} />
      </div>
    </div>
  );
}
