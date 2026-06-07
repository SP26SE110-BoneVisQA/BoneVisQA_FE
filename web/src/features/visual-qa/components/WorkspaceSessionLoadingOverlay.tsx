'use client';

import { Loader2 } from 'lucide-react';

type Props = {
  visible: boolean;
};

/** Full-panel overlay over chat + DICOM viewer while a session thread loads. */
export function WorkspaceSessionLoadingOverlay({ visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/25 backdrop-blur-[2px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-6 py-5 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-slate-100">Loading session…</p>
      </div>
    </div>
  );
}
