'use client';

/**
 * Thin client wrapper for session-scoped server jobs (identity bound to cookie/JWT server-side).
 * Avoid expanding this surface — whitelist jobs in `lib/runtime-functions/session-jobs.ts` only.
 */
export async function reconcileStaleLiveCallPresenceFromClient(): Promise<void> {
  try {
    await fetch('/api/me/runtime-functions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ job: 'reconcile_stale_live_call_presence' }),
    });
  } catch {
    /* badge refresh still runs best-effort without this */
  }
}
