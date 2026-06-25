// Accepts an ISO 8601 string, null, or undefined. Returns
// { ok: true, value } where value is a normalized ISO string or null,
// or { ok: false } when the input is not parseable.
export function parseActiveWindow(input: unknown): { ok: true; value: string | null } | { ok: false } {
  if (input === undefined || input === null || input === '') return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false };
  const t = Date.parse(input);
  if (Number.isNaN(t)) return { ok: false };
  return { ok: true, value: new Date(t).toISOString() };
}
