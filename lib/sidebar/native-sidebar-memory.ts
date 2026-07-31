/**
 * Native sidebar memory — local copy first, then user settings sync.
 * Remembers per-route surface + stubborn agentic state across devices.
 */

export const SIDEBAR_MEMORY_CACHE_KEY = (userId: string) =>
  `f_sidebar_memory_${userId}`;

export type SidebarRestoreHint = {
  type: string;
  payload?: Record<string, unknown>;
};

export type RouteSidebarMemory = {
  key: string | null;
  width?: number;
  sticky?: boolean;
  restore?: SidebarRestoreHint | null;
  updatedAt?: number;
};

export type SidebarMemoryDoc = {
  /** Pathname → last native sidebar state on that screen */
  byRoute: Record<string, RouteSidebarMemory>;
  /** Stubborn agentic panel — survives route changes until user closes */
  agentic?: {
    open: boolean;
    prompt?: string | null;
    autoRun?: boolean;
    updatedAt?: number;
  };
  updatedAt?: number;
};

export function emptySidebarMemory(): SidebarMemoryDoc {
  return { byRoute: {}, updatedAt: Date.now() };
}

export function routeKeyFromPathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  // Collapse dynamic ids so memory keys stay stable-ish across similar screens
  return pathname
    .replace(/\/[a-f0-9]{8,}(?:-[a-f0-9]+)*$/i, '/:id')
    .replace(/\/\d+$/g, '/:id');
}
