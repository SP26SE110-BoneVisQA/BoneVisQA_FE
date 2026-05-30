import axios from 'axios';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  getToastSpecForHttpStatus,
  type ApiToastSpec,
} from '@/lib/api/errors/toast-messages.en';

/**
 * Resolves a user-safe error message from a failed query/mutation.
 */
export function getQueryErrorMessage(error: unknown, fallback = 'Failed to load data.'): string {
  if (axios.isAxiosError(error)) {
    const msg = getApiErrorMessage(error);
    return msg.trim() || fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

export function getQueryErrorToastSpec(error: unknown): ApiToastSpec {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const msg = getApiErrorMessage(error);
    return getToastSpecForHttpStatus(status, msg);
  }
  return getToastSpecForHttpStatus(undefined, getQueryErrorMessage(error));
}
