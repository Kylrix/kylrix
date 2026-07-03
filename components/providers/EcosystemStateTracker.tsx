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

    // Do not track public landers, shared/guest views, or auth gates
    const isPublic =
      pathname.startsWith('/send') ||
      pathname === '/' ||
      pathname.startsWith('/i/') ||
      pathname.startsWith('/app/shared') ||
      pathname.startsWith('/idea') ||
      pathname.startsWith('/u/') ||
      pathname.startsWith('/p/') ||
      pathname.startsWith('/call/') ||
      pathname.startsWith('/connect/call/') ||
      pathname.startsWith('/flow/forms/') ||
      pathname.startsWith('/flow/events/');

    if (isPublic) {
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
