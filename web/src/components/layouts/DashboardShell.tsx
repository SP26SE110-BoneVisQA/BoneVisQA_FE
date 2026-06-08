'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { UnifiedDashboardHeader } from '@/components/layouts/UnifiedDashboardHeader';
import { DashboardHeaderProvider } from '@/components/layouts/dashboard-header-context';
import { SignalRProvider } from '@/hooks/useSignalR';
import { cn } from '@/lib/utils';
import { SessionGateSkeleton } from '@/components/shared/DashboardSkeletons';
import {
  canAccessRoute,
  readActiveAppRoleFromStorage,
  type AppRoleKey,
} from '@/lib/auth/rbac';

type AuthSnapshot = {
  token: string | null;
  isGuestOrUnassigned: boolean;
};

function readAuthSnapshot(): AuthSnapshot {
  if (typeof window === 'undefined') {
    return { token: null, isGuestOrUnassigned: false };
  }
  const nextToken = localStorage.getItem('token');
  const status = (localStorage.getItem('userStatus') || '').trim().toLowerCase();
  let roles: string[] = [];
  try {
    roles = JSON.parse(localStorage.getItem('roles') || '[]') as string[];
  } catch {
    roles = [];
  }
  const normalizedRoles = roles.map((r) => r.trim().toLowerCase()).filter(Boolean);
  const activeRole = (localStorage.getItem('activeRole') || '').trim().toLowerCase();
  const hasUsableRole = Boolean(activeRole) && activeRole !== 'none';
  const guestStatus = status === 'guest';
  const pendingStatus = status === 'pending';
  const unassignedRole =
    normalizedRoles.length === 0 ||
    normalizedRoles.includes('none') ||
    normalizedRoles.includes('unassigned') ||
    normalizedRoles.includes('guest') ||
    normalizedRoles.includes('pending') ||
    !hasUsableRole;
  return {
    token: nextToken,
    isGuestOrUnassigned: Boolean(nextToken) && (guestStatus || pendingStatus || unassignedRole),
  };
}

export type DashboardShellProps = {
  role: AppRoleKey;
  children: ReactNode;
};

export function DashboardShell({ role, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState<AuthSnapshot>({
    token: null,
    isGuestOrUnassigned: false,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setAuth(readAuthSnapshot());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const { token, isGuestOrUnassigned } = auth;

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/auth/sign-in${redirect}`);
      return;
    }
    if (isGuestOrUnassigned) {
      router.replace('/pending-approval');
      return;
    }
    const activeRole = readActiveAppRoleFromStorage();
    if (activeRole && pathname && !canAccessRoute(activeRole, pathname)) {
      router.replace(`/unauthorized?from=${encodeURIComponent(role)}&role=${encodeURIComponent(activeRole)}`);
    }
  }, [isGuestOrUnassigned, mounted, pathname, role, router, token]);

  if (!mounted) {
    return <SessionGateSkeleton />;
  }

  if (!token || isGuestOrUnassigned) {
    return <SessionGateSkeleton />;
  }

  const workbenchScrollLocked =
    pathname?.startsWith('/student/qa/image') ||
    pathname?.startsWith('/student/visual-qa/workspace') ||
    pathname?.startsWith('/student/visual-qa/case-workspace') ||
    false;

  return (
    <SignalRProvider>
      <DashboardHeaderProvider>
        <div className="grid h-screen min-h-0 w-full grid-cols-[auto_1fr] overflow-hidden bg-background text-text-main">
          <AppSidebar
            role={role}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          />
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <UnifiedDashboardHeader role={role} />
            <main
              className={cn(
                'min-h-0 min-w-0 flex-1',
                workbenchScrollLocked
                  ? 'overflow-hidden'
                  : 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/50',
              )}
            >
              {children}
            </main>
          </div>
        </div>
      </DashboardHeaderProvider>
    </SignalRProvider>
  );
}
