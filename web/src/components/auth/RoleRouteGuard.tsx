'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  canAccessRoute,
  dashboardHrefForAppRole,
  isPublicAppRoute,
  pathnameRequiresRole,
  readActiveAppRoleFromStorage,
  type AppRoleKey,
} from '@/lib/auth/rbac';
import { showRoleAccessDeniedToast } from '@/lib/api/errors/show-api-error-toast';

/**
 * Client-side RBAC: blocks cross-portal navigation when `activeRole` does not match the URL prefix.
 * Fires an English 403 toast and redirects to the user's dashboard or `/unauthorized`.
 */
export function RoleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const lastBlockedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) return;

    if (isPublicAppRoute(pathname)) return;

    const requiredRole = pathnameRequiresRole(pathname);
    if (!requiredRole) return;

    const activeRole = readActiveAppRoleFromStorage();
    if (!activeRole) return;

    if (canAccessRoute(activeRole, pathname)) return;

    if (lastBlockedPath.current !== pathname) {
      lastBlockedPath.current = pathname;
      showRoleAccessDeniedToast();
    }

    const destination = resolveRedirectDestination(activeRole, requiredRole);
    router.replace(destination);
  }, [pathname, router]);

  return null;
}

function resolveRedirectDestination(
  activeRole: AppRoleKey,
  requiredRole: AppRoleKey,
): string {
  if (activeRole === requiredRole) {
    return dashboardHrefForAppRole(activeRole);
  }
  return `/unauthorized?from=${encodeURIComponent(requiredRole)}&role=${encodeURIComponent(activeRole)}`;
}
