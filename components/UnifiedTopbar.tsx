'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import NoteTopbar from '@/components/common/NoteTopbar';
import VaultTopbar from '@/components/common/VaultTopbar';
import TopbarShell from '@/components/layout/TopbarShell';

/**
 * Persistent unified topbar that transforms based on current route.
 * Never unmounts when navigating between app sections.
 * Uses the standard app topbar across app routes.
 */
export function UnifiedTopbar() {
  const pathname = usePathname();

  // Determine which app we're in based on pathname
  const appContext = useMemo(() => {
    if (pathname?.startsWith('/settings')) return 'settings';
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    return null;
  }, [pathname]);

  // Render appropriate topbar based on context
  // Each topbar only changes its rendered content, never unmounts
  if (appContext === 'note') {
    return <NoteTopbar />;
  }
  if (appContext === 'vault') {
    return <VaultTopbar />;
  }
  if (appContext === 'connect') {
    return <NoteTopbar />;
  }
  if (appContext === 'accounts') {
    return <TopbarShell />;
  }
  if (appContext === 'flow') {
    return <NoteTopbar />;
  }
  if (appContext === 'settings') {
    return <TopbarShell />;
  }

  return null;
}
