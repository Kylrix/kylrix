'use client';

import { useCallback } from 'react';
import EcosystemPorter, { type EcosystemPorterProps } from '@/components/porter/EcosystemPorter';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';

function useIsDesktopPorter() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

type OpenPorterOpts = {
  onImported?: () => void;
  surface?: EcosystemPorterProps['surface'];
};

/**
 * Open ecosystem Transfer (import/export) the same way event details open:
 * desktop → native/dynamic right rail; mobile → fullscreen overlay.
 */
export function useOpenEcosystemPorter(opts?: OpenPorterOpts | (() => void)) {
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();

  const normalized: OpenPorterOpts =
    typeof opts === 'function' ? { onImported: opts } : opts || {};

  return useCallback(() => {
    const isDesktop = useIsDesktopPorter();
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
}
