// Date-only strings from the backend ("2026-07-17") parse as UTC midnight in
// JavaScript, which is 7pm the *previous evening* in Jamaica (UTC-5).
// Formatting or comparing them without care shows every date one day early
// and marks today's sittings as "past".  Always go through these helpers for
// date-only fields (event_date, judgment date, week_of, …).

/** Parse a date-only string (optionally with a time part) as LOCAL midnight. */
export function parseDateOnly(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T00:00:00` : s);
}

/** Format a date-only string for display without the UTC day shift. */
export function formatDateOnly(
  s: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  if (!s) return fallback;
  return parseDateOnly(s).toLocaleDateString("en-JM", options);
}

/** Today's date in Jamaica as "YYYY-MM-DD" (en-CA locale formats ISO-style). */
export function todayJamaica(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
  }).format(new Date());
}

/** True when a date-only string falls before today on the Jamaica calendar. */
export function isPastDateOnly(s: string | null | undefined): boolean {
  if (!s) return true;
  return s.slice(0, 10) < todayJamaica();
}
