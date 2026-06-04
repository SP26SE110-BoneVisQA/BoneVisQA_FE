'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { notificationTargetToAppPath } from '@/lib/notification-app-path';
import type { AppNotificationItem } from '@/lib/api/types';

const MOCK_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: 'mock-expert-approved',
    type: 'expert_review',
    title: 'Expert approved your question',
    message: 'Your Visual QA answer on distal radius fracture was verified.',
    route: '/student/history',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isRead: false,
  },
  {
    id: 'mock-quiz-assigned',
    type: 'quiz_assigned',
    title: 'New quiz assigned',
    message: 'Musculoskeletal Radiology — due Friday.',
    route: '/student/quiz',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    isRead: false,
  },
  {
    id: 'mock-class-announcement',
    type: 'announcement',
    title: 'Class announcement',
    message: 'Lecturer posted a new case assignment for Week 8.',
    route: '/student/classes',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isRead: true,
  },
];

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

type NotificationCenterProps = {
  serverItems: AppNotificationItem[];
  connectionLive?: boolean;
  className?: string;
};

export function NotificationCenter({
  serverItems,
  connectionLive = false,
  className,
}: NotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unread' | 'all'>('unread');
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const merged = useMemo(() => {
    const map = new Map<string, AppNotificationItem>();
    for (const item of [...MOCK_NOTIFICATIONS, ...serverItems]) {
      map.set(item.id, { ...item });
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
  }, [serverItems]);

  const items = useMemo(
    () =>
      merged.map((item) => ({
        ...item,
        isRead: readIds.has(item.id) || Boolean(item.isRead),
      })),
    [merged, readIds],
  );

  const unread = items.filter((i) => !i.isRead);
  const unreadCount = unread.length;

  const markAllRead = () => {
    setReadIds(new Set(items.map((i) => i.id)));
  };

  const handleClick = (item: AppNotificationItem) => {
    setReadIds((prev) => new Set(prev).add(item.id));
    if (item.type === 'quiz_assigned') {
      router.push('/student/quiz');
      setOpen(false);
      return;
    }
    if (item.route) {
      router.push(notificationTargetToAppPath(item.route));
      setOpen(false);
    }
  };

  const list = tab === 'unread' ? unread : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className,
          )}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {connectionLive ? (
            <span
              className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card"
              aria-hidden
            />
          ) : null}
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v === 'all' ? 'all' : 'unread')}
          className="w-full"
        >
          <TabsList className="mx-4 mt-3 grid h-9 w-[calc(100%-2rem)] grid-cols-2">
            <TabsTrigger value="unread" className="text-xs">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All ({items.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="unread" className="mt-0 max-h-80 overflow-y-auto px-2 pb-3 pt-2">
            {unread.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              <NotificationList items={unread} onSelect={handleClick} />
            )}
          </TabsContent>
          <TabsContent value="all" className="mt-0 max-h-80 overflow-y-auto px-2 pb-3 pt-2">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <NotificationList items={items} onSelect={handleClick} />
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  items,
  onSelect,
}: {
  items: AppNotificationItem[];
  onSelect: (item: AppNotificationItem) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              'w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/70',
              !item.isRead && 'bg-primary/5',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {!item.isRead ? (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              ) : null}
            </div>
            {item.message ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
            ) : null}
            <p className="mt-1 text-[10px] text-muted-foreground">{formatWhen(item.createdAt)}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
