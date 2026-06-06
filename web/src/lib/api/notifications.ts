import { http, getApiErrorMessage } from './client';
import { notificationTargetToAppPath } from '@/lib/notification-app-path';
import type { AppNotificationItem } from './types';

function mapNotification(row: unknown, index: number): AppNotificationItem | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id ?? item.notificationId ?? item.NotificationId ?? index);
  const type = String(item.type ?? item.notificationType ?? item.Type ?? 'general');
  const title = String(
    item.title ?? item.Title ?? item.subject ?? item.Subject ?? item.message ?? item.Message ?? 'Notification',
  ).trim();
  if (!title) return null;

  const messageRaw = item.message ?? item.Message ?? item.body ?? item.Body;
  const message = messageRaw != null ? String(messageRaw).trim() : undefined;

  /** BE `NotificationDto.Route` is already SPA-normalized when present — still run through helper for absolute URLs. */
  const routeExplicit = item.route ?? item.Route;
  const targetRaw =
    item.targetUrl ?? item.TargetUrl ?? item.href ?? item.url ?? item.deepLink ?? item.link;
  const routeFromTarget =
    targetRaw != null && String(targetRaw).trim()
      ? notificationTargetToAppPath(String(targetRaw).trim())
      : undefined;
  const route =
    routeExplicit != null && String(routeExplicit).trim()
      ? notificationTargetToAppPath(String(routeExplicit).trim())
      : routeFromTarget;

  const createdRaw = item.createdAt ?? item.CreatedAt ?? item.timestamp ?? item.Timestamp;

  return {
    id,
    type,
    title,
    ...(message ? { message } : {}),
    ...(route ? { route } : {}),
    createdAt: createdRaw != null ? String(createdRaw) : undefined,
    isRead: Boolean(item.isRead ?? item.IsRead ?? false),
  };
}

function unwrapNotificationList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const body = data as Record<string, unknown>;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.notifications)) return body.notifications;
  if (Array.isArray(body.data)) return body.data;
  if (body.result && typeof body.result === 'object') {
    const r = body.result as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items;
    if (Array.isArray(r.notifications)) return r.notifications;
    if (Array.isArray(body.result)) return body.result as unknown[];
  }
  return [];
}

export async function fetchNotifications(): Promise<AppNotificationItem[]> {
  try {
    const { data } = await http.get<unknown>('/api/notifications');
    const list = unwrapNotificationList(data);
    return list
      .map((entry, index) => mapNotification(entry, index))
      .filter((entry): entry is AppNotificationItem => entry !== null);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await http.put(`/api/notifications/${encodeURIComponent(id)}/read`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await http.put('/api/notifications/read-all');
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}
