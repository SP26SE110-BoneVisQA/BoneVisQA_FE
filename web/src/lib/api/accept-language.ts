/**
 * Default API language for system requests (English UI).
 * Visual QA ask/upload passes `locale` in the request body — not this header alone.
 */
export function getClientAcceptLanguageHeader(): string {
  return 'en-US,en;q=0.9';
}

/**
 * Accept-Language for Visual QA when the student is chatting in Vietnamese.
 */
export function getVisualQaAcceptLanguageHeader(locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    return 'vi-VN,vi;q=0.9,en;q=0.8';
  }
  return getClientAcceptLanguageHeader();
}
