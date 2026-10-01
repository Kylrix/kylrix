import { ulid, monotonicFactory, decodeTime } from 'ulidx';

const monotonic = monotonicFactory();

/**
 * Generates a standard 26-character URL-safe, time-sortable ULID.
 * Lexicographically sortable by millisecond timestamp in SQLite/Turso B-Trees.
 */
export function generateId(): string {
  return ulid().toLowerCase();
}

/**
 * Generates a strictly monotonic ULID, guaranteed to sort chronologically
 * even when called multiple times within the exact same millisecond.
 */
export function generateMonotonicId(): string {
  return monotonic().toLowerCase();
}

/**
 * Alias for generateId() adhering to canonical ULID naming.
 */
export const newId = generateId;

/**
 * Validates whether a given string is a valid 26-character Crockford Base32 ULID.
 */
export function isUlid(id: string): boolean {
  if (typeof id !== 'string' || id.length !== 26) return false;
  return /^[0123456789abcdefghjkmnpqrstvwxyz]{26}$/i.test(id);
}

/**
 * Extracts the millisecond UNIX timestamp embedded in the ULID.
 */
export function getUlidTimestamp(id: string): number | null {
  try {
    return decodeTime(id);
  } catch {
    return null;
  }
}

/**
 * Composes a scoped identifier (e.g. for singleton workspace assets like hangout_${workspaceId}).
 */
export function createScopedId(scope: string, identifier?: string): string {
  const cleanScope = String(scope || '').trim().replace(/[^a-z0-9_-]/gi, '');
  const cleanId = String(identifier || generateId()).trim();
  return `${cleanScope}_${cleanId}`;
}
