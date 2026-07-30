/**
 * Canonical routes:
 * - Flow (= workflows): /flows only
 * - Goals/forms/events: their own prefixes (not Flow)
 * - Workspaces (projects table): /workspaces
 */

export function isFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/flows' || pathname.startsWith('/flows/');
}

/** @deprecated use isFlowPath — Flow is workflows */

export function isGoalsSurfacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/goals' ||
    pathname.startsWith('/goals/') ||
    pathname.startsWith('/goal/') ||
    pathname === '/forms' ||
    pathname.startsWith('/forms/') ||
    pathname.startsWith('/form/') ||
    pathname === '/events' ||
    pathname.startsWith('/events/')
  );
}

export function isWorkspacesPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/workspaces' || pathname.startsWith('/workspaces/');
}
