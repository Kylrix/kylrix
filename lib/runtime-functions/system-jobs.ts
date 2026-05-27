import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { sweepStaleLiveCallPresenceBatch } from '@/lib/services/internal/live-call-presence-reconcile';
import { executeCascadeDeleteSecure } from '@/lib/actions/cascade-delete';

export type SystemRuntimeJobId = 
  | 'cleanup_expired_public_ghost_notes' 
  | 'sweep_stale_live_call_presence'
  | 'sweep_stale_action_threads';

const SYSTEM_JOB_IDS = new Set<SystemRuntimeJobId>([
  'cleanup_expired_public_ghost_notes',
  'sweep_stale_live_call_presence',
  'sweep_stale_action_threads'
]);

export function isSystemRuntimeJobId(job: string): job is SystemRuntimeJobId {
  return SYSTEM_JOB_IDS.has(job as SystemRuntimeJobId);
}

async function cleanupExpiredPublicGhostNotes(payload?: { batchSize?: number }) {
  const { databases } = createSystemClient();
  const NOTE_DB = APPWRITE_CONFIG.DATABASES.NOTE;
  const NOTES_TABLE = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const cap = Math.min(Math.max(Number(payload?.batchSize) || 120, 1), 500);

  const res = await databases.listRows(NOTE_DB, NOTES_TABLE, [
    Query.isNull('userId'),
    Query.equal('isPublic', true),
    Query.orderDesc('$updatedAt'),
    Query.limit(cap),
    Query.select(['$id', 'metadata', 'updatedAt'])]);

  let deleted = 0;
  for (const doc of res.rows) {
    let meta: { isGhost?: boolean; expiresAt?: string };
    try {
      meta =
        typeof doc.metadata === 'string' && doc.metadata
          ? (JSON.parse(doc.metadata) as { isGhost?: boolean; expiresAt?: string })
          : {};
    } catch {
      continue;
    }
    if (!meta.isGhost) continue;
    const exp = meta.expiresAt ? new Date(meta.expiresAt).getTime() : NaN;
    if (!Number.isFinite(exp) || exp > Date.now()) continue;

    try {
      // 1. Recursive cleanup for storage files, comments, reactions, etc.
      await executeCascadeDeleteSecure(NOTE_DB, NOTES_TABLE, doc.$id);

      // 2. Delete the ghost note itself
      await databases.deleteRow(NOTE_DB, NOTES_TABLE, doc.$id);
      deleted += 1;
    } catch {
      continue;
    }
  }

  return { scanned: res.rows.length, deleted };
}

async function sweepStaleActionThreads(payload?: { batchSize?: number }) {
  const { databases } = createSystemClient();
  const DATABASE_ID = 'whisperrflow';
  const THREADS_TABLE = 'action_threads';
  const cap = Math.min(Math.max(Number(payload?.batchSize) || 100, 1), 500);

  // Calculate 2 hours ago in ISO format
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  try {
    const res = await databases.listRows(DATABASE_ID, THREADS_TABLE, [
      Query.equal('status', 'running'),
      Query.lessThan('$updatedAt', twoHoursAgo),
      Query.limit(cap)
    ]);

    let updated = 0;
    for (const doc of res.rows) {
      try {
        await databases.updateRow(DATABASE_ID, THREADS_TABLE, doc.$id, {
          status: 'failed'
        });
        updated += 1;
      } catch (err) {
        console.error(`[sweepStaleActionThreads] Failed to update thread ${doc.$id}:`, err);
        continue;
      }
    }

    return { scanned: res.rows.length, updated };
  } catch (err) {
    console.error('[sweepStaleActionThreads] Failed to list or update stale threads:', err);
    throw err;
  }
}

export async function executeSystemRuntimeJob(
  job: SystemRuntimeJobId,
  payload?: { batchSize?: number; sweepLimit?: number },
) {
  switch (job) {
    case 'cleanup_expired_public_ghost_notes':
      return cleanupExpiredPublicGhostNotes({ batchSize: payload?.batchSize });
    case 'sweep_stale_live_call_presence':
      return sweepStaleLiveCallPresenceBatch(payload?.sweepLimit ?? payload?.batchSize ?? 160);
    case 'sweep_stale_action_threads':
      return sweepStaleActionThreads({ batchSize: payload?.batchSize });
    default:
      throw new Error('Unsupported system job');
  }
}
