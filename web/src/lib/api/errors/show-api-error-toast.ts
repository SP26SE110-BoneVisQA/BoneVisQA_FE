import axios, { type AxiosError } from 'axios';
import { parseApiErrorBody, parseAxiosErrorBody } from '@/lib/api/errors/problem-details';
import {
  looksLikeTechnicalErrorMessage,
  sanitizeForUserToast,
} from '@/lib/api/errors/sanitize-for-user';
import {
  getAccessDeniedWithoutLogoutToastSpec,
  getNetworkErrorToastSpec,
  getToastSpecForHttpStatus,
} from '@/lib/api/errors/toast-messages.en';
import { appToast } from '@/lib/api/errors/app-toast';

const VALIDATION_HINT =
  /required|invalid|must|please|check your|missing|cannot be empty|too (short|long)|at least|select|enter|provide|validation/i;

function isLikelyValidationError(status: number | undefined, message: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const text = message.trim();
  if (!text) return true;
  if (VALIDATION_HINT.test(text)) return true;
  return text.length <= 200 && !looksLikeTechnicalErrorMessage(text);
}

function resolveUserSafeMessage(err: AxiosError, status: number | undefined): string {
  const parsed = parseApiErrorBody(err.response?.data, status);
  const raw = parsed.message.trim();
  if (!raw) return '';
  const sanitized = sanitizeForUserToast(raw);
  if (looksLikeTechnicalErrorMessage(sanitized) && status !== undefined) {
    return getToastSpecForHttpStatus(status).message;
  }
  return sanitized;
}

/**
 * Shows a non-blocking Sonner toast for API failures (RFC 7807 + legacy shapes).
 * Respects caller intent: use `skipApiToast: true` on axios config to suppress.
 */
export function showApiErrorToast(err: unknown): void {
  if (typeof window === 'undefined') return;

  if (!axios.isAxiosError(err)) {
    const parsed = parseAxiosErrorBody(err);
    const msg = parsed.message.trim();
    appToast.error(msg ? sanitizeForUserToast(msg) : 'Something went wrong. Please try again.');
    return;
  }

  const status = err.response?.status;

  if (!err.response) {
    if (err.code === 'ECONNABORTED' || /timeout of \d+ms exceeded/i.test(err.message ?? '')) {
      appToast.warning('The request timed out. Please try again.');
      return;
    }
    const net = getNetworkErrorToastSpec();
    appToast.fromVariant(net.variant, net.message);
    return;
  }

  const userMessage = resolveUserSafeMessage(err, status);
  const spec = getToastSpecForHttpStatus(status, userMessage || null);
  const variant =
    isLikelyValidationError(status, spec.message) && spec.variant === 'error' ? 'warning' : spec.variant;
  appToast.fromVariant(variant, spec.message);
}

export function showAccessDeniedWithoutLogoutToast(): void {
  if (typeof window === 'undefined') return;
  const spec = getAccessDeniedWithoutLogoutToastSpec();
  appToast.fromVariant(spec.variant, spec.message);
}

export function showRoleAccessDeniedToast(): void {
  if (typeof window === 'undefined') return;
  const spec = getToastSpecForHttpStatus(403);
  appToast.fromVariant(spec.variant, spec.message);
}
