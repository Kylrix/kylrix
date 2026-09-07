'use client';

import { useCallback } from 'react';
import EcosystemPorter from '@/components/porter/EcosystemPorter';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';

function useIsDesktopPorter() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Open ecosystem Transfer (import/export) the same way event details open:
 * desktop → native/dynamic right rail; mobile → fullscreen overlay.
 */
export function useOpenEcosystemPorter(onImported?: () => void) {
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();

  return useCallback(() => {
    const isDesktop = useIsDesktopPorter();
    if (isDesktop) {
      openSidebar(
        <EcosystemPorter
          embedded
          data-porter
          onClose={() => closeSidebar()}
          onImported={onImported}
        />,
        'ecosystem-porter',
        { hideHeader: true },
      );
    } else {
      openOverlay(
        <EcosystemPorter
          data-porter
          onClose={() => closeOverlay()}
          onImported={onImported}
        />,
      );
    }
  }, [openOverlay, closeOverlay, openSidebar, closeSidebar, onImported]);
}
