import type {
  VisualQaCitation,
  VisualQaResponseKind,
  VisualQaReviewState,
  VisualQaSessionReport,
  VisualQaTurn,
} from '@/lib/api/types';
import type { VisualQaDicomMetadata } from '@/lib/api/visual-qa/dicom-metadata';

/** BE `VisualQaCapabilitiesDto` — mirrored on session/thread/ask-json responses. */
export interface VisualQaCapabilities {
  canAskNext?: boolean;
  canRequestReview?: boolean;
  isReadOnly?: boolean;
  turnsUsed?: number;
  turnLimit?: number;
  reason?: string | null;
}

/** `POST /api/student/visual-qa/ask-json` request (`VisualQARequestDto`). */
export interface VisualQaAskJsonRequest {
  questionText: string;
  caseId?: string | null;
  sessionId?: string | null;
  coordinates?: string | null;
  annotationId?: string | null;
  imageId?: string | null;
  clientRequestId?: string | null;
  /** Optional round-trip; BE loads from `case_media` when omitted. */
  dicomMetadata?: VisualQaDicomMetadata | null;
}

export type VisualQaLocale = 'vi' | 'en';

export interface VisualQaAskJsonOptions {
  locale?: VisualQaLocale;
  /** Suppress global interceptor toast — chat layer handles session blocks inline. */
  skipApiToast?: boolean;
}

/**
 * Normalized `POST ask-json` response (`VisualQaApiResponseDto`).
 * Same shape as thread hydrate; use `VisualQaSessionReport` for UI/store.
 */
export type VisualQaAskJsonResponse = VisualQaSessionReport & {
  isPersonalUpload?: boolean;
  policyReason?: string | null;
  systemNotice?: string | null;
  responseKind?: VisualQaResponseKind | null;
  reviewState?: VisualQaReviewState | null;
  lastResponderRole?: string | null;
  diagnosis?: string;
  findings?: string[];
  differentialDiagnoses?: string[];
  reflectiveQuestions?: string[];
  citations?: VisualQaCitation[];
  capabilities?: VisualQaCapabilities;
  latestTurn?: VisualQaTurn | null;
};

/** `GET /api/student/visual-qa/history/personal` list row (`VisualQaSessionHistoryItemDto`). */
export interface VisualQaSessionHistoryItem {
  sessionId: string;
  caseId?: string | null;
  status: string;
  sessionStatus: string;
  updatedAt?: string | null;
  questionSnippet?: string | null;
  imageUrl?: string | null;
  reviewState?: string | null;
  lastResponderRole?: string | null;
  rejectionReason?: string | null;
}

export interface VisualQaPersonalHistoryResult {
  totalCount: number;
  items: VisualQaSessionHistoryItem[];
}

/** `POST /api/student/visual-qa/upload-personal` success / failure body. */
export interface VisualQaUploadPersonalResponse {
  sessionId?: string;
  caseId?: string;
  mediaId?: string | null;
  catalogImageId?: string | null;
  previewImageUrl?: string;
  dicomMetadata?: VisualQaDicomMetadata | null;
  ingestOk: boolean;
  ingestError?: string | null;
}

export interface VisualQaUploadPersonalOptions {
  diagnosisText?: string | null;
  onUploadProgress?: (percent: number) => void;
  skipApiToast?: boolean;
}

/** `GET /api/student/visual-qa/history/{sessionId}` (`VisualQaThreadDto`). */
export type VisualQaThreadResponse = VisualQaSessionReport & {
  /** BE alias — same value as `sessionImageUrl`; normalized in `hydrateThread`. */
  imageUrl?: string | null;
  studyImageUrl?: string | null;
};

export interface VisualQaHistoryListParams {
  limit?: number;
  offset?: number;
}
