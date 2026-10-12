'use client';

import { useEffect, useCallback } from 'react';

/**
 * Service Worker Management Hook
 * Handles registration, context preservation (MEK), and navigation hijacking.
 */
export function useServiceWorker() {
  const register = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered with scope:', registration.scope);
    } catch (err) {
      console.error('[SW] Registration failed:', err);
    }
  }, []);

  const storeVolatileContext = useCallback((payload: any) => {
    if (!navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'STORE_CONTEXT',
      payload
    });
  }, []);

  const recoverVolatileContext = useCallback((): Promise<any> => {
    return new Promise((resolve) => {
      if (!navigator.serviceWorker.controller) {
        resolve(null);
        return;
      }

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CONTEXT_RECOVERED') {
          resolve(event.data.payload);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'RECOVER_CONTEXT' },
        [messageChannel.port2]
      );
    });
  }, []);

  const wipeVolatileContext = useCallback(() => {
    if (!navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({ type: 'WIPE_CONTEXT' });
  }, []);

  useEffect(() => {
    register();
  }, [register]);

  return {
    storeVolatileContext,
    recoverVolatileContext,
    wipeVolatileContext
  };
}
