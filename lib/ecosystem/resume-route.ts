/** Shared resume-route rules (middleware-safe — no browser APIs). */

const PUBLIC_PREFIXES = [
  '/send',
  '/i/',
  '/app/shared',
  '/idea',
  '/u/',
  '/p/',
  '/call/',
  '/connect/call/',
  '/flow/form/',
  '/flow/goal/',
  '/flow/forms/',
  '/flow/events/',
];

const APP_PREFIXES = [
  '/app',
  '/vault',
  '/flow',
  '/connect',
  '/projects',
  '/settings',
  '/agents',
  '/accounts',
];

export const LAST_ROUTE_COOKIE = 'kylrix_last_route';
export const DEFAULT_AUTHENTICATED_ROUTE = '/connect/chats';
export const DEFAULT_GUEST_ROUTE = '/send';

export function isPublicResumePath(path: string): boolean {
  if (!path || path === '/') return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isValidAppResumePath(path: string): boolean {
  if (!path || path === '/' || isPublicResumePath(path)) return false;
  return APP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function resolveAuthenticatedEntryPath(lastPath?: string | null): string {
  if (lastPath && isValidAppResumePath(lastPath)) return lastPath;
  return DEFAULT_AUTHENTICATED_ROUTE;
}
