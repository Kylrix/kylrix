'use client';

import { useEffect, useState } from 'react';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';

export function useCachedProfilePreview(source?: string | null, width: number = 64, height: number = 64) {
  const [preview, setPreview] = useState<string | null>(() => {
    if (!source) return null;
    if (/^https?:\/\//.test(source)) return source;

    const cached = getCachedProfilePreview(source, width, height);
    return cached ?? null;
  });

  useEffect(() => {
    let active = true;

    if (!source) {
      setPreview(null);
      return () => {
        active = false;
      };
    }

    if (/^https?:\/\//.test(source)) {
      setPreview(source);
      return () => {
        active = false;
      };
    }

    const cached = getCachedProfilePreview(source, width, height);
    if (cached !== undefined) {
      setPreview(cached ?? null);
      if (cached !== null) {
        return () => {
          active = false;
        };
      }
    }

    void fetchProfilePreview(source, width, height)
      .then((next) => {
        if (active) setPreview(next);
      })
      .catch(() => {
        if (active) setPreview(null);
      });

    return () => {
      active = false;
    };
  }, [source, width, height]);

  return preview;
}
