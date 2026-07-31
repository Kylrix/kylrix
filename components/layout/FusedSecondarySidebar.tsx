'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  /** Compact icon strip vs named list panel */
  density?: 'compact' | 'full';
  className?: string;
  /** Optional aria label for the rail */
  label?: string;
};

/**
 * In-page secondary sidebar — flexes beside main content like the primary nav.
 * Prefer this over overlay/popover drawers so chrome (topbar) stays native.
 *
 * For global Master Pass / system panels, use RightRailContext (pushes main +
 * contracts the primary left nav without overwriting the user's collapse preference).
 *
 * Reuse for: chats, threads, calls, and other communicative detail surfaces.
 */
export function FusedSecondarySidebar({
  children,
  density = 'full',
  className = '',
  label = 'Secondary sidebar',
}: Props) {
  const width =
    density === 'compact'
      ? 'w-[72px] min-w-[72px] max-w-[72px]'
      : 'w-full sm:w-[280px] md:w-[300px] lg:w-[320px] min-w-0 sm:min-w-[280px]';

  return (
    <aside
      aria-label={label}
      className={[
        'hidden md:flex flex-col shrink-0 h-full min-h-0',
        'bg-[#000000] border-r border-white/8',
        width,
        className,
      ].join(' ')}
    >
      {children}
    </aside>
  );
}
