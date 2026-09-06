'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { hasPaidKylrixPlan } from '@/lib/utils';

/**
 * Idle ambient runner: occasional workspace tips → LocalEngine notifications.
 * No create-drawer UX. No Appwrite table reads on the tick path.
 */
export function WorkspaceIntelAmbientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showInfo } = useToast();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user?.$id) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let bootTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (force = false) => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') return;
      try {
        const { maybeEmitWorkspaceIntelNudge } = await import(
          '@/lib/agentic/workspace-intel-ambient'
        );
        const res = await maybeEmitWorkspaceIntelNudge({
          userId: user.$id,
          displayName: user.name || user.email || undefined,
          isPro: hasPaidKylrixPlan(user),
          force,
        });
        if (cancelled || !res.emitted) return;
        // Soft surface — tip also lives in the bell via LocalEngine
        if (res.title && res.message && Math.random() < 0.55) {
          showInfo(res.title, res.message);
        }
      } catch {}
    };

    // First chance after idle settle (45–90s) — not on first paint
    const bootDelay = 45_000 + Math.floor(Math.random() * 45_000);
    bootTimer = setTimeout(() => {
      if (ranRef.current) return;
      ranRef.current = true;
      void tick(false);
    }, bootDelay);

    // Recheck every ~25m; internal throttle enforces ≥3h between emissions
    intervalId = setInterval(() => {
      void tick(false);
    }, 25 * 60 * 1000);

    return () => {
      cancelled = true;
      if (bootTimer) clearTimeout(bootTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, showInfo]);

  return <>{children}</>;
}
