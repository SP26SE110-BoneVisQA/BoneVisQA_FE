import axios from 'axios';
import { http, getApiErrorMessage } from '@/lib/api/client';
import { normalizeVisualQaSessionReport } from '@/lib/api/normalize-visual-qa';
import { serializeNormalizedBoundingBox } from '@/lib/utils/annotations';
import type { NormalizedImageBoundingBox } from '@/lib/api/types';
import type {
  VisualQaAskJsonOptions,
  VisualQaAskJsonRequest,
  VisualQaAskJsonResponse,
  VisualQaLocale,
} from '@/lib/api/visual-qa/types';
import { unwrapVisualQaPayload } from '@/lib/api/visual-qa/unwrap';

export type VisualQaAskJsonInput = VisualQaAskJsonRequest & {
  /** Normalized ROI — serialized to `coordinates` JSON string for BE. */
  roiBoundingBox?: NormalizedImageBoundingBox | null;
};

function buildAskJsonBody(input: VisualQaAskJsonInput): Record<string, unknown> {
  const questionText = input.questionText?.trim();
  if (!questionText) {
    throw new Error('questionText is required.');
  }

  const body: Record<string, unknown> = { questionText };

  const caseId = input.caseId?.trim();
  if (caseId) body.caseId = caseId;

  const sessionId = input.sessionId?.trim();
  if (sessionId) body.sessionId = sessionId;

  const coordinates =
    input.coordinates?.trim() ||
    serializeNormalizedBoundingBox(input.roiBoundingBox) ||
    null;
  if (coordinates) body.coordinates = coordinates;

  const annotationId = input.annotationId?.trim();
  if (annotationId) body.annotationId = annotationId;

  const imageId = input.imageId?.trim();
  if (imageId) body.imageId = imageId;

  const clientRequestId = input.clientRequestId?.trim();
  if (clientRequestId) body.clientRequestId = clientRequestId;

  if (input.dicomMetadata && typeof input.dicomMetadata === 'object') {
    body.dicomMetadata = input.dicomMetadata;
  }

  return body;
}

function resolveLocale(locale?: VisualQaLocale): VisualQaLocale {
  if (locale === 'vi' || locale === 'en') return locale;
  return 'en';
}

/**
 * Primary Visual QA chat endpoint — `POST /api/student/visual-qa/ask-json`.
 * @see FRONTEND_HANDOFF_REPORT §2.5
 */
export async function postVisualQaAskJson(
  input: VisualQaAskJsonInput,
  options: VisualQaAskJsonOptions = {},
): Promise<VisualQaAskJsonResponse> {
  const locale = resolveLocale(options.locale);
  const body = buildAskJsonBody(input);

  try {
    const { data } = await http.post<unknown>('/api/student/visual-qa/ask-json', body, {
      params: { locale },
      skipApiToast: options.skipApiToast ?? true,
    });
    const payload = unwrapVisualQaPayload(data);
    const report = normalizeVisualQaSessionReport(payload);
    return report as VisualQaAskJsonResponse;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw e;
    }
    throw new Error(getApiErrorMessage(e));
  }
}
