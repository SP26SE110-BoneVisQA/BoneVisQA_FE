import axios from 'axios';
import { toast } from 'sonner';
import { http, getApiErrorMessage, getPublicApiOrigin } from './client';
import { normalizeVisualQaSessionReport } from './normalize-visual-qa';
import type {
  NormalizedImageBoundingBox,
  VisualQaSessionReport,
} from './types';
import { serializeNormalizedBoundingBox } from '@/lib/utils/annotations';
import { getClientAcceptLanguageHeader } from '@/lib/api/accept-language';

function unwrapVisualQaPayload(data: unknown): unknown {
  return data && typeof data === 'object' && 'data' in (data as object)
    ? (data as { data: unknown }).data
    : data;
}

export interface StudentVisualQaAskOptions {
  roiBoundingBox?: NormalizedImageBoundingBox | null;
  onUploadProgress?: (percent: number) => void;
  sessionId?: string | null;
  caseId?: string | null;
  imageId?: string | null;
  clientRequestId?: string | null;
}

function buildVisualQaFormData(
  file: File | null | undefined,
  questionText: string,
  options: StudentVisualQaAskOptions,
): FormData {
  const form = new FormData();
  const hasSession = Boolean(options.sessionId?.trim());
  if (file) {
    form.append('CustomImage', file);
  } else if (!hasSession) {
    throw new Error('Image file is required to start a new visual QA session.');
  }
  form.append('QuestionText', questionText);
  const serialized = serializeNormalizedBoundingBox(options.roiBoundingBox);
  if (serialized) {
    form.append('customPolygon', serialized);
  }
  if (options.sessionId?.trim()) {
    form.append('SessionId', options.sessionId.trim());
  }
  if (options.caseId?.trim()) {
    form.append('CaseId', options.caseId.trim());
  }
  if (options.imageId?.trim()) {
    form.append('ImageId', options.imageId.trim());
  }
  if (options.clientRequestId?.trim()) {
    form.append('ClientRequestId', options.clientRequestId.trim());
  }
  return form;
}

export async function postStudentVisualQa(
  file: File | null | undefined,
  questionText: string,
  options: StudentVisualQaAskOptions = {},
): Promise<VisualQaSessionReport> {
  const form = buildVisualQaFormData(file, questionText, options);

  try {
    const { data } = await http.post<unknown>('/api/student/visual-qa/ask', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      skipApiToast: true,
      onUploadProgress: (ev) => {
        if (!options.onUploadProgress || !ev.total) return;
        const pct = Math.round((ev.loaded / ev.total) * 100);
        options.onUploadProgress(Math.min(100, pct));
      },
    });
    const payload = unwrapVisualQaPayload(data);
    return normalizeVisualQaSessionReport(payload);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw e;
    }
    throw new Error(getApiErrorMessage(e));
  }
}

/** Options for SSE streaming ask (`POST /api/student/visual-qa/ask-stream`). */
export type AskVisualQaStreamOptions = StudentVisualQaAskOptions & {
  /** Cumulative assistant answer text after each parsed `data:` JSON delta. */
  onAssistantTextDelta?: (assistantTextSoFar: string, rawEvent: unknown) => void;
  signal?: AbortSignal;
};

function readBearerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function parseHttpErrorBody(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const detailRaw =
      (typeof data.detail === 'string' ? data.detail : null) ||
      (typeof data.title === 'string' ? data.title : null) ||
      (typeof data.message === 'string' ? data.message : null) ||
      (typeof data.error === 'string' ? data.error : null);
    if (detailRaw?.trim()) return detailRaw.trim();
    const code =
      (typeof data.errorCode === 'string' ? data.errorCode : null) ||
      (typeof data.code === 'string' ? data.code : null);
    if (code?.trim()) return `${code.trim()}${detailRaw?.trim() ? `: ${detailRaw.trim()}` : ''}`;
  } catch {
    /* not JSON */
  }
  const t = raw.trim();
  if (t) return t.slice(0, 500);
  return `HTTP ${response.status}`;
}

/** True when JSON looks like a full Visual QA session envelope from the backend. */
function isSessionEnvelope(obj: Record<string, unknown>): boolean {
  const hasSession =
    typeof obj.sessionId === 'string' ||
    typeof obj.SessionId === 'string' ||
    typeof obj.visualQaSessionId === 'string';
  const hasTurns = Array.isArray(obj.turns) || Array.isArray(obj.Turns);
  const hasLatest = obj.latest != null || obj.Latest != null;
  return hasSession || hasTurns || hasLatest;
}

function tryNormalizeSessionPayload(obj: unknown): VisualQaSessionReport | null {
  if (!obj || typeof obj !== 'object') return null;
  try {
    const report = normalizeVisualQaSessionReport(obj);
    if (report.sessionId?.trim() || report.turns.length > 0 || report.latest) return report;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Applies one SSE JSON payload: append/replace streaming text or return a full session report.
 */
function applyStreamJsonEvent(
  accumulatedText: string,
  parsed: unknown,
): { accumulatedText: string; sessionReport: VisualQaSessionReport | null } {
  if (parsed === null || parsed === undefined) {
    return { accumulatedText, sessionReport: null };
  }

  if (typeof parsed === 'string') {
    return { accumulatedText: accumulatedText + parsed, sessionReport: null };
  }

  if (typeof parsed !== 'object') {
    return { accumulatedText, sessionReport: null };
  }

  const o = parsed as Record<string, unknown>;

  if (typeof o.error === 'string' && o.error.trim()) {
    throw new Error(o.error.trim());
  }

  if (isSessionEnvelope(o)) {
    const report = tryNormalizeSessionPayload(parsed);
    if (report) {
      const latestAnswer = report.latest?.answerText?.trim() ?? '';
      const nextAcc = latestAnswer || accumulatedText;
      return { accumulatedText: nextAcc, sessionReport: report };
    }
  }

  let append = '';
  if (typeof o.delta === 'string') append = o.delta;
  else if (typeof o.answerTextDelta === 'string') append = o.answerTextDelta;
  else if (typeof o.chunk === 'string') append = o.chunk;
  else if (typeof o.content === 'string') append = o.content;
  else if (typeof o.text === 'string') append = o.text;

  if (typeof o.answerText === 'string') {
    return { accumulatedText: o.answerText, sessionReport: null };
  }

  if (append) {
    return { accumulatedText: accumulatedText + append, sessionReport: null };
  }

  const nested = o.data ?? o.payload;
  if (nested && typeof nested === 'object') {
    return applyStreamJsonEvent(accumulatedText, nested);
  }

  return { accumulatedText, sessionReport: null };
}

export class VisualQaStreamPartialDisconnectError extends Error {
  readonly code = 'VISUAL_QA_STREAM_PARTIAL_DISCONNECT' as const;
  constructor() {
    super('VISUAL_QA_STREAM_PARTIAL_DISCONNECT');
    this.name = 'VisualQaStreamPartialDisconnectError';
  }
}

function isFetchStreamDisconnectError(err: unknown): boolean {
  if (err === null || err === undefined || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'AbortError') return true;
  if (e.name === 'NetworkError') return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /network error|failed to fetch|load failed|networkerror/i.test(msg);
}

function parseSseLine(line: string): unknown | null {
  const trimmed = line.replace(/\r$/, '').trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trimStart();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export async function askVisualQaStream(
  file: File | null | undefined,
  questionText: string,
  options: AskVisualQaStreamOptions = {},
): Promise<VisualQaSessionReport> {
  const origin = getPublicApiOrigin();
  if (!origin) {
    throw new Error(
      'API origin is not configured. Set NEXT_PUBLIC_API_URL (see web/.env.example).',
    );
  }

  const form = buildVisualQaFormData(file, questionText, options);
  const token = readBearerToken();

  const headers = new Headers({
    Accept: 'text/event-stream',
    'Accept-Language': getClientAcceptLanguageHeader(),
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = `${origin.replace(/\/+$/, '')}/api/student/visual-qa/ask-stream`;

  const response = await fetch(url, {
    method: 'POST',
    body: form,
    headers,
    signal: options.signal,
    credentials: 'omit',
    cache: 'no-store',
  });

  if (!response.ok) {
    const msg = await parseHttpErrorBody(response);
    throw new Error(msg);
  }

  options.onUploadProgress?.(100);

  const body = response.body;
  if (!body) {
    throw new Error('Empty response body from ask-stream.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let accumulatedAssistantText = '';
  let lastReport: VisualQaSessionReport | null = null;
  let streamDisconnected = false;

  try {
    readLoop: for (;;) {
      try {
        const { done, value } = await reader.read();
        if (done) break readLoop;
        lineBuffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = lineBuffer.indexOf('\n')) >= 0) {
          const rawLine = lineBuffer.slice(0, newlineIdx);
          lineBuffer = lineBuffer.slice(newlineIdx + 1);
          const parsed = parseSseLine(rawLine);
          if (parsed === null) continue;

          const { accumulatedText, sessionReport } = applyStreamJsonEvent(accumulatedAssistantText, parsed);
          accumulatedAssistantText = accumulatedText;
          if (sessionReport) lastReport = sessionReport;

          options.onAssistantTextDelta?.(accumulatedAssistantText, parsed);
        }
      } catch (readErr) {
        if (!isFetchStreamDisconnectError(readErr)) throw readErr;
        streamDisconnected = true;
        toast.error('Mất kết nối mạng. AI tạm ngừng phân tích.');
        break readLoop;
      }
    }

    if (!streamDisconnected) {
      const tail = lineBuffer.trimEnd();
      if (tail) {
        const parsed = parseSseLine(tail);
        if (parsed !== null) {
          const { accumulatedText, sessionReport } = applyStreamJsonEvent(accumulatedAssistantText, parsed);
          accumulatedAssistantText = accumulatedText;
          if (sessionReport) lastReport = sessionReport;
          options.onAssistantTextDelta?.(accumulatedAssistantText, parsed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (streamDisconnected) {
    const sid = lastReport?.sessionId?.trim();
    if (sid) {
      try {
        const reconciled = await fetchStudentVisualQaSession(sid);
        return reconciled;
      } catch {
        if (lastReport) return lastReport;
      }
    }
    if (lastReport) return lastReport;
    throw new VisualQaStreamPartialDisconnectError();
  }

  const sid = lastReport?.sessionId?.trim();
  if (sid) {
    try {
      const reconciled = await fetchStudentVisualQaSession(sid);
      return reconciled;
    } catch {
      if (lastReport) return lastReport;
    }
  }

  if (lastReport) return lastReport;

  throw new Error('Stream ended without a Visual QA session payload.');
}

/**
 * Ask the lecturer/expert pipeline to review a completed turn.
 * When `turnId` is set, it must be the **assistant (AI) message id** for that turn (BE route segment).
 */
export async function requestStudentVisualQaReview(
  sessionId: string,
  turnId?: string | null,
): Promise<VisualQaSessionReport> {
  const id = sessionId.trim();
  if (!id) throw new Error('Session id is required.');
  try {
    if (turnId?.trim()) {
      try {
        const { data } = await http.post<unknown>(
          `/api/student/visual-qa/turns/${encodeURIComponent(turnId.trim())}/request-review`,
          undefined,
          { params: { sessionId: id }, clearSessionOn401: false },
        );
        const payload = unwrapVisualQaPayload(data);
        return normalizeVisualQaSessionReport(payload);
      } catch (e) {
        if (!(axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 405))) {
          throw e;
        }
      }
    }

    const { data } = await http.post<unknown>(
      `/api/student/visual-qa/${encodeURIComponent(id)}/request-review`,
      undefined,
      { clearSessionOn401: false },
    );
    const payload = unwrapVisualQaPayload(data);
    return normalizeVisualQaSessionReport(payload);
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw e;
    }
    throw new Error(getApiErrorMessage(e));
  }
}

/** @deprecated Prefer `fetchVisualQaThread` from `@/lib/api/visual-qa`. */
export async function fetchStudentVisualQaSession(
  sessionId: string,
): Promise<VisualQaSessionReport> {
  const { fetchVisualQaThread } = await import('@/lib/api/visual-qa/history');
  return fetchVisualQaThread(sessionId);
}
