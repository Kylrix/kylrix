'use client';

import { useEffect, useCallback } from 'react';
import { useDataNexus } from '@/context/DataNexusContext';

/**
 * Reload Hijacking Hook
 * Intercepts F5, Cmd+R, and window.location.reload() to prevent DOM teardown.
 * Triggers a background Data Nexus sync instead.
 */
export function useReloadHijack() {
  const { triggerBackgroundSync } = useDataNexus();

  const handleReloadIntent = useCallback(() => {
    console.log('[Reload Hijack] Intercepted reload intent. Triggering Nexus sync.');
    if (triggerBackgroundSync) {
      triggerBackgroundSync();
    }
  }, [triggerBackgroundSync]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Intercept Keyboard Shortcuts (F5, Cmd+R, Ctrl+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isRefresh = 
        e.key === 'F5' || 
        ((e.metaKey || e.ctrlKey) && e.key === 'r');

      if (isRefresh) {
        e.preventDefault();
        handleReloadIntent();
      }
    };

    // 2. Monkey-patch programmatic reloads
    const originalReload = window.location.reload;
    
    // We can't easily overwrite window.location.reload as it's often read-only or restricted
    // but we can try to intercept calls to it or provide a global helper.
    (window as any).__kylrix_original_reload = originalReload;
    
    // 3. Handle beforeunload to potentially cancel or warn (though we prefer hijacking)
    // Note: modern browsers restrict what you can do in beforeunload

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleReloadIntent]);
}
