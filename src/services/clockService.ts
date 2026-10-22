/**
 * Israel Local Time Clock Service
 * 
 * Provides a single source of truth for the current local calendar date and month
 * in Israel ('Asia/Jerusalem'), ensuring precision across month boundaries, year transitions,
 * and Daylight Saving Time (DST) switches.
 * 
 * Supports controlled clock injection (setClockOverride) for deterministic regression tests.
 */

let clockOverride: { dateStr: string; monthKey: string } | null = null;

/**
 * Validates strictly whether an input string is a valid calendar date in YYYY-MM-DD format.
 * Rejects invalid format or nonexistent dates like '2026-02-30' or '2026-04-31'.
 */
function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(str)) {
    return false;
  }
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Sets or clears a deterministic clock override.
 * Throws an Error if an invalid date string or nonexistent calendar date is passed.
 */
export function setClockOverride(isoDateStr: string | null): void {
  if (isoDateStr === null) {
    clockOverride = null;
    return;
  }

  if (typeof isoDateStr !== 'string' || !isValidIsoDate(isoDateStr.trim())) {
    throw new Error(
      `[ClockService] Invalid date for clock override: "${isoDateStr}". Expected valid YYYY-MM-DD.`
    );
  }

  const clean = isoDateStr.trim();
  clockOverride = {
    dateStr: clean,
    monthKey: clean.substring(0, 7),
  };
}

/**
 * Converts a Date instant into local Israel calendar components using Intl.DateTimeFormat
 * and formatToParts() without assuming specific string output formats.
 */
export function getIsraelLocalDateTime(baseDate: Date = new Date()): { dateStr: string; monthKey: string } {
  if (clockOverride) {
    return clockOverride;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(baseDate);
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '10';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  const dateStr = `${year}-${month}-${day}`;
  const monthKey = `${year}-${month}`;

  return { dateStr, monthKey };
}

/**
 * Returns current Israel local date in YYYY-MM-DD format.
 */
export function getCurrentAppDate(): string {
  return getIsraelLocalDateTime().dateStr;
}

/**
 * Returns current Israel local month key in YYYY-MM format.
 */
export function getCurrentAppMonthKey(): string {
  return getIsraelLocalDateTime().monthKey;
}
