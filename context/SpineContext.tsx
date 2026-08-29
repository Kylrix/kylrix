'use client';

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SpineEngine } from '@/lib/services/SpineEngine';

/**
 * Route sync only — never mirror SpineEngine ticks into React state.
 * (Previously subscribed to every ~100ms tick and re-rendered the entire app tree.)
 */
export function SpineProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  React.useEffect(() => {
    SpineEngine.setRoute(pathname || '/');
  }, [pathname]);

  return <>{children}</>;
}
