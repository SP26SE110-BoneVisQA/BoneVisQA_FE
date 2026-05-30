'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dashboardHrefForAppRole,
  readActiveAppRoleFromStorage,
  type AppRoleKey,
} from '@/lib/auth/rbac';

const ROLE_LABELS: Record<AppRoleKey, string> = {
  admin: 'Admin',
  lecturer: 'Lecturer',
  expert: 'Expert',
  student: 'Student',
};

export function UnauthorizedPageClient() {
  const searchParams = useSearchParams();
  const fromPortal = searchParams.get('from') as AppRoleKey | null;
  const activeRole = readActiveAppRoleFromStorage();
  const homeHref = activeRole ? dashboardHrefForAppRole(activeRole) : '/auth/sign-in';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access denied</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          You do not have permission to view this area
          {fromPortal && ROLE_LABELS[fromPortal] ? ` (${ROLE_LABELS[fromPortal]} portal)` : ''}.
          {activeRole ? (
            <>
              {' '}
              Your current role is <strong className="text-foreground">{ROLE_LABELS[activeRole]}</strong>.
            </>
          ) : null}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href={homeHref}>Go to my dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/auth/sign-in">Sign in with another account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
