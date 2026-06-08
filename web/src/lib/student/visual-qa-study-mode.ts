import type { VisualQaCapabilities, VisualQaStudyMode, VisualQaSessionHistoryItem } from '@/lib/api/visual-qa/types';
import type { VisualQaFlow } from '@/features/visual-qa/store/visual-qa-store';

export function normalizeVisualQaStudyMode(raw: unknown): VisualQaStudyMode | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'catalog_case_study' || value === 'catalog' || value === 'case_study') {
    return 'catalog_case_study';
  }
  if (value === 'personal_dicom' || value === 'personal' || value === 'dicom') {
    return 'personal_dicom';
  }
  return null;
}

export function isCatalogCaseStudyMode(
  capabilities?: VisualQaCapabilities | null,
  flow?: VisualQaFlow,
): boolean {
  const studyMode = normalizeVisualQaStudyMode(capabilities?.studyMode);
  if (studyMode === 'catalog_case_study') return true;
  if (studyMode === 'personal_dicom') return false;
  return flow === 'catalog';
}

export function inferStudyModeFromHistoryItem(
  row: Pick<VisualQaSessionHistoryItem, 'studyMode' | 'caseId'>,
): VisualQaStudyMode {
  const explicit = normalizeVisualQaStudyMode(row.studyMode);
  if (explicit) return explicit;
  return row.caseId?.trim() ? 'catalog_case_study' : 'personal_dicom';
}

export function studyModeShortLabel(mode: VisualQaStudyMode): string {
  return mode === 'catalog_case_study' ? 'Case study' : 'DICOM upload';
}

export function studyModeBadgeClass(mode: VisualQaStudyMode): string {
  return mode === 'catalog_case_study'
    ? 'border-violet-200 bg-violet-50 text-violet-800'
    : 'border-sky-200 bg-sky-50 text-sky-800';
}

export const VISUAL_QA_PERSONAL_WORKSPACE_PATH = '/student/visual-qa/workspace';
export const VISUAL_QA_CASE_WORKSPACE_PATH = '/student/visual-qa/case-workspace';

export function getVisualQaWorkspaceBasePath(mode: VisualQaStudyMode): string {
  return mode === 'catalog_case_study'
    ? VISUAL_QA_CASE_WORKSPACE_PATH
    : VISUAL_QA_PERSONAL_WORKSPACE_PATH;
}

export function buildCaseWorkspaceHref(caseId: string, sessionId?: string | null): string {
  const params = new URLSearchParams({ caseId: caseId.trim() });
  const sid = sessionId?.trim();
  if (sid) params.set('sessionId', sid);
  return `${VISUAL_QA_CASE_WORKSPACE_PATH}?${params.toString()}`;
}

export function buildPersonalWorkspaceHref(sessionId?: string | null): string {
  const sid = sessionId?.trim();
  if (!sid) return VISUAL_QA_PERSONAL_WORKSPACE_PATH;
  const params = new URLSearchParams({ sessionId: sid, flow: 'personal' });
  return `${VISUAL_QA_PERSONAL_WORKSPACE_PATH}?${params.toString()}`;
}

/** Build workspace deep-link for a history row (catalog vs personal). */
export function buildWorkspaceHrefForHistoryItem(
  row: Pick<VisualQaSessionHistoryItem, 'sessionId' | 'caseId' | 'studyMode'>,
): string {
  const sessionId = row.sessionId.trim();
  const mode = inferStudyModeFromHistoryItem(row);
  const base = getVisualQaWorkspaceBasePath(mode);
  const params = new URLSearchParams({ sessionId });
  if (mode === 'personal_dicom') params.set('flow', 'personal');
  const caseId = row.caseId?.trim();
  if (caseId) params.set('caseId', caseId);
  return `${base}?${params.toString()}`;
}
