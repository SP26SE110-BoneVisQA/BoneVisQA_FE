'use client';

import { AuthRedirector } from '@/components/AuthRedirector';
import { RoleRouteGuard } from '@/components/auth/RoleRouteGuard';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { createQueryClient } from '@/lib/queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'border border-border bg-card text-card-foreground shadow-lg backdrop-blur-sm',
            title: 'text-card-foreground font-semibold',
            description: 'text-muted-foreground text-sm',
            success: 'border-success/40',
            error: 'border-destructive/40',
          },
        }}
      />
      <AuthRedirector />
      <RoleRouteGuard />
      {children}
    </QueryClientProvider>
  );
}
