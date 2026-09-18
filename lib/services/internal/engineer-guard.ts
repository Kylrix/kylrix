/**
 * Server-only engineer check utility.
 * Single source of truth: process.env.ENGINEERS (comma-separated email list).
 * Secure and never exposed client-side.
 */

export function isEmailInEngineerList(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;

  const engineerList = String(process.env.ENGINEERS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return engineerList.includes(normalized);
}

export function isEngineerUser(user?: { email?: string | null } | null): boolean {
  return isEmailInEngineerList(user?.email);
}

export function canExposeLiveErrorsForEmail(email?: string | null): boolean {
  // Always expose in dev mode
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  // In production, strictly require email to be listed in process.env.ENGINEERS
  return isEmailInEngineerList(email);
}

export function canExposeLiveErrorsForUser(user?: { email?: string | null } | null): boolean {
  return canExposeLiveErrorsForEmail(user?.email);
}
