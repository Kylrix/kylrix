/** Shared resume-route rules (middleware-safe — no browser APIs). */

const PUBLIC_PREFIXES = [
  '/send',
  '/i/',
  '/app',
  '/idea',
  '/u/',
  '/p/',
  '/call/',
  '/connect/call/',
  '/form/',
  '/forms/',
  '/events/',
  '/goal/',
  '/goals/',
  '/agents/session/',
  '/agents/chat/',
  '/',
  '/billing/',
];

const APP_PREFIXES = [
  '/app',
  '/vault',
  '/flows',
  '/connect',
  '/workspaces',
  '/goals',
  '/forms',
  '/events',
  '/settings',
  '/settings/agents',
  '/billing',
  '/',
  '/',
];

export const LAST_ROUTE_COOKIE = 'kylrix_last_route';
export const DEFAULT_AUTHENTICATED_ROUTE = '/connect/chats';
export const DEFAULT_GUEST_ROUTE = '/app';

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
