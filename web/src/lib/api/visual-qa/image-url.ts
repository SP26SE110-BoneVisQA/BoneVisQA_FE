import { resolveApiAssetUrl, getPublicApiOrigin } from '@/lib/api/client';

/** Legacy BE rows still point at local dev — never load these in production. */
export function isBrokenLegacyImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return /localhost:(5046|5047)/i.test(url);
}

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Resolve a study / session image for the DICOM viewer.
 * Returns `undefined` when missing or legacy localhost — caller shows placeholder.
 *
 * Supabase / CDN absolute URLs are used as-is. Relative `/uploads/...` paths are only
 * prefixed with the configured API origin (never dev localhost fallback in production).
 */
export function resolveStudyImageSrc(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (isBrokenLegacyImageUrl(trimmed)) return undefined;
  if (isAbsoluteHttpUrl(trimmed)) return trimmed;

  const origin = getPublicApiOrigin();
  if (!origin || isBrokenLegacyImageUrl(origin)) return undefined;

  const resolved = resolveApiAssetUrl(trimmed);
  if (!resolved || isBrokenLegacyImageUrl(resolved)) return undefined;
  return resolved;
}
