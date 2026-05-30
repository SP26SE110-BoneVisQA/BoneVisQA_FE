'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/lib/useLogout';
import { useAuth, type BackendRole } from '@/lib/useAuth';
import { LogOut, ChevronLeft, ChevronRight, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navByRole, roleMeta, type AppRoleKey, type NavItem } from '@/config/navigation';

type RoleKey = AppRoleKey;

function mapBackendRoleToRoleKey(role: BackendRole | null | undefined): RoleKey | null {
  if (role === 'Student') return 'student';
  if (role === 'Lecturer') return 'lecturer';
  if (role === 'Expert') return 'expert';
  if (role === 'Admin') return 'admin';
  return null;
}

export function AppSidebar({
  role,
  collapsed,
  onToggleCollapsed,
}: {
  role?: RoleKey;
  collapsed?: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const logout = useLogout();
  const { user } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
  }, []);
  /** Until mount, ignore localStorage/API-backed `user` so SSR and first paint match. */
  const resolvedRole = hasMounted
    ? mapBackendRoleToRoleKey(user?.activeRole) ?? role ?? null
    : role ?? null;
  const { dashboardItem, otherItems } = useMemo(() => {
    if (!resolvedRole) return { dashboardItem: null, otherItems: [] as NavItem[] };
    const base = navByRole[resolvedRole] ?? [];
    const dashboard = base.find((item) => item.label.toLowerCase() === 'dashboard') ?? null;
    const rest = base
      .filter((item) => item.label.toLowerCase() !== 'dashboard')
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return { dashboardItem: dashboard, otherItems: rest };
  }, [resolvedRole]);
  const meta = resolvedRole ? roleMeta[resolvedRole] : null;

  const shellClass = `flex h-full shrink-0 flex-col border-r border-blue-100 bg-[#f0f7ff] text-[#1e293b] shadow-sm transition-[width] duration-200 ease-out ${
    collapsed ? 'w-[72px]' : 'w-[260px]'
  }`;

  if (!hasMounted) {
    return (
      <aside className={shellClass}>
        <div className="h-14 border-b border-blue-100 px-2" />
        <div className="flex-1 px-2 py-3">
          <div className="h-9 rounded-lg bg-blue-100/60" />
        </div>
      </aside>
    );
  }

  if (!resolvedRole || !meta) {
    return (
      <aside className={shellClass}>
        <div
          className={`flex shrink-0 items-center border-b border-blue-100 py-2 ${
            collapsed ? 'flex-col gap-2 px-1' : 'h-14 justify-between px-2'
          }`}
        >
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'min-w-0 flex-1'}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-white">
              <Stethoscope className="h-5 w-5 text-[#0055ff]" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-[#1e293b]">BoneVisQA</h1>
                <p className="truncate text-[11px] text-[#1e293b]/70">Radiology Education</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#1e293b]/70 hover:bg-blue-100 hover:text-[#1e293b]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex-1 px-2 py-4 text-center text-xs text-[#1e293b]/70">
          {!collapsed ? 'No role-based navigation available.' : '—'}
        </div>
        <div className="border-t border-blue-100 p-2">
          <Button
            onClick={logout}
            variant="outline"
            className="w-full justify-center border-blue-200 bg-white text-[#1e293b] hover:bg-blue-100"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed ? <span className="ml-2">Logout</span> : null}
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={shellClass}>
      <div
        className={`flex shrink-0 items-center border-b border-blue-100 py-2 ${
          collapsed ? 'flex-col gap-2 px-1' : 'h-[4.5rem] justify-between gap-1 px-2'
        }`}
      >
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'min-w-0 flex-1'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white">
            <Stethoscope className="h-5 w-5 text-[#0055ff]" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-wide text-[#1e293b]">BoneVisQA</h1>
              <p className="truncate text-[11px] text-[#1e293b]/70">{meta.label}</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#1e293b]/70 hover:bg-blue-100 hover:text-[#1e293b]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="app-scroll-y flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        <ul className="space-y-1">
          {dashboardItem ? (
            <li key={dashboardItem.href}>
              <Link
                href={dashboardItem.href}
                title={collapsed ? dashboardItem.label : undefined}
                className={`flex items-center rounded-lg text-sm font-semibold transition-colors duration-150 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  pathname === dashboardItem.href
                    ? 'bg-[#0055ff] text-white'
                    : 'text-[#1e293b] hover:bg-blue-100 hover:text-[#1e293b]'
                }`}
              >
                <dashboardItem.icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span className="truncate">{dashboardItem.label}</span> : null}
              </Link>
            </li>
          ) : null}
          {!collapsed ? (
            <li className="my-2 px-3" aria-hidden>
              <div className="border-t border-blue-100" />
            </li>
          ) : null}
          {otherItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${resolvedRole}/dashboard` && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#0055ff] text-white'
                      : 'text-[#1e293b] hover:bg-blue-100 hover:text-[#1e293b]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-blue-100 p-2">
        <Button
          onClick={logout}
          variant="outline"
          className="w-full justify-center border-blue-200 bg-white text-[#1e293b] hover:bg-blue-100"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? <span className="ml-2">Logout</span> : null}
        </Button>
      </div>
    </aside>
  );
}
