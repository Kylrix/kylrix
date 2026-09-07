'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readSurfaceScroll, writeSurfaceScroll } from '@/lib/ui/surface-memory';

/**
 * Persist / restore scrollTop for a scroll container (feed lists, hangouts, etc.).
 */
export function useSurfaceScroll(opts: {
  userId?: string | null;
  scope: string | null;
  enabled?: boolean;
}) {
  const { userId, scope, enabled = true } = opts;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !scope || !node) return;
    let cancelled = false;
    void readSurfaceScroll(userId, scope).then((hit) => {
      if (cancelled || !hit || !node) return;
      requestAnimationFrame(() => {
        node.scrollTop = hit.top;
        if (typeof hit.left === 'number') node.scrollLeft = hit.left;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, scope, enabled, node]);

  useEffect(() => {
    if (!enabled || !userId || !scope || !node) return;

    const onScroll = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void writeSurfaceScroll(userId, scope, node.scrollTop, node.scrollLeft);
      }, 180);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void writeSurfaceScroll(userId, scope, node.scrollTop, node.scrollLeft);
    };
  }, [userId, scope, enabled, node]);

  return attachRef;
}
