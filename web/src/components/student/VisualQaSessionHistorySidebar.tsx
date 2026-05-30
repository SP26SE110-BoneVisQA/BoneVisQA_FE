'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { fetchStudentPersonalStudiesHistory } from '@/lib/api/student';
import type { StudentCaseHistoryItem } from '@/lib/api/types';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';

const STORAGE_KEY_PREFIX = 'bonevisqa:vqa-prefill-image:';

export function stashSessionPrefillImage(sessionId: string, imageUrl: string | null | undefined) {
  const sid = sessionId?.trim();
  const url = imageUrl?.trim();
  if (!sid || !url || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + sid, url);
  } catch {
    /* quota / private mode */
  }
}

export function readAndClearSessionPrefillImage(sessionId: string): string | null {
  const sid = sessionId?.trim();
  if (!sid || typeof sessionStorage === 'undefined') return null;
  try {
    const k = STORAGE_KEY_PREFIX + sid;
    const v = sessionStorage.getItem(k);
    if (v) sessionStorage.removeItem(k);
    return v;
  } catch {
    return null;
  }
}

export function clearSessionPrefillImages() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore storage access issues */
  }
}

type Props = {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  /** Bump sau khi tạo phiên chat mới để refetch danh sách không cần reload trang. */
  refreshNonce?: number;
  className?: string;
};

export function VisualQaSessionHistorySidebar({
  selectedSessionId,
  onSelectSession,
  refreshNonce = 0,
  className,
}: Props) {
  const [items, setItems] = useState<StudentCaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchStudentPersonalStudiesHistory();
        if (!cancelled) setItems(res.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.askedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.askedAt ?? 0).getTime();
      return tb - ta;
    });
  }, [items]);

  return (
    <aside
      className={cn(
        'medical-glass-panel m-3 mr-0 flex min-h-0 w-full flex-col overflow-hidden border-slate-200/70 bg-white/75 lg:w-[280px] lg:shrink-0',
        className,
      )}
    >
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4">
        <Link
          href="/student/visual-qa/workspace"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to upload
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Study history</p>
        <p className="mt-1 text-xs text-slate-500">Personal Visual QA sessions</p>
      </div>
      <div className="app-scroll-y min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-xs text-destructive">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No sessions yet. Upload an image below or open a catalog case from Case Library.
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((row) => {
              const sid = row.sessionId?.trim() ?? row.id;
              const title =
                row.lastQuestionAsked?.trim() || row.questionSnippet?.trim() || row.title || 'Session';
              const rel = formatRelativeTime(row.updatedAt ?? row.askedAt ?? null);
              const active = selectedSessionId?.trim() === sid;
              return (
                <li key={sid}>
                  <button
                    type="button"
                    onClick={() => {
                      stashSessionPrefillImage(sid, row.thumbnailUrl);
                      onSelectSession(sid);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-all',
                      active
                        ? 'border-primary/20 bg-primary/10 text-slate-900 shadow-[0_8px_24px_rgba(37,99,235,0.08)]'
                        : 'border-transparent bg-white/75 text-slate-700 hover:border-slate-200/80 hover:bg-slate-50',
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-primary">
                      <MessageSquare className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium leading-snug">{title}</span>
                      {rel ? <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{rel}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
