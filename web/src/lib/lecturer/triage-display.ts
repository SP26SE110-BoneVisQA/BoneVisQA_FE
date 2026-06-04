import type { LectStudentQuestionDto, LecturerTriageRequestKind } from '@/lib/api/types';

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeRawGuid(value: string): boolean {
  const trimmed = value.trim();
  return GUID_PATTERN.test(trimmed) || /^Ingested case\s+[0-9a-f-]+/i.test(trimmed);
}

export function triageRequestKindFromItem(item: LectStudentQuestionDto): LecturerTriageRequestKind {
  return item.caseId != null && item.caseId.trim() !== '' ? 'case-catalog' : 'adhoc-upload';
}

export function formatTriageCaseLabel(item: LectStudentQuestionDto): string | null {
  const title = item.caseTitle?.trim() ?? '';
  if (title && !looksLikeRawGuid(title)) return title;

  if (triageRequestKindFromItem(item) === 'adhoc-upload') {
    const meta = item.dicomMetadata;
    const parts = [meta?.modality?.trim(), meta?.bodyPartExamined?.trim()].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
    return 'Personal Upload';
  }

  if (item.caseId?.trim()) {
    return `Case #${item.caseId.slice(0, 8).toUpperCase().replace(/-/g, '')}`;
  }

  return null;
}

export function formatTriageSubmittedAt(item: LectStudentQuestionDto): string | null {
  const raw = item.createdAt?.trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB');
}

export function triageHistoryStatusLabel(item: LectStudentQuestionDto): string {
  const status = (item.answerStatus ?? '').trim().toLowerCase();
  if (status.includes('reject')) return 'Rejected';
  if (status.includes('approv') || status.includes('escalat') || status.includes('review')) {
    return 'Approved';
  }
  return item.answerStatus?.trim() || 'Resolved';
}
