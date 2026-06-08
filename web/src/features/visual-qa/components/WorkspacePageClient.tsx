'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { History } from 'lucide-react';
import {
  clearSessionPrefillImages,
  readAndClearSessionPrefillImage,
  VisualQaSessionHistorySidebar,
} from '@/components/student/VisualQaSessionHistorySidebar';
import { EmptyState } from '@/components/shared/EmptyState';
import { resolveStudyImageSrc } from '@/lib/api/visual-qa';
import { showApiErrorToast } from '@/lib/api/errors/show-api-error-toast';
import { fetchCaseCatalogDetail } from '@/lib/api/student';
import type { StudentCaseCatalogDetail } from '@/lib/api/types';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';
import type { VisualQaUploadPersonalResponse } from '@/lib/api/visual-qa';
import { useVisualQA } from '@/features/visual-qa/hooks/useVisualQA';
import { useVisualQAExpertSupport } from '@/features/visual-qa/hooks/useVisualQAExpertSupport';
import { useVisualQaStore } from '@/features/visual-qa/store/visual-qa-store';
import { WorkspaceShell } from '@/features/visual-qa/components/WorkspaceShell';
import { WorkspaceFlowBar } from '@/features/visual-qa/components/WorkspaceFlowBar';
import { WorkspaceImagePanel } from '@/features/visual-qa/components/WorkspaceImagePanel';
import { WorkspaceChatPanel } from '@/features/visual-qa/components/WorkspaceChatPanel';
import { WorkspaceEmptyState } from '@/features/visual-qa/components/WorkspaceEmptyState';
import { WorkspaceContextPanel } from '@/features/visual-qa/components/WorkspaceContextPanel';
import { WorkspaceSessionLoadingOverlay } from '@/features/visual-qa/components/WorkspaceSessionLoadingOverlay';
import { useDashboardHeader } from '@/components/layouts/dashboard-header-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildCaseWorkspaceHref,
  buildPersonalWorkspaceHref,
  buildWorkspaceHrefForHistoryItem,
  isCatalogCaseStudyMode,
  normalizeVisualQaStudyMode,
  VISUAL_QA_CASE_WORKSPACE_PATH,
  VISUAL_QA_PERSONAL_WORKSPACE_PATH,
} from '@/lib/student/visual-qa-study-mode';
import type { VisualQaHistorySelectOptions } from '@/components/student/VisualQaSessionHistorySidebar';
import type { VisualQaStudyMode, VisualQaThreadResponse } from '@/lib/api/visual-qa';
import { buildWorkspaceHrefAfterStaleSession } from '@/lib/student/visual-qa-thread-state';

export type WorkspacePageVariant = 'personal' | 'catalog';

function resolveCatalogImageUrl(detail: StudentCaseCatalogDetail): string | null {
  const candidates = [
    detail.images?.[0]?.imageUrl,
    detail.imageUrl,
    ...((detail.images ?? []).map((img) => img.imageUrl)),
  ];
  for (const candidate of candidates) {
    const resolved = resolveStudyImageSrc(candidate);
    if (resolved) return resolved;
  }
  return null;
}

type WorkspacePageClientProps = {
  /** `personal` = DICOM upload workspace; `catalog` = case library workspace. */
  variant?: WorkspacePageVariant;
};

export function WorkspacePageClient({ variant = 'personal' }: WorkspacePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCaseId = searchParams.get('caseId')?.trim() ?? '';
  const querySessionId = searchParams.get('sessionId')?.trim() ?? '';
  const queryFlow = searchParams.get('flow')?.trim().toLowerCase();

  const {
    flow,
    sessionId,
    caseId,
    previewImageUrl,
    capabilities,
    turns,
    isAsking,
    isUploading,
    lastSystemNotice,
    caseRemoved,
    setFlow,
    setCaseContext,
    sendQuestion,
    hydrateSession,
    resetSession,
  } = useVisualQA();

  const [caseDetail, setCaseDetail] = useState<StudentCaseCatalogDetail | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'image' | 'chat'>('image');
  const [personalMeta, setPersonalMeta] = useState<{
    fileName?: string;
    uploadedAt?: string;
    sessionId?: string;
    dicomMetadata?: VisualQaDicomMetadata | null;
  } | null>(null);
  const storeDicomMetadata = useVisualQaStore((s) => s.dicomMetadata);
  const [historyRefreshNonce, setHistoryRefreshNonce] = useState(0);
  const [emptyLandingHistoryOpen, setEmptyLandingHistoryOpen] = useState(false);
  const [activeSessionHistoryOpen, setActiveSessionHistoryOpen] = useState(false);
  const [awaitingNewSession, setAwaitingNewSession] = useState(false);
  const bootKeyRef = useRef<string | null>(null);

  const workspaceBasePath =
    variant === 'catalog' ? VISUAL_QA_CASE_WORKSPACE_PATH : VISUAL_QA_PERSONAL_WORKSPACE_PATH;
  const defaultHistoryStudyMode: VisualQaStudyMode =
    variant === 'catalog' ? 'catalog_case_study' : 'personal_dicom';
  const historyTabStorageKey =
    variant === 'catalog' ? 'bonevisqa:vqa-history-tab:catalog' : 'bonevisqa:vqa-history-tab:personal';

  const readPersistedHistoryTab = useCallback((): VisualQaStudyMode => {
    if (typeof sessionStorage === 'undefined') return defaultHistoryStudyMode;
    try {
      const stored = sessionStorage.getItem(historyTabStorageKey);
      return normalizeVisualQaStudyMode(stored) ?? defaultHistoryStudyMode;
    } catch {
      return defaultHistoryStudyMode;
    }
  }, [defaultHistoryStudyMode, historyTabStorageKey]);

  const [historyActiveMode, setHistoryActiveMode] = useState<VisualQaStudyMode>(readPersistedHistoryTab);

  useEffect(() => {
    setHistoryActiveMode(readPersistedHistoryTab());
  }, [readPersistedHistoryTab]);

  const handleHistoryActiveModeChange = useCallback(
    (mode: VisualQaStudyMode) => {
      setHistoryActiveMode(mode);
      if (typeof sessionStorage === 'undefined') return;
      try {
        sessionStorage.setItem(historyTabStorageKey, mode);
      } catch {
        /* quota / private mode */
      }
    },
    [historyTabStorageKey],
  );

  const effectiveCaseId = queryCaseId || caseId || '';
  const effectiveSessionId = querySessionId || sessionId || '';
  const hasActiveWorkspace = Boolean(
    effectiveSessionId || effectiveCaseId || sessionId?.trim() || caseId?.trim(),
  );
  const isEmptyWorkspace = awaitingNewSession || !hasActiveWorkspace;

  useEffect(() => {
    if (!querySessionId && !queryCaseId) {
      setAwaitingNewSession(false);
    }
  }, [queryCaseId, querySessionId]);

  const handleReviewRequested = useCallback(() => {
    setHistoryRefreshNonce((n) => n + 1);
  }, []);

  const handleStaleSession = useCallback(
    async (thread: VisualQaThreadResponse, options?: { preserveCaseId?: string | null }) => {
      const preserveCaseId = thread.caseRemoved
        ? null
        : options?.preserveCaseId?.trim() || queryCaseId || caseId || thread.caseId || null;
      bootKeyRef.current = null;
      setSessionLoadError(null);
      setIsSessionLoading(false);
      setBootLoading(false);
      setHistoryRefreshNonce((n) => n + 1);

      if (thread.caseRemoved) {
        setCaseDetail(null);
      } else if (variant === 'catalog' && preserveCaseId) {
        try {
          const detail = await fetchCaseCatalogDetail(preserveCaseId);
          setCaseDetail(detail);
          if (!detail.communityReferenceOnly) {
            setCaseContext(preserveCaseId, resolveCatalogImageUrl(detail));
            setFlow('catalog');
          }
        } catch {
          setCaseDetail(null);
        }
      }

      router.replace(
        buildWorkspaceHrefAfterStaleSession({ variant, caseId: preserveCaseId }),
        { scroll: false },
      );
    },
    [caseId, queryCaseId, router, setCaseContext, setFlow, variant],
  );

  const isCatalogFlow =
    variant === 'catalog' ||
    isCatalogCaseStudyMode(capabilities, flow) ||
    flow === 'catalog' ||
    queryFlow === 'catalog';

  useEffect(() => {
    // Redirect wrong-workspace URLs to the correct workspace.
    if (variant === 'personal' && (queryCaseId || queryFlow === 'catalog')) {
      const params = new URLSearchParams();
      if (querySessionId) params.set('sessionId', querySessionId);
      if (queryCaseId) params.set('caseId', queryCaseId);
      router.replace(`${VISUAL_QA_CASE_WORKSPACE_PATH}?${params.toString()}`, { scroll: false });
      return;
    }
    // Only redirect catalog→personal when there is an explicit flow=personal param AND no
    // caseId present. We do NOT redirect when flow param is absent (catalog page default).
    if (variant === 'catalog' && queryFlow === 'personal' && !queryCaseId && querySessionId) {
      router.replace(buildPersonalWorkspaceHref(querySessionId), { scroll: false });
    }
  }, [queryCaseId, queryFlow, querySessionId, router, variant]);

  const {
    expertSupportByAssistantId,
    requestingExpertSupportForAssistantId,
    requestExpertSupport,
  } = useVisualQAExpertSupport(isCatalogFlow ? null : effectiveSessionId || sessionId, turns, {
    onReviewRequested: handleReviewRequested,
  });

  const headerTitle =
    caseDetail?.title?.trim() || (flow === 'personal' ? 'Personal study' : 'Visual QA');

  const emptyHeaderActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 rounded-2xl border-slate-200/70 bg-white/85 text-xs shadow-sm hover:bg-slate-50"
        onClick={() => setEmptyLandingHistoryOpen(true)}
        aria-expanded={emptyLandingHistoryOpen}
      >
        <History className="h-3.5 w-3.5" aria-hidden />
        Chat history
      </Button>
    ),
    [emptyLandingHistoryOpen],
  );

  useDashboardHeader({
    title: isEmptyWorkspace ? 'Visual QA' : headerTitle,
    showBack: false,
    actions: isEmptyWorkspace ? emptyHeaderActions : undefined,
  });

  useEffect(() => {
    if (isEmptyWorkspace) {
      bootKeyRef.current = null;
      setBootLoading(false);
      setBootError(null);
      return;
    }

    const bootKey = `${querySessionId}|${queryCaseId}|${queryFlow}`;
    if (bootKeyRef.current === bootKey && turns.length > 0) {
      setBootLoading(false);
      setIsSessionLoading(false);
      return;
    }

    let cancelled = false;
    const isSessionBoot = Boolean(querySessionId);
    const isCatalogBoot = Boolean(queryCaseId) && !querySessionId;

    void (async () => {
      if (isSessionBoot) {
        setIsSessionLoading(true);
        setSessionLoadError(null);
      } else if (isCatalogBoot && turns.length === 0) {
        setBootLoading(true);
      }
      setBootError(null);

      try {
        setFlow(variant === 'catalog' ? 'catalog' : 'personal');

        if (querySessionId) {
          const storeSessionId = useVisualQaStore.getState().sessionId?.trim();
          if (storeSessionId !== querySessionId) {
            useVisualQaStore.getState().beginSessionLoad(querySessionId);
          }
          const hydrateResult = await hydrateSession(querySessionId);
          if (cancelled) return;
          if (hydrateResult?.status === 'missing') {
            await handleStaleSession(hydrateResult.thread, {
              preserveCaseId: queryCaseId || caseId,
            });
            return;
          }
          if (queryFlow === 'personal' || flow === 'personal') {
            setPersonalMeta((prev) => ({
              ...prev,
              sessionId: querySessionId,
              uploadedAt: prev?.uploadedAt ?? new Date().toISOString(),
            }));
          }
        } else if (queryCaseId) {
          const detail = await fetchCaseCatalogDetail(queryCaseId);
          if (cancelled) return;
          setCaseDetail(detail);
          if (detail.communityReferenceOnly) {
            setBootError('Community reference cases do not support interactive Visual QA.');
            return;
          }
          const imageUrl = resolveCatalogImageUrl(detail);
          setCaseContext(detail.id, imageUrl);
          setFlow('catalog');
        } else if (sessionId?.trim()) {
          const hydrateResult = await hydrateSession(sessionId);
          if (cancelled) return;
          if (hydrateResult?.status === 'missing') {
            await handleStaleSession(hydrateResult.thread, { preserveCaseId: queryCaseId || caseId });
            return;
          }
        }
        if (!cancelled) bootKeyRef.current = bootKey;
      } catch (err) {
        if (cancelled) return;
        if (isSessionBoot) {
          setSessionLoadError('Could not load this Visual QA session.');
          if (axios.isAxiosError(err) && err.response?.status !== 404) {
            showApiErrorToast(err);
          }
        } else if (axios.isAxiosError(err)) {
          showApiErrorToast(err);
          if (err.response?.status === 404) {
            setBootError('Case or Q&A session not found.');
          } else {
            setBootError('Unable to load Visual QA session.');
          }
        } else {
          setBootError(err instanceof Error ? err.message : 'Unable to load Visual QA session.');
        }
      } finally {
        if (!cancelled) {
          if (isSessionBoot) setIsSessionLoading(false);
          else setBootLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    caseId,
    flow,
    handleStaleSession,
    hydrateSession,
    isEmptyWorkspace,
    queryCaseId,
    queryFlow,
    querySessionId,
    sessionId,
    setCaseContext,
    setFlow,
    variant,
  ]);

  useEffect(() => {
    if (flow !== 'catalog' || !effectiveCaseId) return;
    let cancelled = false;
    void fetchCaseCatalogDetail(effectiveCaseId)
      .then((detail) => {
        if (!cancelled) setCaseDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setCaseDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveCaseId, flow]);

  const displayImageUrl = useMemo(() => {
    const fromPreview = resolveStudyImageSrc(previewImageUrl);
    if (fromPreview) return fromPreview;
    if (caseDetail) return resolveCatalogImageUrl(caseDetail);
    return null;
  }, [caseDetail, previewImageUrl]);

  const title = headerTitle;
  const answerVariant = 'full' as const;

  const handleUploadSuccess = useCallback(
    (result: VisualQaUploadPersonalResponse, file?: File) => {
      const sid = result.sessionId?.trim();
      if (!sid) return;

      setAwaitingNewSession(false);
      setFlow('personal');
      setPersonalMeta({
        fileName: file?.name,
        uploadedAt: new Date().toISOString(),
        sessionId: sid,
        dicomMetadata: result.dicomMetadata ?? null,
      });
      setHistoryRefreshNonce((n) => n + 1);
      setEmptyLandingHistoryOpen(false);

      const bootKey = `${sid}||personal`;
      bootKeyRef.current = bootKey;

      router.replace(buildPersonalWorkspaceHref(sid), { scroll: false });
    },
    [router, setFlow],
  );

  const handleSelectHistorySession = useCallback(
    async (targetSessionId: string, options?: VisualQaHistorySelectOptions) => {
      const sid = targetSessionId.trim();
      if (!sid || sid === effectiveSessionId) return;
      const studyMode =
        options?.studyMode ??
        (options?.caseId?.trim() ? 'catalog_case_study' : 'personal_dicom');
      const isCatalog = studyMode === 'catalog_case_study';

      const href = buildWorkspaceHrefForHistoryItem({
        sessionId: sid,
        caseId: options?.caseId,
        studyMode: options?.studyMode,
      });

      // If the selected session belongs to the OTHER workspace type, navigate there —
      // don't try to load a DICOM session in the catalog workspace or vice versa.
      const targetIsDifferentWorkspace =
        (variant === 'catalog' && !isCatalog) ||
        (variant === 'personal' && isCatalog);

      if (targetIsDifferentWorkspace) {
        if (typeof sessionStorage !== 'undefined') {
          try {
            const targetTabKey =
              studyMode === 'catalog_case_study'
                ? 'bonevisqa:vqa-history-tab:catalog'
                : 'bonevisqa:vqa-history-tab:personal';
            sessionStorage.setItem(targetTabKey, studyMode);
          } catch {
            /* quota / private mode */
          }
        }
        router.push(href);
        return;
      }

      setAwaitingNewSession(false);
      setEmptyLandingHistoryOpen(false);
      setSessionLoadError(null);
      setIsSessionLoading(true);
      bootKeyRef.current = null;
      const prefill = readAndClearSessionPrefillImage(sid);
      useVisualQaStore.getState().beginSessionLoad(sid);
      const resolvedPrefill = resolveStudyImageSrc(prefill);
      if (resolvedPrefill) {
        useVisualQaStore.getState().setPreviewImageUrl(resolvedPrefill);
      }
      if (isCatalog) {
        setFlow('catalog');
        setPersonalMeta(null);
        const historyCaseId = options?.caseId?.trim();
        if (historyCaseId) setCaseContext(historyCaseId, resolvedPrefill ?? null);
      } else {
        setFlow('personal');
        setPersonalMeta((prev) => ({
          ...prev,
          sessionId: sid,
          uploadedAt: prev?.uploadedAt,
        }));
      }
      router.replace(href, { scroll: false });

      try {
        const hydrateResult = await hydrateSession(sid);
        if (hydrateResult?.status === 'missing') {
          await handleStaleSession(hydrateResult.thread, {
            preserveCaseId: options?.caseId ?? queryCaseId ?? caseId,
          });
        }
      } catch {
        setSessionLoadError('Could not load this Visual QA session.');
      } finally {
        setIsSessionLoading(false);
      }
    },
    [
      caseId,
      effectiveSessionId,
      handleStaleSession,
      hydrateSession,
      queryCaseId,
      router,
      setCaseContext,
      setFlow,
      variant,
    ],
  );

  const handleRetrySessionLoad = useCallback(async () => {
    const sid = effectiveSessionId?.trim();
    if (!sid) return;
    setSessionLoadError(null);
    setIsSessionLoading(true);
    bootKeyRef.current = null;
    try {
      const hydrateResult = await hydrateSession(sid);
      if (hydrateResult?.status === 'missing') {
        await handleStaleSession(hydrateResult.thread, { preserveCaseId: queryCaseId || caseId });
        return;
      }
    } catch {
      setSessionLoadError('Could not load this Visual QA session.');
    } finally {
      setIsSessionLoading(false);
    }
  }, [caseId, effectiveSessionId, handleStaleSession, hydrateSession, queryCaseId]);

  const handleSend = useCallback(
    async (text: string) => {
      setMobileTab('chat');
      try {
        const response = await sendQuestion(text, {
          caseId: effectiveCaseId || undefined,
          sessionId: effectiveSessionId || undefined,
        });
        const newSessionId = response.sessionId?.trim();
        if (newSessionId && !querySessionId) {
          const href = isCatalogFlow
            ? buildCaseWorkspaceHref(effectiveCaseId, newSessionId)
            : buildPersonalWorkspaceHref(newSessionId);
          router.replace(href, { scroll: false });
        }
        if (newSessionId) setHistoryRefreshNonce((n) => n + 1);
      } catch (err) {
        if (!axios.isAxiosError(err)) {
          showApiErrorToast(err);
        }
      }
    },
    [effectiveCaseId, effectiveSessionId, flow, querySessionId, router, sendQuestion],
  );

  /**
   * "New chat" in case-workspace → clear state but stay in case-workspace (pick new case).
   * "New chat" in personal-workspace → clear state and go back to upload landing.
   */
  const handleNewSession = useCallback(() => {
    clearSessionPrefillImages();
    bootKeyRef.current = null;
    setAwaitingNewSession(true);
    resetSession();
    setCaseDetail(null);
    setPersonalMeta(null);
    router.replace(workspaceBasePath);
  }, [resetSession, router, workspaceBasePath]);

  /** Shortcut from case-workspace flow bar to create a fresh DICOM upload session. */
  const handleGoToPersonalUpload = useCallback(() => {
    router.push(VISUAL_QA_PERSONAL_WORKSPACE_PATH);
  }, [router]);

  const readOnlyImage = capabilities?.isReadOnly === true;
  const composerDisabled =
    isUploading ||
    isSessionLoading ||
    isAsking ||
    (!effectiveCaseId && !effectiveSessionId) ||
    bootLoading ||
    Boolean(bootError) ||
    Boolean(sessionLoadError) ||
    capabilities?.isReadOnly === true ||
    capabilities?.canAskNext === false;

  const imagePanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <WorkspaceImagePanel
          imageUrl={displayImageUrl}
          imageAlt={title}
          loading={
            isUploading ||
            isSessionLoading ||
            (isCatalogFlow && bootLoading && !displayImageUrl)
          }
          readOnly={readOnlyImage}
          catalogMode={isCatalogFlow}
        />
      </div>
      <WorkspaceContextPanel
        layout="docked"
        flow={flow === 'catalog' ? 'catalog' : flow === 'personal' ? 'personal' : null}
        caseDetail={flow === 'catalog' ? caseDetail : null}
        personalMeta={{
          ...personalMeta,
          dicomMetadata: personalMeta?.dicomMetadata ?? storeDicomMetadata,
        }}
        onResetPersonal={flow === 'personal' ? handleNewSession : undefined}
      />
    </div>
  );

  if (bootLoading && turns.length === 0 && !querySessionId) {
    return (
      <WorkspaceSessionLoadingOverlay visible message="Opening workspace…" variant="fullscreen" />
    );
  }

  if (bootError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState title="Unable to open Visual QA" description={bootError} />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/student/catalog"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Browse cases
          </Link>
          <button
            type="button"
            onClick={handleNewSession}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const persistHistorySidebar = variant === 'catalog';

  const historySidebar = (
    <VisualQaSessionHistorySidebar
      className={
        persistHistorySidebar
          ? 'min-h-0 max-lg:hidden'
          : 'fixed inset-y-0 left-0 z-[50] flex w-[min(92vw,320px)] rounded-none border-r shadow-xl max-lg:top-14 lg:static lg:z-auto lg:min-h-0 lg:max-lg:hidden'
      }
      selectedSessionId={effectiveSessionId || null}
      onSelectSession={handleSelectHistorySession}
      refreshNonce={historyRefreshNonce}
      defaultStudyMode={defaultHistoryStudyMode}
      activeStudyMode={historyActiveMode}
      onActiveStudyModeChange={handleHistoryActiveModeChange}
    />
  );

  if (isEmptyWorkspace) {
    if (persistHistorySidebar) {
      return (
        <div className="relative grid h-full min-h-0 grid-cols-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))] lg:grid-cols-[minmax(240px,292px)_minmax(0,1fr)]">
          {historySidebar}
          <WorkspaceEmptyState
            variant={variant}
            onUploaded={(result, file) => handleUploadSuccess(result, file)}
          />
        </div>
      );
    }

    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))]">
        {emptyLandingHistoryOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[55] bg-black/40"
              aria-label="Close chat history"
              onClick={() => setEmptyLandingHistoryOpen(false)}
            />
            <VisualQaSessionHistorySidebar
              className="fixed inset-y-0 right-0 z-[60] flex w-[min(92vw,320px)] rounded-none border-l shadow-xl lg:left-auto"
              selectedSessionId={null}
              onSelectSession={handleSelectHistorySession}
              refreshNonce={historyRefreshNonce}
              defaultStudyMode={defaultHistoryStudyMode}
              activeStudyMode={historyActiveMode}
              onActiveStudyModeChange={handleHistoryActiveModeChange}
            />
          </>
        ) : null}
        <WorkspaceEmptyState
          variant={variant}
          onUploaded={(result, file) => handleUploadSuccess(result, file)}
        />
      </div>
    );
  }

  const showHistorySidebar = persistHistorySidebar || (Boolean(effectiveSessionId) && activeSessionHistoryOpen);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,0.92))]">
      <WorkspaceFlowBar
        flow={flow}
        caseRemoved={caseRemoved}
        onNewChat={handleNewSession}
        onGoToPersonalUpload={variant === 'catalog' ? handleGoToPersonalUpload : undefined}
        onOpenHistory={
          persistHistorySidebar ? undefined : () => setActiveSessionHistoryOpen((open) => !open)
        }
        historyOpen={persistHistorySidebar ? true : activeSessionHistoryOpen}
      />

      <div
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          showHistorySidebar
            ? 'grid-cols-1 lg:grid-cols-[minmax(240px,292px)_minmax(0,1fr)]'
            : 'grid-cols-1',
        )}
      >
        {showHistorySidebar ? (
          persistHistorySidebar ? (
            historySidebar
          ) : (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[45] bg-black/30 lg:hidden"
                aria-label="Close chat history"
                onClick={() => setActiveSessionHistoryOpen(false)}
              />
              <VisualQaSessionHistorySidebar
                className="fixed inset-y-0 left-0 z-[50] flex w-[min(92vw,320px)] rounded-none border-r shadow-xl max-lg:top-14 lg:static lg:z-auto lg:min-h-0 lg:max-lg:hidden"
                selectedSessionId={effectiveSessionId || null}
                onSelectSession={(sid, options) => {
                  setActiveSessionHistoryOpen(false);
                  handleSelectHistorySession(sid, options);
                }}
                refreshNonce={historyRefreshNonce}
                defaultStudyMode={defaultHistoryStudyMode}
                activeStudyMode={historyActiveMode}
                onActiveStudyModeChange={handleHistoryActiveModeChange}
              />
            </>
          )
        ) : null}

        <div className="relative min-h-0 min-w-0">
          <WorkspaceSessionLoadingOverlay visible={isSessionLoading} />
          {sessionLoadError && !isSessionLoading ? (
            <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <span>{sessionLoadError}</span>
              <button
                type="button"
                onClick={handleRetrySessionLoad}
                className="shrink-0 rounded-lg border border-destructive/40 bg-white px-3 py-1 text-xs font-medium hover:bg-destructive/5"
              >
                Retry
              </button>
            </div>
          ) : null}
          <WorkspaceShell
            className="min-h-0 min-w-0"
            mobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            imagePanel={imagePanel}
            chatPanel={
              <WorkspaceChatPanel
                turns={turns}
                capabilities={capabilities}
                isAsking={isAsking}
                lastSystemNotice={lastSystemNotice}
                composerDisabled={composerDisabled}
                requestingExpertSupportForAssistantId={requestingExpertSupportForAssistantId}
                expertSupportByAssistantId={expertSupportByAssistantId}
                onRequestExpertSupport={isCatalogFlow ? undefined : requestExpertSupport}
                onSend={handleSend}
                onClear={handleNewSession}
                answerVariant={answerVariant}
                flow={flow}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
