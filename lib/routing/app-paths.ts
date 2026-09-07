/**
 * Canonical routes:
 * - Flow (= workflows): /flows list, /flow/[id] share
 * - Goals/forms/events: their own prefixes (not Flow)
 * - Workspaces: singular share link /workspace/[id] sets active workspace and redirects to /app
 *   (List and detail at /workspaces/** are dead — always sanitize to /app or /workspace/[id])
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

/**
 * Map dead / renamed in-app paths to live ones.
 * Use for notification clicks, AI actionHref, and any user-facing navigation.
 */
export function sanitizeInAppHref(href: string | null | undefined): string {
  const raw = String(href || '').trim();
  if (!raw) return '/app';

  let path = raw;
  let search = '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      path = u.pathname;
      search = u.search;
    } else {
      const q = raw.indexOf('?');
      if (q >= 0) {
        path = raw.slice(0, q);
        search = raw.slice(q);
      }
    }
  } catch {
    return '/app';
  }

  if (!path.startsWith('/')) path = `/${path}`;

  if (path === '/workspaces' || path === '/workspace' || path === '/projects') {
    return `/app${search}`;
  }
  if (path.startsWith('/workspaces/')) {
    const id = path.split('/')[2];
    return id ? `/workspace/${id}${search}` : `/app${search}`;
  }
  if (path.startsWith('/projects/')) {
    const id = path.split('/')[2];
    return id ? `/workspace/${id}${search}` : `/app${search}`;
  }
  if (path === '/workflows' || path === '/workflow') {
    return `/flows${search}`;
  }
  if (path.startsWith('/workflows/')) {
    const id = path.split('/')[2];
    return id ? `/flow/${id}${search}` : `/flows${search}`;
  }
  // Plural list OK; singular share for detail rows
  const formsDetail = path.match(/^\/forms\/([^/]+)\/?$/);
  if (formsDetail) return `/form/${formsDetail[1]}${search}`;
  const goalsDetail = path.match(/^\/goals\/([^/]+)\/?$/);
  if (goalsDetail) return `/goal/${goalsDetail[1]}${search}`;

  return `${path}${search}`;
}
