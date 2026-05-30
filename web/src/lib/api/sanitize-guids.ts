/** RFC 4122 UUID (any version nibble in the third group). */
const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGuid(value: string | null | undefined): boolean {
  const v = value?.trim() ?? '';
  return v.length > 0 && GUID_RE.test(v);
}

/** Returns a trimmed GUID or `null` when empty / not a valid GUID (never `""`). */
export function sanitizeNullableGuid(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  if (!v) return null;
  return isValidGuid(v) ? v : null;
}

/** Filters tag/id arrays to valid GUIDs only. */
export function sanitizeGuidList(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values.map((id) => id?.trim()).filter((id): id is string => Boolean(id && isValidGuid(id)));
}
