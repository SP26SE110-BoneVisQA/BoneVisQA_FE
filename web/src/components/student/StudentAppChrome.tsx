'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { fetchStudentProfile, fetchStudentAnnouncements } from '@/lib/api/student';
import type { StudentAnnouncement } from '@/lib/api/types';

export function StudentAppChrome({
  breadcrumb = 'Student Dashboard',
  title,
  subtitle,
  children,
}: {
  /** Shown after "BoneVisQA •" in the top bar */
  breadcrumb?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const displayName = user?.fullName?.trim() || 'Student';
  const roleLabel = user?.activeRole === 'Student' ? 'Radiology Student' : user?.activeRole || 'Student';
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchStudentProfile();
        if (!cancelled && p.avatarUrl?.trim()) setAvatarUrl(p.avatarUrl.trim());
      } catch {
        if (!cancelled) setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAnnouncementsLoading(true);
      try {
        const list = await fetchStudentAnnouncements();
        if (!cancelled) setAnnouncements(list);
      } catch {
        if (!cancelled) setAnnouncements([]);
      } finally {
        if (!cancelled) setAnnouncementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!announcementsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAnnouncementsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [announcementsOpen]);

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'BV';

  return (
    <>
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-md md:px-10 md:py-5">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-['Manrope',sans-serif] text-lg font-extrabold tracking-tight text-primary md:text-xl">
            BoneVisQA
          </h1>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
          <span className="truncate text-sm font-medium text-muted-foreground">{breadcrumb}</span>
          <Link
            href="/student/ai-assistant"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00478d] to-[#005eb8] px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-4 md:gap-6">
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setAnnouncementsOpen((o) => !o)}
              className="relative rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
              aria-expanded={announcementsOpen}
              aria-label="Notifications and class announcements"
            >
              <Bell className="h-5 w-5" />
              {announcements.length > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
              ) : null}
            </button>
            {announcementsOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-card p-3 shadow-xl">
                <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Class announcements
                </p>
                {announcementsLoading ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
                ) : announcements.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">No announcements yet.</p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {announcements.slice(0, 8).map((a) => (
                      <li
                        key={a.id}
                        className="rounded-xl border border-border bg-muted/30 px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        {a.className ? (
                          <p className="text-xs text-primary">{a.className}</p>
                        ) : null}
                        {a.relatedAssignment?.assignmentTitle ? (
                          <p className="mt-1 text-xs font-medium text-primary">
                            [{a.relatedAssignment.assignmentType?.toUpperCase()}] {a.relatedAssignment.assignmentTitle}
                          </p>
                        ) : null}
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3 border-l border-border pl-4 md:pl-6">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveApiAssetUrl(avatarUrl)}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </div>
            )}
          </div>
        </div>
      </header>
      {(title || subtitle || children) && (
        <div className="border-b border-border px-6 py-5 md:px-10">
          {title ? (
            <h2 className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {children}
        </div>
      )}
    </>
  );
}

/** Floating shortcut to the visual QA workflow. */
export function StudentDashboardFab() {
  return (
    <Link
      href="/student/qa/image"
      className="fixed bottom-10 right-10 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl transition-transform hover:scale-110 active:scale-90"
      aria-label="Open Visual QA"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </Link>
  );
}
