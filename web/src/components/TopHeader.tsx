'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth, type BackendRole } from '@/lib/useAuth';
import { useLogout } from '@/lib/useLogout';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { fetchNotifications } from '@/lib/api/notifications';
import { notificationTargetToAppPath } from '@/lib/notification-app-path';
import type { AppNotificationItem, NotificationDto } from '@/lib/api/types';
import { useSignalR } from '@/hooks/useSignalR';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type RoleKey = 'admin' | 'lecturer' | 'expert' | 'student';

function notificationDtoToAppItem(d: NotificationDto): AppNotificationItem {
  const route =
    d.route?.trim() ||
    (d.targetUrl?.trim() ? notificationTargetToAppPath(d.targetUrl) : undefined);
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    message: d.message,
    ...(route ? { route } : {}),
    createdAt: d.createdAt,
    isRead: d.isRead,
  };
}

function mapBackendRoleToRoleKey(role: BackendRole | null | undefined): RoleKey | null {
  if (role === 'Student') return 'student';
  if (role === 'Lecturer') return 'lecturer';
  if (role === 'Expert') return 'expert';
  if (role === 'Admin') return 'admin';
  return null;
}

function dashboardHrefForRole(role: RoleKey): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'lecturer':
      return '/lecturer/dashboard';
    case 'expert':
      return '/expert/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/dashboard';
  }
}

export interface TopHeaderProps {
  title: string;
  subtitle?: string;
}

export default function TopHeader({ title, subtitle }: TopHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const { user } = useAuth();
  const notifRef = useRef<HTMLDivElement | null>(null);
  const [serverNotifications, setServerNotifications] = useState<AppNotificationItem[]>([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const { connectionStatus, notifications: realtimeNotifications } = useSignalR();

  const fullName = user?.fullName?.trim() || user?.email?.trim() || 'Authenticated User';
  const emailDisplay = user?.email?.trim() || '';
  const roleLabel = user?.activeRole?.trim() || '—';
  const resolvedRole = mapBackendRoleToRoleKey(user?.activeRole) ?? 'student';

  const initials = useMemo(() => {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [fullName]);

  const avatarSrc = useMemo(() => {
    const raw = user?.avatarUrl?.trim();
    if (!raw) return '';
    return resolveApiAssetUrl(raw);
  }, [user?.avatarUrl]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarSrc]);

  useEffect(() => {
    let cancelled = false;
    void fetchNotifications()
      .then((data) => {
        if (!cancelled) setServerNotifications(data);
      })
      .catch(() => {
        if (!cancelled) setServerNotifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!notifRef.current?.contains(t)) setOpenNotifications(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const mergedNotifications = useMemo(() => {
    const map = new Map<string, AppNotificationItem>();
    for (const n of serverNotifications) {
      map.set(n.id, { ...n });
    }
    for (const d of realtimeNotifications) {
      const prev = map.get(d.id);
      const next = notificationDtoToAppItem(d);
      map.set(d.id, {
        ...prev,
        ...next,
        isRead: next.isRead ?? prev?.isRead ?? false,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
  }, [serverNotifications, realtimeNotifications]);

  const unreadCount = mergedNotifications.filter((item) => !item.isRead).length;

  const handleNotificationClick = (item: AppNotificationItem) => {
    if (item.type === 'quiz_assigned') {
      router.push('/student/quiz');
      setOpenNotifications(false);
      return;
    }
    if (item.route) {
      router.push(notificationTargetToAppPath(item.route));
      setOpenNotifications(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    if (resolvedRole) {
      router.push(dashboardHrefForRole(resolvedRole));
      return;
    }
    router.push('/dashboard');
  };

  const showBackButton = useMemo(() => {
    if (!pathname) return true;
    return !/\/dashboard\/?$/.test(pathname);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          {showBackButton ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 py-0.5">
            <h1 className="truncate font-headline text-base font-semibold tracking-tight text-[var(--text-main)] sm:text-lg md:text-xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)] sm:line-clamp-1 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-2 md:gap-3">
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenNotifications((prev) => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {connectionStatus === 'connected' ? (
                <span
                  className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[var(--background)]"
                  title="Live notifications connected"
                  aria-hidden
                />
              ) : null}
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
            {openNotifications ? (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-2 shadow-xl">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Notifications
                </div>
                {mergedNotifications.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-[var(--text-muted)]">No notifications.</div>
                ) : (
                  <ul className="scrollbar-hide max-h-72 overflow-y-auto">
                    {mergedNotifications.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(item)}
                          className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--muted)]"
                        >
                          <p className="text-sm font-medium text-[var(--text-main)]">{item.title}</p>
                          {item.message ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">{item.message}</p>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex max-w-[220px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] px-2 py-1.5 outline-none hover:bg-[var(--sidebar-hover)] focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none sm:gap-3 sm:px-3 sm:py-2"
                aria-label="Open account menu"
              >
                {avatarSrc && !avatarLoadFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border border-[var(--border-color)] object-cover sm:h-10 sm:w-10"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white sm:h-10 sm:w-10 sm:text-sm">
                    {initials || 'BV'}
                  </div>
                )}
                <div className="hidden min-w-0 text-left sm:block">
                  <p className="truncate text-sm font-semibold text-[var(--text-main)]">{fullName}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{roleLabel}</p>
                </div>
                <ChevronDown className="hidden h-4 w-4 shrink-0 text-[var(--text-muted)] sm:block" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="cursor-default select-none font-normal">
                <p className="truncate text-sm font-semibold text-[var(--text-main)]">{fullName}</p>
                {emailDisplay ? (
                  <p className="truncate text-xs font-normal text-[var(--text-muted)]">{emailDisplay}</p>
                ) : null}
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  {roleLabel}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--text-muted)]" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
