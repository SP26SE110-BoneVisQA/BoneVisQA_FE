/**
 * Next.js `router.push` expects an in-app path. API may return absolute URLs
 * or legacy route aliases — normalize to working FE routes.
 */
export function notificationTargetToAppPath(targetUrl: string): string {
  const t = targetUrl.trim();
  if (!t) return t;

  let path = t;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      path = `${u.pathname}${u.search}` || '/';
    } catch {
      return t;
    }
  } else if (!t.startsWith('/')) {
    path = `/${t}`;
  }

  return resolveNotificationRouteAlias(path);
}

/** Maps legacy / incomplete BE notification targets to canonical FE routes. */
function resolveNotificationRouteAlias(path: string): string {
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  const lower = pathname.toLowerCase();

  if (lower === '/student/qa' || lower === '/student/visual-qa' || lower === '/student/visual-qa/upload') {
    return appendQuery('/student/visual-qa/workspace', params);
  }

  if (lower === '/student/qa/image' || lower.startsWith('/student/visual-qa/session')) {
    const sessionId =
      params.get('sessionId')?.trim() ||
      params.get('id')?.trim() ||
      pathname.split('/').filter(Boolean).pop();
    if (sessionId) {
      const caseId = params.get('caseId')?.trim();
      const flow = params.get('flow')?.trim().toLowerCase();
      const isCaseStudy = Boolean(caseId) || flow === 'catalog' || flow === 'case_study';
      const base = isCaseStudy ? '/student/visual-qa/case-workspace' : '/student/visual-qa/workspace';
      const next = new URLSearchParams({ sessionId });
      if (!isCaseStudy) next.set('flow', flow || 'personal');
      if (caseId) next.set('caseId', caseId);
      return `${base}?${next.toString()}`;
    }
    return '/student/visual-qa/workspace';
  }

  if (lower === '/student/visual-qa/case-workspace') {
    return appendQuery('/student/visual-qa/case-workspace', params);
  }

  if (lower.startsWith('/student/cases/')) {
    const caseId = pathname.split('/').filter(Boolean).pop();
    if (caseId) return `/student/cases/${encodeURIComponent(caseId)}`;
  }

  if (lower === '/lecturer/qa' || lower === '/lecturer/triage' || lower === '/lecturer/visual-qa') {
    return appendQuery('/lecturer/qa-triage', params);
  }

  if (lower === '/expert/reviews' || lower.startsWith('/expert/review/')) {
    const focus =
      params.get('focus')?.trim() ||
      params.get('sessionId')?.trim() ||
      (lower.startsWith('/expert/review/') ? pathname.split('/').filter(Boolean).pop() : null);
    if (focus) return `/expert/reviews?focus=${encodeURIComponent(focus)}`;
    return '/expert/reviews';
  }

  if (lower === '/expert/cases' || lower.startsWith('/expert/case/')) {
    const caseId =
      params.get('caseId')?.trim() ||
      (lower.startsWith('/expert/case/') ? pathname.split('/').filter(Boolean).pop() : null);
    if (caseId) return `/expert/cases/${encodeURIComponent(caseId)}`;
    return '/expert/cases';
  }

  if (lower === '/admin/documents' || lower.startsWith('/admin/document/')) {
    const docId =
      params.get('documentId')?.trim() ||
      (lower.startsWith('/admin/document/') ? pathname.split('/').filter(Boolean).pop() : null);
    if (docId) return `/admin/documents/${encodeURIComponent(docId)}`;
    return '/admin/documents';
  }

  if (lower === '/student/assignments' || lower.startsWith('/assignments')) {
    return pathname.startsWith('/student') ? path : `/student${pathname}${search ? `?${search}` : ''}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function appendQuery(basePath: string, params: URLSearchParams): string {
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}
