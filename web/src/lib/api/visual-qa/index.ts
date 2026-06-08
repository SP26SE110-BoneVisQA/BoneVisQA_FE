export {
  postVisualQaAskJson,
  type VisualQaAskJsonInput,
} from '@/lib/api/visual-qa/ask-json';

export {
  normalizeDicomMetadata,
  mapDicomModalityToExpert,
  mapDicomAnatomyToExpert,
  dicomMetadataToDisplayRows,
  type VisualQaDicomMetadata,
  type DicomMetadataDisplayRow,
} from '@/lib/api/visual-qa/dicom-metadata';

export {
  postVisualQaUploadPersonal,
  postVisualQaUploadPersonal as uploadPersonalStudy,
  validatePersonalStudyArchive,
  MAX_STUDY_ARCHIVE_BYTES,
} from '@/lib/api/visual-qa/upload-personal';

export {
  isBrokenLegacyImageUrl,
  resolveStudyImageSrc,
} from '@/lib/api/visual-qa/image-url';

export { formatVisualQaUploadError } from '@/lib/api/visual-qa/upload-errors';

export {
  fetchVisualQaThread,
  fetchVisualQaCaseHistory,
  fetchVisualQaCaseHistoryNormalized,
  fetchVisualQaCombinedHistory,
  fetchVisualQaPersonalHistory,
} from '@/lib/api/visual-qa/history';

export { requestVisualQaReview } from '@/lib/api/visual-qa/request-review';

export type {
  VisualQaCapabilities,
  VisualQaAskJsonRequest,
  VisualQaAskJsonResponse,
  VisualQaAskJsonOptions,
  VisualQaUploadPersonalResponse,
  VisualQaUploadPersonalOptions,
  VisualQaThreadResponse,
  VisualQaHistoryListParams,
  VisualQaSessionHistoryItem,
  VisualQaPersonalHistoryResult,
  VisualQaStudyMode,
  VisualQaLocale,
} from '@/lib/api/visual-qa/types';
