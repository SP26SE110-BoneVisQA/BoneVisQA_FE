/** BE sometimes wraps payloads as `{ data: T }`. */
export function unwrapVisualQaPayload(data: unknown): unknown {
  if (data && typeof data === 'object' && 'data' in (data as object)) {
    const nested = (data as { data: unknown }).data;
    if (nested !== undefined && nested !== null) return nested;
  }
  return data;
}
