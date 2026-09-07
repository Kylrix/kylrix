'use client';

import { useCallback } from 'react';
import EcosystemPorter, { type EcosystemPorterProps } from '@/components/porter/EcosystemPorter';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useSudo } from '@/context/SudoContext';

function isDesktopPorter(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

function isVaultUnlockedNow(): boolean {
  try {
    const { masterPassCrypto } = require('@/lib/masterpass-crypto');
    return Boolean(masterPassCrypto.isVaultUnlocked());
  } catch {
    return false;
  }
}

type OpenPorterOpts = {
  onImported?: () => void;
  surface?: EcosystemPorterProps['surface'];
};

/**
 * Open ecosystem Transfer (import/export) the same way event details open:
 * desktop → native/dynamic right rail; mobile → fullscreen overlay.
 * Always requires vault unlock first (MEK needed to seal import pockets).
 */
export function useOpenEcosystemPorter(opts?: OpenPorterOpts | (() => void)) {
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { requestSudo } = useSudo();

  const normalized: OpenPorterOpts =
    typeof opts === 'function' ? { onImported: opts } : opts || {};

  const openPorterSurface = useCallback(() => {
    const isDesktop = isDesktopPorter();
    const surface = normalized.surface || 'general';
    if (isDesktop) {
      openSidebar(
        <EcosystemPorter
          embedded
          data-porter
          surface={surface}
          onClose={() => closeSidebar()}
          onImported={normalized.onImported}
        />,
        'ecosystem-porter',
        { hideHeader: true },
      );
    } else {
      openOverlay(
        <EcosystemPorter
          data-porter
          surface={surface}
          onClose={() => closeOverlay()}
          onImported={normalized.onImported}
        />,
      );
    }
  }, [
    openOverlay,
    closeOverlay,
    openSidebar,
    closeSidebar,
    normalized.onImported,
    normalized.surface,
  ]);

  return useCallback(() => {
    if (isVaultUnlockedNow()) {
      openPorterSurface();
      return;
    }
    requestSudo({
      onSuccess: () => openPorterSurface(),
    });
  }, [openPorterSurface, requestSudo]);
}
