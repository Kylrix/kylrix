/** Shared resume-route rules (middleware-safe — no browser APIs). */

const VALID_APP_PREFIXES = [
  '/app',
  '/vault',
  '/flows',
  '/goals',
  '/goal',
  '/forms',
  '/form',
  '/events',
  '/settings',
  '/billing',
  '/idea',
  '/agents',
  '/moment',
  '/u/',
];

export const LAST_ROUTE_COOKIE = 'kylrix_last_route';
export const DEFAULT_AUTHENTICATED_ROUTE = '/app';

export function isPublicResumePath(path: string): boolean {
  if (!path || path === '/' || path === '/landing') return true;
  return path.startsWith('/send') || path.startsWith('/p/');
}

export function isValidAppResumePath(path: string): boolean {
  if (!path || path === '/' || path === '/landing' || path.startsWith('/login') || path.startsWith('/connect')) {
    return false;
  }
  return VALID_APP_PREFIXES.some((prefix) => path.startsWith(prefix));
}
