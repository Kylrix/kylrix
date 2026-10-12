'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';

/**
 * Idle ambient runner: occasional workspace tips → LocalEngine notifications.
 * Unprompted notifications land in topbar / right sidebar integrated compact pill.
 */
export function WorkspaceIntelAmbientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const ranRef = useRef(false);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user?.$id) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let bootTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (force = false) => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') return;
      const currentUser = userRef.current;
      if (!currentUser?.$id) return;
      try {
        const { maybeEmitWorkspaceIntelNudge } = await import(
          '@/lib/agentic/workspace-intel-ambient'
        );
        const res = await maybeEmitWorkspaceIntelNudge({
          userId: currentUser.$id,
          displayName: currentUser.name || currentUser.email || undefined,
          isPro: hasPaidKylrixPlan(currentUser),
          force,
        });
        if (cancelled || !res.emitted) return;
      } catch {}
    };

    // First chance after idle settle (45–90s) — not on first paint
    const bootDelay = 45_000 + Math.floor(Math.random() * 45_000);
    bootTimer = setTimeout(() => {
      if (ranRef.current) return;
      ranRef.current = true;
      void tick(false);
    }, bootDelay);

    // Recheck every ~2 hours; internal throttle enforces ≥3h between emissions
    intervalId = setInterval(() => {
      void tick(false);
    }, 120 * 60 * 1000);

    return () => {
      cancelled = true;
      if (bootTimer) clearTimeout(bootTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.$id]);

  return <>{children}</>;
}
