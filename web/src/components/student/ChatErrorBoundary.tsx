'use client';

import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
  onReset: () => void;
};

function ChatFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="medical-bento-card flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">Medical module temporarily unavailable</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        A rendering error occurred in this workspace panel. Reset the chat view to recover without reloading the entire app.
      </p>
      <p className="mt-2 max-w-md rounded-2xl bg-slate-50 px-3 py-2 text-xs text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" className="mt-5 rounded-2xl" onClick={resetErrorBoundary}>
        <RefreshCcw className="h-4 w-4" aria-hidden />
        Reset Chat
      </Button>
    </div>
  );
}

export function ChatErrorBoundary({ children, onReset }: Props) {
  return (
    <ErrorBoundary FallbackComponent={ChatFallback} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}
