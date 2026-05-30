import { shouldSuppressLeakedMedicalJsonMarkdown } from '@/components/student/VisualQaRichAnswer';
import { getWorkflowStatusMeta, normalizeWorkflowStatus } from '@/lib/visual-qa-workflow';

/** Human-readable review feedback — never show raw JSON blobs in UI. */
export function formatReviewFeedbackDisplay(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';

  if (shouldSuppressLeakedMedicalJsonMarkdown(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of [
        'reviewFeedback',
        'review_feedback',
        'message',
        'text',
        'note',
        'reviewNote',
        'reason',
        'content',
      ]) {
        const value = parsed[key];
        if (typeof value === 'string' && value.trim() && !shouldSuppressLeakedMedicalJsonMarkdown(value)) {
          return value.trim();
        }
      }
    } catch {
      return '';
    }
    return '';
  }

  return trimmed;
}

export function sessionAwaitingExpertReview(sessionStatus: string | null | undefined): boolean {
  const normalized = normalizeWorkflowStatus(sessionStatus);
  return normalized === 'PendingExpertReview' || normalized === 'EscalatedToExpert';
}

export function sessionReviewFeedbackTone(
  sessionStatus: string | null | undefined,
): 'success' | 'danger' | null {
  const meta = getWorkflowStatusMeta(sessionStatus);
  if (meta.tone === 'danger') return 'danger';
  if (meta.tone === 'success' && meta.terminal) return 'success';
  const normalized = normalizeWorkflowStatus(sessionStatus);
  if (normalized === 'LecturerApproved') return 'success';
  return null;
}

export function sessionReviewFeedbackLabel(sessionStatus: string | null | undefined): string {
  const meta = getWorkflowStatusMeta(sessionStatus);
  if (meta.tone === 'danger') return 'Review rejected';
  if (meta.tone === 'success' && meta.terminal) return 'Review approved';
  if (normalizeWorkflowStatus(sessionStatus) === 'LecturerApproved') return 'Lecturer feedback';
  return 'Expert feedback';
}
