'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, LogOut, Moon, RotateCcw, Settings, Sun, User } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useLogout } from '@/lib/useLogout';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { fetchNotifications } from '@/lib/api/notifications';
import { notificationTargetToAppPath } from '@/lib/notification-app-path';
import type { AppNotificationItem, NotificationDto } from '@/lib/api/types';
import { useSignalR } from '@/hooks/useSignalR';
import { useTheme } from '@/components/providers/ThemeProvider';
import { NotificationCenter } from '@/components/shared/NotificationCenter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { dashboardHrefForAppRole, readActiveAppRoleFromStorage } from '@/lib/auth/rbac';
import { useDashboardHeaderReader } from '@/components/layouts/dashboard-header-context';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';
import { clearSessionPrefillImages } from '@/components/student/VisualQaSessionHistorySidebar';
import { appToast } from '@/lib/api/errors';

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

export function UnifiedDashboardHeader({
  role,
  className,
}: {
  role?: 'admin' | 'lecturer' | 'expert' | 'student';
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const header = useDashboardHeaderReader();
  const logout = useLogout();
  const { user } = useAuth();
  const [serverNotifications, setServerNotifications] = useState<AppNotificationItem[]>([]);
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const { connectionStatus, notifications: realtimeNotifications } = useSignalR();
  const { theme, toggleTheme } = useTheme();

  const fullName = user?.fullName?.trim() || user?.email?.trim() || 'Authenticated User';
  const emailDisplay = user?.email?.trim() || '';
  const title = header?.title?.trim() || 'Dashboard';

  const shouldShowBack = useMemo(() => {
    if (header?.showBack !== undefined) return header.showBack;
    if (!pathname) return false;
    return !/\/dashboard\/?$/.test(pathname);
  }, [header?.showBack, pathname]);

  const initials = useMemo(
    () =>
      fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    [fullName],
  );

  const avatarSrc = useMemo(() => {
    const raw = user?.avatarUrl?.trim();
    if (!raw) return '';
    return resolveApiAssetUrl(raw);
  }, [user?.avatarUrl]);

  const avatarLoadFailed = Boolean(avatarSrc) && failedAvatarSrc === avatarSrc;

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
    return Array.from(map.values());
  }, [serverNotifications, realtimeNotifications]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    const role = readActiveAppRoleFromStorage();
    if (role) {
      router.push(dashboardHrefForAppRole(role));
    }
  };

  const handleResetVisualQaState = () => {
    clearSessionPrefillImages();
    useVisualQaStore.getState().resetSession();
    useVisualQaStore.persist.clearStorage();
    appToast.success('Visual QA session state cleared.');
    if (pathname?.startsWith('/student/visual-qa/workspace')) {
      router.replace('/student/visual-qa/workspace');
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 shadow-sm backdrop-blur-md',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-4 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {shouldShowBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <h1 className="truncate font-headline text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {header?.actions ?? null}

          <NotificationCenter
            serverItems={mergedNotifications}
            connectionLive={connectionStatus === 'connected'}
            role={role}
          />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex max-w-[200px] items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none sm:px-2.5"
                aria-label="Open account menu"
              >
                {avatarSrc && !avatarLoadFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                    onError={() => setFailedAvatarSrc(avatarSrc)}
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials || 'BV'}
                  </div>
                )}
                <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="cursor-default select-none font-normal">
                <p className="truncate text-sm font-semibold">{fullName}</p>
                {emailDisplay ? (
                  <p className="truncate text-xs font-normal text-muted-foreground">{emailDisplay}</p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                destructive
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  handleResetVisualQaState();
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset Session Context
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
