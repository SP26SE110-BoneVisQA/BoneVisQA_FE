'use client';

import { toast as sonnerToast } from 'sonner';

type ToastAction = {
  label: string;
  onClick: () => void;
};

interface ToastApi {
  success: (message: string, options?: { action?: ToastAction }) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

/**
 * Backward-compatible hook — delegates to Sonner (single toast system).
 */
export function useToast(): ToastApi {
  return {
    success: (message, options) => {
      if (options?.action) {
        sonnerToast.success(message, {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
        });
      } else {
        sonnerToast.success(message);
      }
    },
    error: (message) => {
      sonnerToast.error(message);
    },
    info: (message) => {
      sonnerToast.info(message);
    },
  };
}

/** @deprecated Sonner is mounted in AppProviders — no DOM provider needed. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
