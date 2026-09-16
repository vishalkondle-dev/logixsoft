const DURATION_REGEX = /^(\d+)\s*(ms|s|m|h|d|w)$/i;

const DURATION_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parses a human-readable duration string into milliseconds.
 *
 * @param duration - Duration string (e.g. '30s', '15m', '2h', '7d', '1w')
 *
 * @example
 * ```ts
 * parseDuration('10s') // -> 10000
 * parseDuration('15m') // -> 900000
 * parseDuration('2h')  // -> 7200000
 * parseDuration('7d')  // -> 604800000
 * ```
 */
export function parseDuration(duration: string): number {
  if (!duration) return 0;

  const match = duration.trim().match(DURATION_REGEX);
  if (!match) {
    const num = Number(duration);
    return isNaN(num) ? 0 : num;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = DURATION_MULTIPLIERS[unit] ?? 1000;

  return value * multiplier;
}

/**
 * Checks if a date or timestamp has expired (is in the past).
 *
 * @param date - Date object, ISO string, or epoch timestamp
 *
 * @example
 * ```ts
 * isExpired(token.expiresAt) // -> true / false
 * ```
 */
export function isExpired(date: Date | string | number): boolean {
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return isNaN(timestamp) || timestamp < Date.now();
}

/**
 * Adds a duration (in ms or string like '15m') to a base date.
 *
 * @param date - Base date (defaults to current date)
 * @param duration - Duration string or millisecond count
 *
 * @example
 * ```ts
 * addDuration(new Date(), '15m') // -> Date 15 minutes from now
 * ```
 */
export function addDuration(date: Date | string | number = new Date(), duration: string | number): Date {
  const baseTime = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const ms = typeof duration === 'number' ? duration : parseDuration(duration);
  return new Date(baseTime + ms);
}

/**
 * Formats a date into a human-friendly relative time string (e.g. 'just now', '5 minutes ago').
 *
 * @param date - Date, ISO string, or timestamp
 *
 * @example
 * ```ts
 * formatRelativeTime(new Date(Date.now() - 120_000)) // -> "2 minutes ago"
 * formatRelativeTime(new Date(Date.now() + 300_000)) // -> "in 5 minutes"
 * ```
 */
export function formatRelativeTime(date: Date | string | number): string {
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (isNaN(timestamp)) return '';

  const now = Date.now();
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const absDiff = Math.abs(diffSeconds);

  if (absDiff < 45) {
    return 'just now';
  }

  const minutes = Math.round(absDiff / 60);
  const hours = Math.round(absDiff / 3600);
  const days = Math.round(absDiff / 86400);

  const isPast = diffSeconds < 0;

  if (minutes < 60) {
    const text = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    return isPast ? `${text} ago` : `in ${text}`;
  }

  if (hours < 24) {
    const text = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return isPast ? `${text} ago` : `in ${text}`;
  }

  if (days < 30) {
    const text = `${days} ${days === 1 ? 'day' : 'days'}`;
    return isPast ? `${text} ago` : `in ${text}`;
  }

  // Fallback to standard formatted date for older timestamps
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calculates start of day (00:00:00.000) for a date in a specified timezone.
 * Defaults to Indian Standard Time (Asia/Kolkata).
 *
 * @param date - Base date (defaults to current date)
 * @param timezone - IANA timezone (default: 'Asia/Kolkata')
 */
export function getStartOfDay(date: Date | string | number = new Date(), timezone = 'Asia/Kolkata'): Date {
  const target = date instanceof Date ? date : new Date(date);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(target);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  // Create date at midnight in target timezone
  const offsetString = timezone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  return new Date(`${year}-${month}-${day}T00:00:00.000${offsetString}`);
}

/**
 * Calculates end of day (23:59:59.999) for a date in a specified timezone.
 * Defaults to Indian Standard Time (Asia/Kolkata).
 *
 * @param date - Base date (defaults to current date)
 * @param timezone - IANA timezone (default: 'Asia/Kolkata')
 */
export function getEndOfDay(date: Date | string | number = new Date(), timezone = 'Asia/Kolkata'): Date {
  const target = date instanceof Date ? date : new Date(date);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(target);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const offsetString = timezone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  return new Date(`${year}-${month}-${day}T23:59:59.999${offsetString}`);
}
