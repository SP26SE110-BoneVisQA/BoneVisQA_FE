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
import { PageLoadingSkeleton } from '@/components/shared/DashboardSkeletons';
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

export function WorkspacePageClient() {
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
  const [awaitingNewSession, setAwaitingNewSession] = useState(false);
  const bootKeyRef = useRef<string | null>(null);

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

  const {
    expertSupportByAssistantId,
    requestingExpertSupport,
    requestExpertSupport,
  } = useVisualQAExpertSupport(effectiveSessionId || sessionId, turns);

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
        if (queryFlow === 'personal' || queryFlow === 'catalog') {
          setFlow(queryFlow);
        }

        if (querySessionId) {
          const storeSessionId = useVisualQaStore.getState().sessionId?.trim();
          if (storeSessionId !== querySessionId) {
            useVisualQaStore.getState().beginSessionLoad(querySessionId);
          }
          await hydrateSession(querySessionId);
          if (cancelled) return;
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
          await hydrateSession(sessionId);
        }
        if (!cancelled) bootKeyRef.current = bootKey;
      } catch (err) {
        if (cancelled) return;
        if (isSessionBoot) {
          setSessionLoadError('Không tải được phiên Visual QA.');
          if (axios.isAxiosError(err)) {
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
    hydrateSession,
    isEmptyWorkspace,
    queryCaseId,
    queryFlow,
    querySessionId,
    sessionId,
    setCaseContext,
    setFlow,
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
  const isCatalogFlow = flow === 'catalog' || queryFlow === 'catalog';
  const answerVariant = isCatalogFlow ? 'catalog' : 'full';

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

      const url = `/student/visual-qa/workspace?sessionId=${encodeURIComponent(sid)}&flow=personal`;
      router.replace(url, { scroll: false });
    },
    [router, setFlow],
  );

  const handleSelectHistorySession = useCallback(
    (targetSessionId: string) => {
      const sid = targetSessionId.trim();
      if (!sid || sid === effectiveSessionId) return;
      setAwaitingNewSession(false);
      setEmptyLandingHistoryOpen(false);
      setSessionLoadError(null);
      const prefill = readAndClearSessionPrefillImage(sid);
      useVisualQaStore.getState().beginSessionLoad(sid);
      const resolvedPrefill = resolveStudyImageSrc(prefill);
      if (resolvedPrefill) {
        useVisualQaStore.getState().setPreviewImageUrl(resolvedPrefill);
      }
      setFlow('personal');
      setPersonalMeta((prev) => ({
        ...prev,
        sessionId: sid,
        uploadedAt: prev?.uploadedAt,
      }));
      router.replace(
        `/student/visual-qa/workspace?sessionId=${encodeURIComponent(sid)}&flow=personal`,
        { scroll: false },
      );
    },
    [effectiveSessionId, router, setFlow],
  );

  const handleRetrySessionLoad = useCallback(async () => {
    const sid = effectiveSessionId?.trim();
    if (!sid) return;
    setSessionLoadError(null);
    setIsSessionLoading(true);
    bootKeyRef.current = null;
    try {
      await hydrateSession(sid);
    } catch {
      setSessionLoadError('Không tải được phiên Visual QA.');
    } finally {
      setIsSessionLoading(false);
    }
  }, [effectiveSessionId, hydrateSession]);

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
          const params = new URLSearchParams();
          params.set('sessionId', newSessionId);
          if (effectiveCaseId) params.set('caseId', effectiveCaseId);
          params.set('flow', flow === 'personal' ? 'personal' : 'catalog');
          router.replace(`/student/visual-qa/workspace?${params.toString()}`, { scroll: false });
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

  const handleNewSession = useCallback(() => {
    clearSessionPrefillImages();
    bootKeyRef.current = null;
    setAwaitingNewSession(true);
    resetSession();
    setCaseDetail(null);
    setPersonalMeta(null);
    router.replace('/student/visual-qa/workspace');
  }, [resetSession, router]);

  const readOnlyImage = isCatalogFlow || capabilities?.isReadOnly === true;
  const composerDisabled =
    isUploading ||
    isSessionLoading ||
    isAsking ||
    (!effectiveCaseId && !effectiveSessionId) ||
    bootLoading ||
    Boolean(bootError) ||
    Boolean(sessionLoadError);

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
      <PageLoadingSkeleton className="min-h-full p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageLoadingSkeleton>
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

  if (isEmptyWorkspace) {
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
            />
          </>
        ) : null}
        <WorkspaceEmptyState onUploaded={(result, file) => handleUploadSuccess(result, file)} />
      </div>
    );
  }

  const showHistorySidebar = flow === 'personal' && Boolean(effectiveSessionId);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,0.92))]">
      <WorkspaceFlowBar flow={flow} onNewChat={handleNewSession} />

      <div
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          showHistorySidebar
            ? 'grid-cols-1 lg:grid-cols-[minmax(240px,292px)_minmax(0,1fr)]'
            : 'grid-cols-1',
        )}
      >
        {showHistorySidebar ? (
          <VisualQaSessionHistorySidebar
            className="min-h-0 max-lg:hidden"
            selectedSessionId={effectiveSessionId || null}
            onSelectSession={handleSelectHistorySession}
            refreshNonce={historyRefreshNonce}
          />
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
                Thử lại
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
                requestingExpertSupport={requestingExpertSupport}
                expertSupportByAssistantId={expertSupportByAssistantId}
                onRequestExpertSupport={requestExpertSupport}
                onSend={handleSend}
                onClear={handleNewSession}
                answerVariant={answerVariant}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
