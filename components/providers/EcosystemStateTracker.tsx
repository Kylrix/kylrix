'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { saveEcosystemState } from '@/lib/ecosystem/state-tracker';

/**
 * Silently observes user navigation and scroll positions within protected routes.
 * Writes to a rolling LRU cache in localStorage to enable instant state resumption.
 */
export function EcosystemStateTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!pathname) return;

    // Do not track public landers or auth gates
    if (pathname.startsWith('/send') || pathname === '/' || pathname.startsWith('/i/')) {
      return;
    }

    // Combine path and search params for exact state tracking
    const paramsString = searchParams.toString();
    const fullPath = paramsString ? `${pathname}?${paramsString}` : pathname;

    // Save initial load for this route
    saveEcosystemState(fullPath, window.scrollY);

    const handleScroll = () => {
      // Throttle saves slightly for performance
      if (Math.abs(window.scrollY - lastScrollY.current) > 50) {
        lastScrollY.current = window.scrollY;
        saveEcosystemState(fullPath, window.scrollY);
      }
    };

    // Attach to window scroll (or main layout container if different in Kylrix)
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname, searchParams]);

  return <>{children}</>;
}
