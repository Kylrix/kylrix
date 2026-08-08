/**
 * Canonical routes:
 * - Flow (= workflows): /flows list, /flow/[id] share
 * - Goals/forms/events: their own prefixes (not Flow)
 * - Workspaces: singular share link /workspace/[id] sets active workspace and redirects to /app
 *   (List and detail at /workspaces/** are deprecated — use /app filtered by active workspace)
 */

export function isFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/flows' ||
    pathname.startsWith('/flows/') ||
    pathname === '/flow' ||
    pathname.startsWith('/flow/')
  );
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
  return pathname === '/workspace' || pathname.startsWith('/workspace/');
}

/** @deprecated Workspaces list/detail is removed — use /app with active workspace or /workspace/[id] share */
export function isWorkspaceSharePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/workspace\/[^/]+$/.test(pathname);
}
