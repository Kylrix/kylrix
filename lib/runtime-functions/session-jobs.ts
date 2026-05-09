import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';

export type SessionRuntimeJobId = 'reconcile_stale_live_call_presence';

const SESSION_JOB_IDS = new Set<SessionRuntimeJobId>(['reconcile_stale_live_call_presence']);

export function isSessionRuntimeJobId(job: string): job is SessionRuntimeJobId {
  return SESSION_JOB_IDS.has(job as SessionRuntimeJobId);
}

/** Session-scoped: `targetUserId` must be derived only from verified Appwrite session/JWT — never client-supplied impersonation IDs. */
export async function executeSessionRuntimeJob(job: SessionRuntimeJobId, verifiedUserId: string) {
  const uid = String(verifiedUserId || '').trim();
  if (!uid) throw new Error('Missing session identity');

  switch (job) {
    case 'reconcile_stale_live_call_presence':
      return reconcileStaleLiveCallPresenceForUser(uid);
    default:
      throw new Error('Unsupported session job');
  }
}
