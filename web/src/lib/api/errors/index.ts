export {
  getProblemReason,
  isVisualQaSessionErrorBody,
  parseApiErrorBody,
  parseAxiosErrorBody,
  isAxiosErrorWithStatus,
  type ParsedApiErrorBody,
  type ProblemDetailsPayload,
} from '@/lib/api/errors/problem-details';

export {
  getToastSpecForHttpStatus,
  getNetworkErrorToastSpec,
  getAccessDeniedWithoutLogoutToastSpec,
  getRoleAccessDeniedToastSpec,
  type ApiToastSpec,
  type ApiToastVariant,
} from '@/lib/api/errors/toast-messages.en';

export { appToast } from '@/lib/api/errors/app-toast';
export { showApiErrorToast, showAccessDeniedWithoutLogoutToast, showRoleAccessDeniedToast } from '@/lib/api/errors/show-api-error-toast';
export {
  sanitizeForUserToast,
  looksLikeTechnicalErrorMessage,
} from '@/lib/api/errors/sanitize-for-user';

/** @deprecated Use `appToast` — kept for incremental migration. */
export { appToast as toastVi } from '@/lib/api/errors/app-toast';
