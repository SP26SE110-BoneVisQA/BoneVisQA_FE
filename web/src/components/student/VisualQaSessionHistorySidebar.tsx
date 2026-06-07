'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import {
  fetchVisualQaPersonalHistory,
  resolveStudyImageSrc,
  type VisualQaSessionHistoryItem,
} from '@/lib/api/visual-qa';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

function SessionThumbnail({ imageUrl }: { imageUrl?: string | null }) {
  const src = resolveStudyImageSrc(imageUrl);
  if (!src) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ImageOff className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </span>
  );
}

export function VisualQaSessionHistorySidebar({
  selectedSessionId,
  onSelectSession,
  refreshNonce = 0,
  className,
}: Props) {
  const [items, setItems] = useState<VisualQaSessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVisualQaPersonalHistory({ limit: 20, offset: 0 });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load session history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadHistory();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHistory, refreshNonce]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? 0).getTime();
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
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-8 gap-1.5 text-xs"
              onClick={() => void loadHistory()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No sessions yet. Upload a DICOM study or open a case from the library.
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((row) => {
              const sid = row.sessionId.trim();
              const title = row.questionSnippet?.trim() || 'Study session';
              const rel = formatRelativeTime(row.updatedAt ?? null);
              const active = selectedSessionId?.trim() === sid;
              return (
                <li key={sid}>
                  <button
                    type="button"
                    onClick={() => {
                      stashSessionPrefillImage(sid, row.imageUrl);
                      onSelectSession(sid);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-all',
                      active
                        ? 'border-primary/20 bg-primary/10 text-slate-900 shadow-[0_8px_24px_rgba(37,99,235,0.08)]'
                        : 'border-transparent bg-white/75 text-slate-700 hover:border-slate-200/80 hover:bg-slate-50',
                    )}
                  >
                    <SessionThumbnail imageUrl={row.imageUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium leading-snug">{title}</span>
                      {rel ? (
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          {rel}
                        </span>
                      ) : null}
                    </span>
                    <MessageSquare className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
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
