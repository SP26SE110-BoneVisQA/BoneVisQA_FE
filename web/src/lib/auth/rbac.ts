import type { BackendRole } from '@/lib/useAuth';

export type AppRoleKey = 'admin' | 'lecturer' | 'expert' | 'student';

const ROLE_ROUTE_PREFIX: Record<AppRoleKey, string> = {
  admin: '/admin',
  lecturer: '/lecturer',
  expert: '/expert',
  student: '/student',
};

const BACKEND_ROLE_TO_APP: Record<BackendRole, AppRoleKey | null> = {
  Admin: 'admin',
  Lecturer: 'lecturer',
  Expert: 'expert',
  Student: 'student',
  Guest: null,
};

/** Path prefixes that do not require a portal role (auth, marketing, shared). */
const PUBLIC_ROUTE_PREFIXES = [
  '/auth',
  '/pending-approval',
  '/unauthorized',
  '/',
] as const;

export function pathnameRequiresRole(pathname: string): AppRoleKey | null {
  for (const role of Object.keys(ROLE_ROUTE_PREFIX) as AppRoleKey[]) {
    const prefix = ROLE_ROUTE_PREFIX[role];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return role;
    }
  }
  return null;
}

export function isPublicAppRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

export function appRoleKeyFromBackendRole(role: BackendRole | null | undefined): AppRoleKey | null {
  if (!role) return null;
  return BACKEND_ROLE_TO_APP[role] ?? null;
}

export function readActiveAppRoleFromStorage(): AppRoleKey | null {
  if (typeof window === 'undefined') return null;
  const raw = (localStorage.getItem('activeRole') || '').trim().toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'lecturer') return 'lecturer';
  if (raw === 'expert') return 'expert';
  if (raw === 'student') return 'student';
  return null;
}

export function dashboardHrefForAppRole(role: AppRoleKey): string {
  return `${ROLE_ROUTE_PREFIX[role]}/dashboard`;
}

export function canAccessRoute(activeRole: AppRoleKey, pathname: string): boolean {
  const required = pathnameRequiresRole(pathname);
  if (!required) return true;
  return required === activeRole;
}
