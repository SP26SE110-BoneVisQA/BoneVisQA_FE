import axios, { type AxiosError } from 'axios';

/** RFC 7807 / ASP.NET ProblemDetails + legacy API shapes. */
export type ProblemDetailsPayload = {
  type?: unknown;
  title?: unknown;
  detail?: unknown;
  status?: unknown;
  instance?: unknown;
  reason?: unknown;
  message?: unknown;
  error?: unknown;
  errors?: unknown;
  systemNotice?: unknown;
  capabilities?: unknown;
  latestTurn?: unknown;
};

export type ParsedApiErrorBody = {
  message: string;
  title?: string;
  detail?: string;
  reason?: string | null;
  status?: number;
  raw?: unknown;
};

function asTrimmedString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

function validationMessagesFromErrorsMap(errMap: unknown): string[] {
  if (!errMap || typeof errMap !== 'object' || Array.isArray(errMap)) return [];
  const lines: string[] = [];
  for (const [, v] of Object.entries(errMap as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.trim()) lines.push(item.trim());
      }
    } else if (typeof v === 'string' && v.trim()) {
      lines.push(v.trim());
    }
  }
  return lines;
}

/**
 * Extracts a user-facing message from any API error payload (ProblemDetails, legacy, Visual QA session block).
 */
export function parseApiErrorBody(data: unknown, fallbackStatus?: number): ParsedApiErrorBody {
  if (typeof data === 'string' && data.trim()) {
    return { message: data.trim(), status: fallbackStatus, raw: data };
  }

  if (!data || typeof data !== 'object') {
    return {
      message: '',
      status: fallbackStatus,
      raw: data,
    };
  }

  const o = data as ProblemDetailsPayload;
  const validationLines = validationMessagesFromErrorsMap(o.errors);
  if (validationLines.length > 0) {
    return {
      message: validationLines.join(' '),
      status: fallbackStatus,
      raw: data,
    };
  }

  const detail = asTrimmedString(o.detail);
  const title = asTrimmedString(o.title);
  const message = asTrimmedString(o.message);
  const systemNotice = asTrimmedString(o.systemNotice);
  const error = asTrimmedString(o.error);
  const reason = asTrimmedString(o.reason) || null;

  const messageCandidates = [systemNotice, detail, message, title, error].filter(Boolean);
  const resolvedMessage = messageCandidates[0] ?? '';

  return {
    message: resolvedMessage,
    ...(title ? { title } : {}),
    ...(detail ? { detail } : {}),
    reason,
    status:
      typeof o.status === 'number' && Number.isFinite(o.status)
        ? o.status
        : fallbackStatus,
    raw: data,
  };
}

/** Machine hint from ProblemDetails extension or Visual QA policy payloads. */
export function getProblemReason(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const reason = asTrimmedString((data as ProblemDetailsPayload).reason);
  return reason || null;
}

/**
 * Visual QA controller may return 400 with `capabilities` + `latestTurn` (not always RFC 7807).
 */
export function isVisualQaSessionErrorBody(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const o = data as ProblemDetailsPayload;
  const hasCapabilities = o.capabilities != null && typeof o.capabilities === 'object';
  const hasLatestTurn = o.latestTurn != null && typeof o.latestTurn === 'object';
  const hasSystemNotice = Boolean(asTrimmedString(o.systemNotice));
  const hasMessage = Boolean(asTrimmedString(o.message));
  return hasCapabilities || hasLatestTurn || hasSystemNotice || hasMessage;
}

export function parseAxiosErrorBody(err: unknown): ParsedApiErrorBody {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    return parseApiErrorBody(err.response?.data, status);
  }
  if (err instanceof Error) {
    return { message: err.message.trim() };
  }
  return { message: '' };
}

export function isAxiosErrorWithStatus(err: unknown, status: number): err is AxiosError {
  return axios.isAxiosError(err) && err.response?.status === status;
}
