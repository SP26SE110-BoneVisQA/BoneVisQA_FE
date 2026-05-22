'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/lib/useLogout';
import { useAuth, type BackendRole } from '@/lib/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  BookOpen,
  CheckSquare,
  Flag,
  Database,
  LayoutDashboard,
  HelpCircle,
  LogOut,
  Plus,
  ScanSearch,
  Stethoscope,
  ClipboardList,
  BadgeCheck,
  Users,
  FileQuestion,
  BarChart3,
  Megaphone,
  Award,

  Sparkles,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Settings,
  Settings2,
  FileText,
  Server,
  HardDrive,
  FileBarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

type RoleKey = 'admin' | 'lecturer' | 'expert' | 'student';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navByRole: Record<RoleKey, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Class Management', href: '/admin/classes', icon: GraduationCap },
    { label: 'Medical Student Verification', href: '/admin/verifications', icon: BadgeCheck },
    { label: 'Knowledge Base', href: '/admin/documents', icon: Database },
    { label: 'Flagged chunks', href: '/admin/flagged-chunks', icon: Flag },
    { label: 'Medical Cases', href: '/admin/cases', icon: BookOpen },
    { label: 'System Logs', href: '/admin/logs', icon: FileText },
    { label: 'System Configuration', href: '/admin/system-config', icon: Server },
    { label: 'Classifications', href: '/admin/classifications', icon: Stethoscope },
    { label: 'Backup & Export', href: '/admin/backup', icon: HardDrive },
    { label: 'Reports', href: '/admin/reports', icon: FileBarChart },
  ],
  lecturer: [
    { label: 'Dashboard', href: '/lecturer/dashboard', icon: LayoutDashboard },
    { label: 'Triage Workbench', href: '/lecturer/qa-triage', icon: Stethoscope },
    { label: 'Classes', href: '/lecturer/classes', icon: Users },
    { label: 'Quiz Library', href: '/lecturer/quizzes', icon: FileQuestion },
    { label: 'Assignments', href: '/lecturer/assignments', icon: ClipboardList },
    { label: 'Cases', href: '/lecturer/cases', icon: BookOpen },
    { label: 'Analytics', href: '/lecturer/analytics', icon: BarChart3 },
    { label: 'Announcements', href: '/lecturer/announcements', icon: Megaphone },
  ],
  expert: [
    { label: 'Dashboard', href: '/expert/dashboard', icon: LayoutDashboard },
    { label: 'Expert review', href: '/expert/reviews', icon: CheckSquare },
    { label: 'Case Library', href: '/expert/cases', icon: BookOpen },
    { label: 'Quiz Library', href: '/expert/quizzes', icon: FileQuestion },
    { label: 'Settings', href: '/expert/settings', icon: Settings },
  ],
  student: [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Case Library', href: '/student/catalog', icon: BookOpen },
    { label: 'AI Q&A', href: '/student/qa', icon: ScanSearch },
    { label: 'Spaced Review', href: '/student/review', icon: BarChart3 },
    { label: 'My Flashcards', href: '/student/flashcards', icon: HelpCircle },
    { label: 'Quizzes', href: '/student/quizzes', icon: FileQuestion },
    { label: 'Analytics', href: '/student/analytics', icon: BarChart3 },
    { label: 'History', href: '/student/history', icon: ClipboardList },
  ],
};

const roleMeta: Record<RoleKey, { label: string; actionHref: string; actionLabel: string }> = {
  admin: { label: 'Radiology Education', actionHref: '/admin/documents', actionLabel: 'Upload Document' },
  lecturer: { label: 'Radiology Education', actionHref: '/lecturer/qa-triage', actionLabel: 'Open Triage' },
  expert: { label: 'Radiology Education', actionHref: '/expert/reviews', actionLabel: 'Open reviews' },
  student: { label: 'Radiology Education', actionHref: '/student/qa/image', actionLabel: 'New Analysis' },
};

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
    const rest = base.filter((item) => item.label.toLowerCase() !== 'dashboard');
    return { dashboardItem: dashboard, otherItems: rest };
  }, [resolvedRole]);
  const meta = resolvedRole ? roleMeta[resolvedRole] : null;

  const shellClass = `fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--border-color)] bg-[var(--sidebar)] text-[var(--sidebar-text)] shadow-sm transition-[width] duration-200 ease-out ${
    collapsed ? 'w-[72px]' : 'w-[260px]'
  }`;

  if (!hasMounted) {
    return (
      <aside className={shellClass}>
        <div className="h-14 border-b border-[var(--border-color)] px-2" />
        <div className="flex-1 px-2 py-3">
          <div className="h-9 rounded-lg bg-[var(--muted)]" />
        </div>
      </aside>
    );
  }

  if (!resolvedRole || !meta) {
    return (
      <aside className={shellClass}>
        <div
          className={`flex shrink-0 items-center border-b border-[var(--border-color)] py-2 ${
            collapsed ? 'flex-col gap-2 px-1' : 'h-14 justify-between px-2'
          }`}
        >
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'min-w-0 flex-1'}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--surface)]">
              <Stethoscope className="h-5 w-5 text-[var(--primary)]" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-[var(--sidebar-text)]">BoneVisQA</h1>
                <p className="truncate text-[11px] text-[var(--sidebar-text-muted)]">Radiology Education</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <ThemeToggle />
        </div>
        <div className="flex-1 px-2 py-4 text-center text-xs text-[var(--sidebar-text-muted)]">
          {!collapsed ? 'No role-based navigation available.' : '—'}
        </div>
        <div className="border-t border-[var(--border-color)] p-2">
          <Button
            onClick={logout}
            variant="outline"
            className="w-full justify-center border-[var(--border-color)] bg-[var(--surface)] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
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
        className={`flex shrink-0 items-center border-b border-[var(--border-color)] py-2 ${
          collapsed ? 'flex-col gap-2 px-1' : 'h-[4.5rem] justify-between gap-1 px-2'
        }`}
      >
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'min-w-0 flex-1'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--surface)]">
            <Stethoscope className="h-5 w-5 text-[var(--primary)]" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-wide text-[var(--sidebar-text)]">BoneVisQA</h1>
              <p className="truncate text-[11px] text-[var(--sidebar-text-muted)]">{meta.label}</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <ThemeToggle />
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
                    ? 'bg-[var(--sidebar-active)] text-white'
                    : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]'
                }`}
              >
                <dashboardItem.icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span className="truncate">{dashboardItem.label}</span> : null}
              </Link>
            </li>
          ) : null}
          {!collapsed ? (
            <li className="my-2 px-3" aria-hidden>
              <div className="border-t border-[var(--border-color)]" />
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
                      ? 'bg-[var(--sidebar-active)] text-white'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]'
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

      <div className="border-t border-[var(--border-color)] p-2">
        <Link href={meta.actionHref} className="block" title={collapsed ? meta.actionLabel : undefined}>
          <Button className={`w-full justify-center ${collapsed ? 'px-2' : ''}`}>
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="ml-2">{meta.actionLabel}</span> : null}
          </Button>
        </Link>
      </div>
    </aside>
  );
}
