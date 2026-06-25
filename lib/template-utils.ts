// lib/template-utils.ts

/**
 * Returns true if `today` falls within the [activeFrom, activeTo] MM-DD range.
 * If either is null/undefined, the template is always active.
 * Supports ranges that cross the new year (e.g. "12-20" → "01-05").
 *
 * @param activeFrom  "MM-DD" string or null
 * @param activeTo    "MM-DD" string or null
 * @param today       optional Date for testing; defaults to new Date()
 */
export function isTemplateActive(
  activeFrom: string | null | undefined,
  activeTo: string | null | undefined,
  today: Date = new Date()
): boolean {
  if (!activeFrom || !activeTo) return true;

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (activeFrom <= activeTo) {
    // Same-year range: e.g. "10-01" to "10-31"
    return todayStr >= activeFrom && todayStr <= activeTo;
  } else {
    // Crosses new year: e.g. "12-20" to "01-05"
    return todayStr >= activeFrom || todayStr <= activeTo;
  }
}
