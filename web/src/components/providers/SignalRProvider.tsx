'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HubConnectionState, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

/** Library logs at Warning flood the console when the hub is down (negotiate “Failed to fetch”, WS 1006). */
function configureSignalRLogging(builder: HubConnectionBuilder): HubConnectionBuilder {
  const verbose =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SIGNALR_VERBOSE === 'true';
  return verbose ? builder.configureLogging(LogLevel.Warning) : builder.configureLogging(LogLevel.None);
}
import { toast } from 'sonner';
import { getPublicApiOrigin } from '@/lib/api/client';
import type { DocumentIngestionStatusDto, NotificationDto } from '@/lib/api/types';
import { useAuth } from '@/lib/useAuth';
import { isPublicAppRoute } from '@/lib/auth/rbac';
import { notificationTargetToAppPath } from '@/lib/notification-app-path';

function mapReceivePayload(raw: unknown): NotificationDto | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.Id ?? '').trim();
  if (!id) return null;
  const routeRaw = r.route ?? r.Route;
  const route = routeRaw != null && String(routeRaw).trim() ? String(routeRaw).trim() : undefined;
  const targetRaw =
    r.targetUrl != null
      ? String(r.targetUrl)
      : r.TargetUrl != null
        ? String(r.TargetUrl)
        : undefined;

  return {
    id,
    title: String(r.title ?? r.Title ?? 'Notification'),
    message: String(r.message ?? r.Message ?? ''),
    type: String(r.type ?? r.Type ?? 'general'),
    ...(route ? { route } : {}),
    ...(targetRaw?.trim() ? { targetUrl: targetRaw.trim() } : {}),
    isRead: Boolean(r.isRead ?? r.IsRead ?? false),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? new Date().toISOString()),
  };
}

function mapDocumentIngestionPayload(raw: unknown): DocumentIngestionStatusDto | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const documentId = String(r.documentId ?? r.DocumentId ?? '').trim();
  if (!documentId) return null;

  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  };

  const operationRaw =
    r.operation ?? r.currentOperation ?? r.Operation ?? r.CurrentOperation;

  const phaseNum = num(r.indexingPhase ?? r.IndexingPhase);

  return {
    documentId,
    status:
      r.status != null
        ? String(r.status)
        : r.Status != null
          ? String(r.Status)
          : undefined,
    totalPages: num(r.totalPages ?? r.TotalPages),
    totalChunks: num(r.totalChunks ?? r.TotalChunks),
    currentPageIndexing: num(r.currentPageIndexing ?? r.CurrentPageIndexing),
    progressPercentage: num(r.progressPercentage ?? r.ProgressPercentage),
    operation: operationRaw != null ? String(operationRaw) : undefined,
    indexingPhase:
      phaseNum != null && phaseNum >= 0 && phaseNum <= 5
        ? (phaseNum as DocumentIngestionStatusDto['indexingPhase'])
        : undefined,
    phaseLabel:
      r.phaseLabel != null
        ? String(r.phaseLabel)
        : r.PhaseLabel != null
          ? String(r.PhaseLabel)
          : undefined,
    chunksProcessed: num(r.chunksProcessed ?? r.ChunksProcessed),
    phase:
      r.phase != null
        ? String(r.phase)
        : r.Phase != null
          ? String(r.Phase)
          : undefined,
    errorMessage:
      r.errorMessage != null
        ? String(r.errorMessage)
        : r.ErrorMessage != null
          ? String(r.ErrorMessage)
          : r.failureReason != null
            ? String(r.failureReason)
            : undefined,
  };
}

export type SignalRConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

function mapHubState(state: HubConnectionState): SignalRConnectionStatus {
  switch (state) {
    case HubConnectionState.Connected:
      return 'connected';
    case HubConnectionState.Connecting:
    case HubConnectionState.Reconnecting:
      return 'reconnecting';
    default:
      return 'disconnected';
  }
}

type SignalRContextValue = {
  connectionStatus: SignalRConnectionStatus;
  notifications: NotificationDto[];
};

const SignalRContext = createContext<SignalRContextValue | null>(null);

/**
 * Mount once (e.g. under {@link AppShell}) so every page — including Admin document detail — shares
 * one hub connection to `{API_BASE_URL}/hubs/notifications` without duplicating sockets.
 */
export function SignalRProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<SignalRConnectionStatus>('disconnected');
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);

  const onNotification = useCallback(
    (payload: unknown) => {
      const n = mapReceivePayload(payload);
      if (!n) return;

      setNotifications((prev) => {
        const idx = prev.findIndex((x) => x.id === n.id);
        if (idx === -1) return [n, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...n };
        return next;
      });

      const typeLc = n.type.trim().toLowerCase();
      let openLabel = 'Open';
      if (typeLc === 'visual_qa_review_request') {
        openLabel = 'Open triage';
      } else if (
        typeLc === 'visual_qa_lecturer_reply' ||
        (typeLc.includes('visual_qa') && typeLc.includes('lecturer'))
      ) {
        openLabel = 'Open chat';
      } else if (typeLc.includes('visual_qa')) {
        openLabel = 'Open';
      }

      const navRaw = (n.route?.trim() || n.targetUrl?.trim()) ?? '';
      toast.info(n.title, {
        description: n.message || undefined,
        action: navRaw
          ? {
              label: openLabel,
              onClick: () => router.push(notificationTargetToAppPath(navRaw)),
            }
          : undefined,
      });
    },
    [router],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    const onPublicRoute = pathname ? isPublicAppRoute(pathname) : false;
    if (!user || !token || onPublicRoute) {
      setConnectionStatus('disconnected');
      return;
    }

    const base = getPublicApiOrigin();
    if (!base) {
      return;
    }

    const hubUrl = `${base}/hubs/notifications`;
    let aborted = false;
    const connectingTimer = window.setTimeout(() => {
      if (!aborted) setConnectionStatus('connecting');
    }, 0);

    const connection = configureSignalRLogging(
      new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => Promise.resolve(localStorage.getItem('token') ?? ''),
        })
        .withAutomaticReconnect([0, 2_000, 10_000, 30_000]),
    ).build();

    connection.on('ReceiveNotification', onNotification);
    connection.on('DocumentIndexingProgressUpdated', (payload) => {
      const normalized = mapDocumentIngestionPayload(payload);
      if (!normalized) return;
      const event = new CustomEvent<DocumentIngestionStatusDto>('DocumentIndexingProgressUpdated', {
        detail: normalized,
      });
      window.dispatchEvent(event);
    });

    connection.onreconnecting(() => {
      setConnectionStatus(mapHubState(connection.state));
    });
    connection.onreconnected(() => {
      setConnectionStatus(mapHubState(connection.state));
    });
    connection.onclose(() => {
      setConnectionStatus(mapHubState(connection.state));
    });

    const startConnection = async () => {
      try {
        if (connection.state === HubConnectionState.Disconnected) {
          await connection.start();
        }
        if (!aborted) {
          setConnectionStatus(mapHubState(connection.state));
        }
      } catch (error) {
        if (aborted) return;
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[SignalR] Notifications hub unavailable (${hubUrl}). ` +
              'Typical causes: API not running, wrong NEXT_PUBLIC_API_URL, missing CORS for this origin, or hub not mapped. ' +
              'Set NEXT_PUBLIC_SIGNALR_VERBOSE=true to see @microsoft/signalr logs.',
          );
        }
        setConnectionStatus('disconnected');
      }
    };

    void startConnection();

    return () => {
      aborted = true;
      window.clearTimeout(connectingTimer);
      connection.off('ReceiveNotification');
      connection.off('DocumentIndexingProgressUpdated');
      void connection.stop();
    };
  }, [user, pathname, onNotification]);

  const value = useMemo(
    () => ({
      connectionStatus,
      notifications,
    }),
    [connectionStatus, notifications],
  );

  return <SignalRContext.Provider value={value}>{children}</SignalRContext.Provider>;
}

/**
 * Notifications hub + `DocumentIndexingProgressUpdated` bridge (dispatched as `window` event).
 * Must run inside {@link SignalRProvider}.
 */
export function useSignalR(): SignalRContextValue {
  const ctx = useContext(SignalRContext);
  if (!ctx) {
    throw new Error('useSignalR must be used within SignalRProvider');
  }
  return ctx;
}
