import { toast } from 'sonner';
import type { ApiToastVariant } from '@/lib/api/errors/toast-messages.en';

/** Centralized Sonner entry point for English system UI notifications. */
export const appToast = {
  success(message: string, description?: string) {
    if (description) toast.success(message, { description });
    else toast.success(message);
  },
  error(message: string, description?: string) {
    if (description) toast.error(message, { description });
    else toast.error(message);
  },
  warning(message: string, description?: string) {
    if (description) toast.warning(message, { description });
    else toast.warning(message);
  },
  info(message: string, description?: string) {
    if (description) toast.info(message, { description });
    else toast.info(message);
  },
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error?: string },
  ) {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (err: unknown) =>
        err instanceof Error
          ? err.message
          : messages.error ?? 'Something went wrong. Please try again.',
    });
  },
  fromVariant(variant: ApiToastVariant, message: string, description?: string) {
    switch (variant) {
      case 'success':
        appToast.success(message, description);
        break;
      case 'warning':
        appToast.warning(message, description);
        break;
      case 'info':
        appToast.info(message, description);
        break;
      case 'error':
      default:
        appToast.error(message, description);
        break;
    }
  },
};
