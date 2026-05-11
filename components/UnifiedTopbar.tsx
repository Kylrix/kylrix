'use client';

import { usePathname } from 'next/navigation';
import { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import NoteTopbar from '@/components/common/NoteTopbar';

const VaultTopbar = dynamic(() => import('@/components/common/VaultTopbar'), { ssr: false });

/**
 * Persistent unified topbar — single mount for the whole session.
 *
 * App-context awareness: pathname-driven, but the *component identity* must stay stable
 * for every non-vault route so React doesn't unmount the bar on app switches. NoteTopbar
 * internally branches on pathname for skin (logo accent, search visibility, marketing nav
 * items, etc.), so it's the universal element across website + note + connect + flow +
 * accounts + settings. Vault uses its own auth context (useAppwriteVault) so it gets a
 * dedicated VaultTopbar — that's the one remount point we accept.
 */
function UnifiedTopbarInner() {
  const pathname = usePathname();

  const isVaultRoute = useMemo(() => Boolean(pathname?.startsWith('/vault')), [pathname]);

  if (isVaultRoute) {
    return <VaultTopbar />;
  }
  return <NoteTopbar />;
}

export const UnifiedTopbar = memo(UnifiedTopbarInner);
UnifiedTopbar.displayName = 'UnifiedTopbar';
