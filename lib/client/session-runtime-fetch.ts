'use client';

import { executeSessionRuntimeJobSecure } from '@/lib/actions/secure-ops';

/**
 * Thin client wrapper for session-scoped server jobs.
 * Replaces legacy fetch('/api/me/runtime-functions').
 */
export async function reconcileStaleLiveCallPresenceFromClient(): Promise<void> {
  try {
    await executeSessionRuntimeJobSecure('reconcile_stale_live_call_presence');
  } catch (err) {
    console.error('[session-runtime] Job failed:', err);
    /* badge refresh still runs best-effort without this */
  }
}
