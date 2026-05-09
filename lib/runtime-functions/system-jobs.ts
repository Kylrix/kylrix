import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { sweepStaleLiveCallPresenceBatch } from '@/lib/services/internal/live-call-presence-reconcile';

export type SystemRuntimeJobId = 'cleanup_expired_public_ghost_notes' | 'sweep_stale_live_call_presence';

const SYSTEM_JOB_IDS = new Set<SystemRuntimeJobId>([
  'cleanup_expired_public_ghost_notes',
  'sweep_stale_live_call_presence',
]);

export function isSystemRuntimeJobId(job: string): job is SystemRuntimeJobId {
  return SYSTEM_JOB_IDS.has(job as SystemRuntimeJobId);
}

async function cleanupExpiredPublicGhostNotes(payload?: { batchSize?: number }) {
  const { databases } = createAdminClient();
  const NOTE_DB = APPWRITE_CONFIG.DATABASES.NOTE;
  const NOTES_TABLE = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const cap = Math.min(Math.max(Number(payload?.batchSize) || 120, 1), 500);

  const res = await databases.listDocuments(NOTE_DB, NOTES_TABLE, [
    Query.isNull('userId'),
    Query.equal('isPublic', true),
    Query.orderDesc('$updatedAt'),
    Query.limit(cap),
    Query.select(['$id', 'metadata', 'updatedAt']),
  ]);

  let deleted = 0;
  for (const doc of res.documents) {
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
      await databases.deleteDocument(NOTE_DB, NOTES_TABLE, doc.$id);
      deleted += 1;
    } catch {
      continue;
    }
  }

  return { scanned: res.documents.length, deleted };
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
    default:
      throw new Error('Unsupported system job');
  }
}
