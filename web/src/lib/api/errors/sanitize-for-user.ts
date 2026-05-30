/**
 * ASP.NET / EF Core often returns ProblemDetails with a multi-line LINQ translation error.
 * End users should not see DbSet / Where stack text in toasts — the fix belongs in the API.
 */
export function sanitizeForUserToast(raw: string): string {
  let s = raw.trim();
  if (!s) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  s = s.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    '',
  );
  s = s.replace(/\b[0-9a-f]{32}\b/gi, '');
  s = s.replace(/\/[^\s]+\.(cs|dll)(:\d+)?\b/gi, '');
  s = s.replace(/\bat\s+[^\n]+(?:line\s+\d+)?/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length > 220) s = `${s.slice(0, 217)}…`;
  if (!s || /^[\s.,;:]+$/.test(s)) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  return s;
}

export function looksLikeTechnicalErrorMessage(message: string): boolean {
  const s = message.trim();
  if (!s || s.length > 220) return true;
  return /exception|stack|trace|LINQ|SqlClient|DbUpdate|System\.|Microsoft\.|timeout of \d+ms/i.test(s);
}
