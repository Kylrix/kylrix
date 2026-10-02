/**
 * Kylrix Turso / libSQL Sync Bridge & Migration Controller
 *
 * Manages the graceful transition from Appwrite to Turso and Better Auth.
 * Enables zero-downtime, local-first data mirroring where local IndexedDB
 * retains ground truth and selectively targets Appwrite or Turso.
 */

export type SyncTarget = 'turso' | 'appwrite';
export type AuthProvider = 'better_auth' | 'appwrite';

const SYNC_TARGET_KEY = 'kylrix:sync_target';
const AUTH_PROVIDER_KEY = 'kylrix:auth_provider';

/**
 * Returns the active sync destination for the local client.
 * Defaults to 'turso' if migration has commenced, otherwise respects local marker.
 */
export function getActiveSyncTarget(): SyncTarget {
  if (typeof window === 'undefined') return 'appwrite';
  const saved = localStorage.getItem(SYNC_TARGET_KEY) as SyncTarget | null;
  if (saved === 'turso' || saved === 'appwrite') return saved;
  // Default to Turso if environment indicates Turso migration, otherwise default to Appwrite
  return process.env.NEXT_PUBLIC_DATABASE_PROVIDER === 'turso' ? 'turso' : 'appwrite';
}

/**
 * Sets the client sync target marker.
 */
export function setActiveSyncTarget(target: SyncTarget): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_TARGET_KEY, target);
  window.dispatchEvent(new CustomEvent('kylrix:sync-target-changed', { detail: target }));
}

/**
 * Returns whether the active session uses Better Auth.
 */
export function isBetterAuthActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_PROVIDER_KEY) === 'better_auth';
}

/**
 * Activates Better Auth as the primary client auth gate.
 */
export function setBetterAuthActive(active = true): void {
  if (typeof window === 'undefined') return;
  if (active) {
    localStorage.setItem(AUTH_PROVIDER_KEY, 'better_auth');
    localStorage.setItem(SYNC_TARGET_KEY, 'turso');
  } else {
    localStorage.removeItem(AUTH_PROVIDER_KEY);
  }
}
