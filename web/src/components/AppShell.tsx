'use client';

import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layouts/DashboardShell';
import type { AppRoleKey } from '@/lib/auth/rbac';

/** @deprecated Use `DashboardShell` directly — kept for role layouts. */
export function AppShell({
  role,
  children,
}: {
  role: AppRoleKey;
  children: ReactNode;
}) {
  return <DashboardShell role={role}>{children}</DashboardShell>;
}
