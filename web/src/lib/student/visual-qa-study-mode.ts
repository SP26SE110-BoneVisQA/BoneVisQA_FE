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

/** Build workspace deep-link for a history row (catalog vs personal). */
export function buildWorkspaceHrefForHistoryItem(
  row: Pick<VisualQaSessionHistoryItem, 'sessionId' | 'caseId' | 'studyMode'>,
): string {
  const sessionId = row.sessionId.trim();
  const mode = inferStudyModeFromHistoryItem(row);
  const params = new URLSearchParams({ sessionId, flow: mode === 'catalog_case_study' ? 'catalog' : 'personal' });
  const caseId = row.caseId?.trim();
  if (caseId) params.set('caseId', caseId);
  return `/student/visual-qa/workspace?${params.toString()}`;
}
