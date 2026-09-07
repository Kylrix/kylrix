'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearSurfaceDraft,
  momentDraftScope,
  readSurfaceDraft,
  writeSurfaceDraft,
  type SurfaceDraftEntry,
} from '@/lib/ui/surface-memory';

/**
 * LocalEngine-backed draft memory for composers.
 * Scope must be specific (e.g. moment reply → parent id) so drafts never leak across threads.
 */
export function useSurfaceDraft(opts: {
  userId?: string | null;
  scope: string | null;
  /** When false, skip hydrate/persist (e.g. drawer closed). */
  enabled?: boolean;
}) {
  const { userId, scope, enabled = true } = opts;
  const [hydrated, setHydrated] = useState(false);
  const [text, setTextState] = useState('');
  const [meta, setMeta] = useState<SurfaceDraftEntry['meta']>();
  const textRef = useRef('');
  const scopeRef = useRef(scope);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    setHydrated(false);
    setTextState('');
    textRef.current = '';
    setMeta(undefined);
    if (!enabled || !userId || !scope) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void readSurfaceDraft(userId, scope).then((hit) => {
      if (cancelled || scopeRef.current !== scope) return;
      const next = hit?.text || '';
      textRef.current = next;
      setTextState(next);
      setMeta(hit?.meta);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, scope, enabled]);

  const setText = useCallback(
    (next: string | ((prev: string) => string)) => {
      setTextState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        textRef.current = value;
        if (enabled && userId && scope) {
          void writeSurfaceDraft(userId, scope, value, meta);
        }
        return value;
      });
    },
    [enabled, userId, scope, meta],
  );

  const clear = useCallback(async () => {
    textRef.current = '';
    setTextState('');
    if (userId && scope) await clearSurfaceDraft(userId, scope);
  }, [userId, scope]);

  return { text, setText, hydrated, clear, meta, setMeta, textRef };
}

export function useMomentDraftMemory(opts: {
  userId?: string | null;
  mode: 'create' | 'reply';
  parentMomentId?: string | null;
  enabled?: boolean;
}) {
  const scope =
    opts.userId && opts.enabled !== false
      ? momentDraftScope({
          userId: opts.userId,
          mode: opts.mode,
          parentMomentId: opts.parentMomentId,
        })
      : null;
  return useSurfaceDraft({
    userId: opts.userId,
    scope,
    enabled: opts.enabled !== false && Boolean(opts.userId),
  });
}
