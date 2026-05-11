import React from 'react';

/**
 * Pure pass-through. The `(dashboard)` route group under /connect currently has no
 * pages, so this layout never wraps a live route. Chrome (topbar, sidebars, bottom bar,
 * drawers) is mounted once in `GlobalShell`. Keeping a minimal file preserves the route
 * group convention; we no longer pull `MainLayout` (which is flow-specific) into the
 * connect build graph.
 */
export default function ConnectDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
