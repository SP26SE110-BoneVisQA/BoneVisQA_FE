import { shouldSuppressLeakedMedicalJsonMarkdown } from '@/components/student/VisualQaRichAnswer';
import type { VisualQaTurn } from '@/lib/api/types';
import { formatReviewFeedbackDisplay } from '@/lib/student/visual-qa-feedback';

export type EducatorFeedbackRole = 'lecturer' | 'expert';

export type EducatorFeedbackEntry = {
  role: EducatorFeedbackRole;
  content: string;
};

/** Detect AI structured answer text mistakenly shown as educator feedback. */
export function looksLikeAiStructuredLeak(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return true;
  if (shouldSuppressLeakedMedicalJsonMarkdown(trimmed)) return true;

  const hasDiagnosis = /^Diagnosis:\s/im.test(trimmed);
  const hasFindings = /^Findings:\s/im.test(trimmed) || /\nFindings:\s*•/im.test(trimmed);
  const hasDifferential = /^Differential:\s/im.test(trimmed);

  if (hasDiagnosis && (hasFindings || hasDifferential)) return true;
  if (hasFindings && hasDifferential) return true;
  if (hasDiagnosis && trimmed.length < 280 && trimmed.includes('?')) return true;

  return false;
}

function normalizeEducatorRole(role: string | null | undefined): EducatorFeedbackRole {
  const normalized = role?.trim().toLowerCase() ?? '';
  if (normalized === 'expert' || normalized.includes('expert')) return 'expert';
  return 'lecturer';
}

function pushUniqueEntry(entries: EducatorFeedbackEntry[], role: EducatorFeedbackRole, raw: string): void {
  const content = formatReviewFeedbackDisplay(raw);
  if (!content || looksLikeAiStructuredLeak(content)) return;
  const key = content.toLowerCase();
  if (entries.some((entry) => entry.content.toLowerCase() === key)) return;
  entries.push({ role, content });
}

type ReviewerNote = {
  role: string;
  content: string;
};

/**
 * Human educator feedback only — excludes AI LMM structured fields and review_update leaks.
 */
export function extractEducatorFeedbackForTurn(
  reviewerNotes: ReviewerNote[],
  reviewUpdateText: string | null | undefined,
  resolvedExpertMessage: string | null | undefined,
): EducatorFeedbackEntry[] {
  const entries: EducatorFeedbackEntry[] = [];

  for (const note of reviewerNotes) {
    pushUniqueEntry(entries, normalizeEducatorRole(note.role), note.content);
  }

  if (reviewUpdateText?.trim()) {
    pushUniqueEntry(entries, 'lecturer', reviewUpdateText);
  }

  if (resolvedExpertMessage?.trim()) {
    pushUniqueEntry(entries, 'expert', resolvedExpertMessage);
  }

  return entries;
}

export function shouldShowEducatorFeedback(
  isAwaitingReview: boolean,
  entries: EducatorFeedbackEntry[],
): boolean {
  return !isAwaitingReview && entries.length > 0;
}

export function extractEducatorFeedbackFromTurnMessages(turn: VisualQaTurn): EducatorFeedbackEntry[] {
  const notes =
    turn.messages
      ?.filter((message) => message.content?.trim())
      .map((message) => ({
        role: (message.role ?? '').toLowerCase(),
        content: message.content.trim(),
      }))
      .filter((message) => message.role === 'lecturer' || message.role === 'expert') ?? [];

  return extractEducatorFeedbackForTurn(notes, null, null);
}
