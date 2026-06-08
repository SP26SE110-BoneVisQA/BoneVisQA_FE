'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import {
  fetchVisualQaCaseHistoryNormalized,
  fetchVisualQaPersonalHistory,
  resolveStudyImageSrc,
  type VisualQaSessionHistoryItem,
  type VisualQaStudyMode,
} from '@/lib/api/visual-qa';
import {
  inferStudyModeFromHistoryItem,
  studyModeBadgeClass,
  studyModeShortLabel,
} from '@/lib/student/visual-qa-study-mode';
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

export type VisualQaHistorySelectOptions = {
  studyMode: VisualQaStudyMode;
  caseId?: string | null;
};

type Props = {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string, options?: VisualQaHistorySelectOptions) => void;
  /** Bump sau khi tạo phiên chat mới để refetch danh sách không cần reload trang. */
  refreshNonce?: number;
  /** Tab mặc định khi mở history picker (uncontrolled fallback). */
  defaultStudyMode?: VisualQaStudyMode;
  /** Controlled history tab — survives sidebar remounts when lifted to the workspace page. */
  activeStudyMode?: VisualQaStudyMode;
  onActiveStudyModeChange?: (mode: VisualQaStudyMode) => void;
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

const HISTORY_MODE_TABS: { mode: VisualQaStudyMode; label: string; description: string }[] = [
  {
    mode: 'personal_dicom',
    label: 'DICOM upload',
    description: 'Sessions from your uploaded studies',
  },
  {
    mode: 'catalog_case_study',
    label: 'Case study',
    description: 'Teaching case library Q&A sessions',
  },
];

export function VisualQaSessionHistorySidebar({
  selectedSessionId,
  onSelectSession,
  refreshNonce = 0,
  defaultStudyMode = 'personal_dicom',
  activeStudyMode,
  onActiveStudyModeChange,
  className,
}: Props) {
  const [internalActiveMode, setInternalActiveMode] = useState<VisualQaStudyMode>(defaultStudyMode);
  const activeMode = activeStudyMode ?? internalActiveMode;
  const setActiveMode = useCallback(
    (mode: VisualQaStudyMode) => {
      onActiveStudyModeChange?.(mode);
      if (activeStudyMode === undefined) {
        setInternalActiveMode(mode);
      }
    },
    [activeStudyMode, onActiveStudyModeChange],
  );
  const [itemsByMode, setItemsByMode] = useState<Partial<Record<VisualQaStudyMode, VisualQaSessionHistoryItem[]>>>(
    {},
  );
  const [loadingMode, setLoadingMode] = useState<VisualQaStudyMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistoryForMode = useCallback(async (mode: VisualQaStudyMode) => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      setItemsByMode((prev) => ({ ...prev, [mode]: [] }));
      setLoadingMode(null);
      setError(null);
      return;
    }
    setLoadingMode(mode);
    setError(null);
    try {
      const result =
        mode === 'personal_dicom'
          ? await fetchVisualQaPersonalHistory({ limit: 20, offset: 0 })
          : await fetchVisualQaCaseHistoryNormalized({ limit: 20, offset: 0 });
      setItemsByMode((prev) => ({ ...prev, [mode]: result.items }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load session history.');
    } finally {
      setLoadingMode(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadHistoryForMode(activeMode);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMode, loadHistoryForMode, refreshNonce]);

  const sorted = useMemo(() => {
    const items = itemsByMode[activeMode] ?? [];
    return [...items].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? 0).getTime();
      return tb - ta;
    });
  }, [activeMode, itemsByMode]);

  const activeTabMeta = HISTORY_MODE_TABS.find((tab) => tab.mode === activeMode);

  return (
    <aside
      className={cn(
        'medical-glass-panel m-3 mr-0 flex min-h-0 w-full flex-col overflow-hidden border-slate-200/70 bg-white/75 lg:w-[280px] lg:shrink-0',
        className,
      )}
    >
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Chat history</p>
        <p className="mt-1 text-xs text-slate-500">Choose a session type, then open a past conversation.</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1">
          {HISTORY_MODE_TABS.map((tab) => {
            const active = tab.mode === activeMode;
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() => setActiveMode(tab.mode)}
                className={cn(
                  'rounded-xl px-2 py-2 text-left text-[11px] font-semibold transition-all',
                  active
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-700',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTabMeta ? (
          <p className="mt-2 text-[11px] text-slate-500">{activeTabMeta.description}</p>
        ) : null}
      </div>
      <div className="app-scroll-y min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loadingMode === activeMode ? (
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
              onClick={() => void loadHistoryForMode(activeMode)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            {activeMode === 'personal_dicom'
              ? 'No DICOM upload sessions yet. Upload a study to start.'
              : 'No case study sessions yet. Open a teaching case from the library.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((row) => {
              const sid = row.sessionId.trim();
              const title = row.questionSnippet?.trim() || 'Study session';
              const rel = formatRelativeTime(row.updatedAt ?? null);
              const active = selectedSessionId?.trim() === sid;
              const studyMode = inferStudyModeFromHistoryItem(row);
              const caseRemoved = row.caseRemoved === true;
              return (
                <li key={sid}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode(studyMode);
                      stashSessionPrefillImage(sid, row.imageUrl);
                      onSelectSession(sid, { studyMode, caseId: row.caseId });
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
                      <span className="mb-1 flex flex-wrap gap-1">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${studyModeBadgeClass(studyMode)}`}
                        >
                          {studyModeShortLabel(studyMode)}
                        </span>
                        {caseRemoved ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                            Case removed
                          </span>
                        ) : null}
                      </span>
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
