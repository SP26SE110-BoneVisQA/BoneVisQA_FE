export type ApiToastVariant = 'error' | 'warning' | 'info' | 'success';

export type ApiToastSpec = {
  variant: ApiToastVariant;
  message: string;
};

const DEFAULT_MESSAGES: Record<number, ApiToastSpec> = {
  400: {
    variant: 'warning',
    message: 'Invalid request. Please check your input and try again.',
  },
  401: {
    variant: 'error',
    message: 'Your session has expired. Please sign in again.',
  },
  403: {
    variant: 'error',
    message: 'You do not have permission to perform this action.',
  },
  404: {
    variant: 'error',
    message: 'The requested case or Q&A session was not found.',
  },
  409: {
    variant: 'warning',
    message: 'Session state conflict. Please reload the page.',
  },
  429: {
    variant: 'warning',
    message: 'Too many AI requests — please wait a few seconds and try again.',
  },
  502: {
    variant: 'error',
    message: 'The AI service is temporarily unavailable. Please try again later.',
  },
  503: {
    variant: 'info',
    message: 'The AI service is busy. Please try again in a moment.',
  },
  500: {
    variant: 'error',
    message: 'A server error occurred. Please try again later.',
  },
};

const NETWORK_ERROR: ApiToastSpec = {
  variant: 'error',
  message: 'Cannot reach the API server. Check your network and ensure the backend is running.',
};

const GENERIC_ERROR: ApiToastSpec = {
  variant: 'error',
  message: 'Something went wrong. Please try again.',
};

/** Maps HTTP status to Sonner variant + default English copy (RFC 7807 aligned). */
export function getToastSpecForHttpStatus(
  status: number | undefined,
  apiMessage?: string | null,
): ApiToastSpec {
  if (status === undefined || !Number.isFinite(status)) {
    return apiMessage?.trim()
      ? { variant: 'error', message: apiMessage.trim() }
      : GENERIC_ERROR;
  }

  const defaults = DEFAULT_MESSAGES[status];
  const trimmed = apiMessage?.trim();

  if (!defaults) {
    if (status >= 500) {
      return trimmed
        ? { variant: 'error', message: trimmed }
        : DEFAULT_MESSAGES[500]!;
    }
    if (status >= 400) {
      return trimmed
        ? { variant: 'warning', message: trimmed }
        : GENERIC_ERROR;
    }
    return trimmed ? { variant: 'info', message: trimmed } : GENERIC_ERROR;
  }

  if (!trimmed) return defaults;

  if (trimmed.length <= 280) {
    return { variant: defaults.variant, message: trimmed };
  }

  return defaults;
}

export function getNetworkErrorToastSpec(): ApiToastSpec {
  return NETWORK_ERROR;
}

/** 401 without clearing session (misconfigured endpoint returning 401 instead of 403). */
export function getAccessDeniedWithoutLogoutToastSpec(): ApiToastSpec {
  return {
    variant: 'warning',
    message:
      'This action could not be completed (access denied or server error). You are still signed in — try again or contact support.',
  };
}

/** RBAC route guard — shown when active role cannot access the URL prefix. */
export function getRoleAccessDeniedToastSpec(): ApiToastSpec {
  return DEFAULT_MESSAGES[403]!;
}
