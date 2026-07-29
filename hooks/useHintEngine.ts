'use client';

import { useEffect, useState } from 'react';
import { resolveHints, type HintCandidate } from '@/lib/agentic/hint-engine';

export function useHintEngine(opts: {
  zone: string;
  route: string;
  input: string;
  resourceId?: string;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const [hints, setHints] = useState<HintCandidate[]>([]);
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled) {
      setHints([]);
      return;
    }

    const timer = setTimeout(() => {
      void resolveHints({
        zone: opts.zone,
        route: opts.route,
        input: opts.input,
        resourceId: opts.resourceId,
        limit: 5,
      }).then(setHints);
    }, opts.debounceMs ?? 280);

    return () => clearTimeout(timer);
  }, [opts.zone, opts.route, opts.input, opts.resourceId, enabled, opts.debounceMs]);

  return hints;
}
