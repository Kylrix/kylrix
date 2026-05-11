'use client';

/**
 * Pure pass-through. Chrome (topbar, bottom bar, sidebar, drawers) is mounted **once**
 * in `GlobalShell` so navigating between /note ↔ /vault ↔ /flow ↔ /connect ↔ /accounts
 * doesn't remount the chrome React tree.
 *
 * Keeping this file (vs. removing the segment) preserves the `(app)` route group's
 * routing semantics and matches Next.js conventions.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
