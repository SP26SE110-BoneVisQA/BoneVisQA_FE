import type { VisualQaSessionReport } from '@/lib/api/types';
import {
  buildCaseWorkspaceHref,
  buildPersonalWorkspaceHref,
  VISUAL_QA_CASE_WORKSPACE_PATH,
  VISUAL_QA_PERSONAL_WORKSPACE_PATH,
} from '@/lib/student/visual-qa-study-mode';

/** BE returns 200 with `sessionExists: false` when the session was wiped or the URL is stale. */
export function isVisualQaThreadMissing(
  thread: Pick<VisualQaSessionReport, 'sessionExists'> | null | undefined,
): boolean {
  return thread?.sessionExists === false;
}

export function staleSessionNotice(
  thread: Pick<VisualQaSessionReport, 'blockingNotice' | 'systemNotice'> | null | undefined,
): string | null {
  const notice = thread?.blockingNotice?.trim() || thread?.systemNotice?.trim();
  return notice || 'This chat session is no longer available. Start a new study to continue.';
}

/** Strip `sessionId` from the workspace URL after a missing-thread response. */
export type VisualQaWorkspaceVariant = 'personal' | 'catalog';

export function buildWorkspaceHrefAfterStaleSession(options: {
  variant: VisualQaWorkspaceVariant;
  caseId?: string | null;
}): string {
  const caseId = options.caseId?.trim();
  if (options.variant === 'catalog') {
    return caseId ? buildCaseWorkspaceHref(caseId) : VISUAL_QA_CASE_WORKSPACE_PATH;
  }
  return buildPersonalWorkspaceHref();
}
