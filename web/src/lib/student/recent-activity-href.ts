import type { StudentRecentActivityItem } from '@/lib/api/types';
import {
  buildCaseWorkspaceHref,
  buildPersonalWorkspaceHref,
} from '@/lib/student/visual-qa-study-mode';

/** Normalize backend shortcuts that omit the `/student` prefix. */
function normalizeAppPath(path: string): string {
  const p = path.split('?')[0] || path;
  if (p === '/assignments') return '/student/assignments';
  if (p === '/analytics') return '/student/analytics';
  if (p.startsWith('/assignments/')) return `/student${p}`;
  if (p.startsWith('/analytics/')) return `/student${p}`;
  return path;
}

/**
 * Resolves where a dashboard recent-activity row should navigate.
 * Uses API `targetUrl` when safe; otherwise maps `type` + optional ids to student routes.
 */
export function resolveStudentRecentActivityHref(activity: StudentRecentActivityItem): string {
  const raw = (activity.route ?? activity.targetUrl)?.trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const path = `${u.pathname}${u.search}`;
        return normalizeAppPath(path);
      } catch {
        return raw;
      }
    }
    if (raw.startsWith('/')) {
      return normalizeAppPath(raw);
    }
  }

  const t = activity.type?.trim().toLowerCase() ?? '';
  const sid = activity.sessionId?.trim();

  const caseId = activity.caseId?.trim();

  if (t === 'visual_qa' || t === 'visual_qa_lecturer_reply' || t.includes('visual_qa')) {
    if (sid && caseId) return buildCaseWorkspaceHref(caseId, sid);
    if (sid) return buildPersonalWorkspaceHref(sid);
    return caseId ? buildCaseWorkspaceHref(caseId) : buildPersonalWorkspaceHref();
  }
  const quizId = activity.quizId?.trim();

  if (t.includes('quiz') || t.includes('attempt')) {
    return quizId ? `/student/quiz/${encodeURIComponent(quizId)}` : '/student/quiz';
  }

  if (t.includes('catalog') || t === 'case_viewed' || (t.includes('library') && t.includes('case'))) {
    return caseId ? `/student/cases/${encodeURIComponent(caseId)}` : '/student/catalog';
  }

  if (
    t.includes('upload') ||
    t.includes('visual') ||
    t.includes('custom') ||
    t === 'question_asked' ||
    (t.includes('question') && !t.includes('quiz'))
  ) {
    return '/student/history?tab=personal';
  }

  if (t.includes('case_study') || t.includes('expert_case') || (t.includes('case') && !t.includes('upload'))) {
    return caseId ? `/student/cases/${encodeURIComponent(caseId)}` : '/student/history?tab=cases';
  }

  return '/student/history';
}
