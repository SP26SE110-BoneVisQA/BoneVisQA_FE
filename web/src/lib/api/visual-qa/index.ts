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
  validatePersonalStudyArchive,
} from '@/lib/api/visual-qa/upload-personal';

export {
  fetchVisualQaThread,
  fetchVisualQaCaseHistory,
  fetchVisualQaPersonalHistory,
} from '@/lib/api/visual-qa/history';

export type {
  VisualQaCapabilities,
  VisualQaAskJsonRequest,
  VisualQaAskJsonResponse,
  VisualQaAskJsonOptions,
  VisualQaUploadPersonalResponse,
  VisualQaUploadPersonalOptions,
  VisualQaThreadResponse,
  VisualQaHistoryListParams,
  VisualQaLocale,
} from '@/lib/api/visual-qa/types';
