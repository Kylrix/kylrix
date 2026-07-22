'use client';

import React, { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SpineEngine, SpineTickData } from '@/lib/services/SpineEngine';

interface SpineContextType {
  status: ReturnType<typeof SpineEngine.getStatus>;
  setFocusedResource: (resourceId: string | null, targetIntervalMs?: number) => void;
  pulseImmediately: () => void;
  subscribe: (channel: string, callback: (tick: SpineTickData) => void) => () => void;
}

const SpineContext = createContext<SpineContextType | undefined>(undefined);

export function SpineProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState(() => SpineEngine.getStatus());

  useEffect(() => {
    SpineEngine.setRoute(pathname || '/');
  }, [pathname]);

  useEffect(() => {
    // Keep React state updated periodically
    const unsub = SpineEngine.subscribe('spine.system', () => {
      setStatus(SpineEngine.getStatus());
    });
    return unsub;
  }, []);

  const value: SpineContextType = {
    status,
    setFocusedResource: (resourceId, targetIntervalMs) => SpineEngine.setFocusedResource(resourceId, targetIntervalMs),
    pulseImmediately: () => SpineEngine.pulseImmediately(),
    subscribe: (channel, callback) => SpineEngine.subscribe(channel, callback),
  };

  return <SpineContext.Provider value={value}>{children}</SpineContext.Provider>;
}

export function useSpine() {
  const ctx = useContext(SpineContext);
  if (!ctx) {
    throw new Error('useSpine must be used within a SpineProvider');
  }
  return ctx;
}
