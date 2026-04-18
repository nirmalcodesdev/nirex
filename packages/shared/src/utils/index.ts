/**
 * Utilities
 *
 * Pure utility functions with no framework dependencies.
 * Can be used in any JavaScript/TypeScript environment.
 */

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Converts a string to URL-friendly slug
 * @example slugify('Hello World') => 'hello-world'
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncates a string to specified length with ellipsis
 * @example truncate('Hello World', 8) => 'Hello...'
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalizes first letter of a string
 * @example capitalize('hello') => 'Hello'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formats file size in human-readable format
 * @example formatFileSize(1536) => '1.5 KB'
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Masks sensitive data (email, phone, etc.)
 * @example maskSensitive('user@example.com') => 'u***@example.com'
 */
export function maskSensitive(str: string, visibleStart = 1, visibleEnd = 0): string {
  if (str.length <= visibleStart + visibleEnd) return str;

  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  const masked = '*'.repeat(str.length - visibleStart - visibleEnd);

  return start + masked + end;
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Formats date to locale string
 * @example formatDate(new Date()) => 'Jan 1, 2024'
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return d.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Formats date to relative time (e.g., "2 hours ago")
 * @example formatRelativeTime(Date.now() - 3600000) => '1 hour ago'
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale = 'en-US'
): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return rtf.format(-count, interval.label as Intl.RelativeTimeFormatUnit);
    }
  }

  return 'just now';
}

/**
 * Checks if a date is expired (past)
 */
export function isExpired(date: Date | string | number): boolean {
  return new Date(date).getTime() < Date.now();
}

/**
 * Adds time to a date
 * @example addTime(new Date(), 1, 'day')
 */
export function addTime(
  date: Date,
  amount: number,
  unit: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
): Date {
  const d = new Date(date);

  switch (unit) {
    case 'second':
      d.setSeconds(d.getSeconds() + amount);
      break;
    case 'minute':
      d.setMinutes(d.getMinutes() + amount);
      break;
    case 'hour':
      d.setHours(d.getHours() + amount);
      break;
    case 'day':
      d.setDate(d.getDate() + amount);
      break;
    case 'week':
      d.setDate(d.getDate() + amount * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() + amount);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + amount);
      break;
  }

  return d;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates email format
 * Simple regex for common email formats
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    // Use global URL constructor
    new (globalThis as any).URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates MongoDB ObjectId format
 * 24 character hex string
 */
export function isValidObjectId(id: string): boolean {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
}

/**
 * Validates UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================================================
// Array/Object Utilities
// ============================================================================

/**
 * Groups array items by key
 * @example groupBy([{type: 'a'}, {type: 'b'}, {type: 'a'}], 'type')
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    return {
      ...groups,
      [groupKey]: [...(groups[groupKey] || []), item],
    };
  }, {} as Record<string, T[]>);
}

/**
 * Removes duplicates from array
 * @example unique([1, 2, 2, 3]) => [1, 2, 3]
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Deep clones an object
 * Note: Does not handle circular references
 */
export function deepClone<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Picks specific keys from an object
 * @example pick({a: 1, b: 2, c: 3}, ['a', 'c']) => {a: 1, c: 3}
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omits specific keys from an object
 * @example omit({a: 1, b: 2, c: 3}, ['b']) => {a: 1, c: 3}
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete (result as any)[key];
  });
  return result;
}
