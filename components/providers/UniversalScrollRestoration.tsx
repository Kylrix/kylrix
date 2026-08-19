'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SCROLL_STORAGE_KEY_PREFIX = 'kylrix:scroll:';

/**
 * Universal Scroll Memory & Restoration Engine
 * - Automatically saves and restores window.scrollY per route pathname.
 * - Restores scroll smoothly once page content hydrates / stabilizes.
 * - Also hooks into elements with [data-scroll-remember="<key>"] or [data-scroll-container]
 *   to remember their inner scrollTop across navigation.
 */
export function UniversalScrollRestoration() {
  const pathname = usePathname();
  const activePathRef = useRef(pathname);
  const restoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Save scroll position periodically and before navigation / unload
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saveCurrentScroll = (path: string) => {
      if (!path) return;
      try {
        const windowPos = {
          x: window.scrollX,
          y: window.scrollY,
        };
        sessionStorage.setItem(`${SCROLL_STORAGE_KEY_PREFIX}win:${path}`, JSON.stringify(windowPos));

        // Also save any marked inner scroll containers
        const containers = document.querySelectorAll<HTMLElement>('[data-scroll-remember], [data-scroll-container]');
        containers.forEach((el) => {
          const key = el.getAttribute('data-scroll-remember') || el.getAttribute('data-scroll-container') || el.id;
          if (key) {
            sessionStorage.setItem(
              `${SCROLL_STORAGE_KEY_PREFIX}elem:${path}:${key}`,
              JSON.stringify({ x: el.scrollLeft, y: el.scrollTop })
            );
          }
        });
      } catch {}
    };

    const handleScroll = () => {
      saveCurrentScroll(activePathRef.current);
    };

    const handleBeforeUnload = () => {
      saveCurrentScroll(activePathRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 2. On route pathname change, save old path and restore new path
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Save previous path's scroll before switching activePathRef
    const prevPath = activePathRef.current;
    if (prevPath && prevPath !== pathname) {
      try {
        const windowPos = {
          x: window.scrollX,
          y: window.scrollY,
        };
        sessionStorage.setItem(`${SCROLL_STORAGE_KEY_PREFIX}win:${prevPath}`, JSON.stringify(windowPos));

        const containers = document.querySelectorAll<HTMLElement>('[data-scroll-remember], [data-scroll-container]');
        containers.forEach((el) => {
          const key = el.getAttribute('data-scroll-remember') || el.getAttribute('data-scroll-container') || el.id;
          if (key) {
            sessionStorage.setItem(
              `${SCROLL_STORAGE_KEY_PREFIX}elem:${prevPath}:${key}`,
              JSON.stringify({ x: el.scrollLeft, y: el.scrollTop })
            );
          }
        });
      } catch {}
    }

    activePathRef.current = pathname;

    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
    }

    // Attempt restoring scroll position. In local-first SSR/CSR apps, content hydrates over 0-300ms.
    // Try multiple quick intervals to restore as soon as DOM content matches the required scroll height.
    const rawWin = sessionStorage.getItem(`${SCROLL_STORAGE_KEY_PREFIX}win:${pathname}`);
    let targetWin: { x: number; y: number } | null = null;
    if (rawWin) {
      try {
        targetWin = JSON.parse(rawWin);
      } catch {}
    }

    const restoreContainers = () => {
      const containers = document.querySelectorAll<HTMLElement>('[data-scroll-remember], [data-scroll-container]');
      containers.forEach((el) => {
        const key = el.getAttribute('data-scroll-remember') || el.getAttribute('data-scroll-container') || el.id;
        if (key) {
          const rawElem = sessionStorage.getItem(`${SCROLL_STORAGE_KEY_PREFIX}elem:${pathname}:${key}`);
          if (rawElem) {
            try {
              const pos = JSON.parse(rawElem);
              if (pos && typeof pos.y === 'number' && el.scrollTop !== pos.y) {
                el.scrollTop = pos.y;
                el.scrollLeft = pos.x || 0;
              }
            } catch {}
          }
        }
      });
    };

    if (targetWin && targetWin.y > 0) {
      let attempts = 0;
      const maxAttempts = 12;
      const attemptRestore = () => {
        attempts++;
        if (targetWin && targetWin.y > 0) {
          window.scrollTo({ left: targetWin.x || 0, top: targetWin.y, behavior: 'instant' as any });
        }
        restoreContainers();

        if (attempts < maxAttempts && document.documentElement.scrollHeight < (targetWin?.y || 0) + 100) {
          restoreTimeoutRef.current = setTimeout(attemptRestore, 40);
        }
      };

      restoreTimeoutRef.current = setTimeout(attemptRestore, 10);
    } else {
      restoreTimeoutRef.current = setTimeout(restoreContainers, 30);
    }

    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, [pathname]);

  return null;
}
