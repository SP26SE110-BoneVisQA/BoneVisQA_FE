import { resolveApiAssetUrl } from '@/lib/api/client';

/** Legacy BE rows still point at local dev — never load these in production. */
export function isBrokenLegacyImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return /localhost:(5046|5047)/i.test(url);
}

/**
 * Resolve a study / session image for the DICOM viewer.
 * Returns `undefined` when missing or legacy localhost — caller shows placeholder.
 */
export function resolveStudyImageSrc(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const resolved = resolveApiAssetUrl(url);
  if (!resolved || isBrokenLegacyImageUrl(resolved)) return undefined;
  return resolved;
}
