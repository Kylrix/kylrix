import type { Databases } from 'node-appwrite';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';

const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
const APP_ACTIVITY = APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY;

type LiveEnvelope = { t?: string; id?: string; src?: string; s?: string };

async function patchPresenceSafe(
  databases: Databases,
  rowId: string,
  patch: Partial<{ status: string; customStatus: string }>,
) {
  await databases.updateDocument(CHAT_DB, APP_ACTIVITY, rowId, patch as Record<string, unknown>);
}

/** Clear malformed / legacy live payloads from presence.customStatus */
export async function reconcileStaleLiveCallPresenceForUser(
  targetUserId: string,
  databases?: Databases,
): Promise<{ changed: boolean; reason?: string }> {
  const db = databases ?? createAdminClient().databases;
  const trimmed = String(targetUserId || '').trim();
  if (!trimmed) return { changed: false, reason: 'no_user' };

  const rows = await db.listDocuments(CHAT_DB, APP_ACTIVITY, [
    Query.equal('userId', trimmed),
    Query.orderDesc('$updatedAt'),
    Query.limit(1),
    Query.select(['$id', 'userId', 'status', 'customStatus', 'lastSeen']),
  ]);
  const row = rows.documents[0];
  if (!row) return { changed: false, reason: 'no_presence' };

  const raw = String(row.customStatus || '').trim();
  if (!raw) return { changed: false, reason: 'empty_custom' };

  let parsed: LiveEnvelope;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await patchPresenceSafe(db, row.$id, { status: 'online', customStatus: '' });
    return { changed: true, reason: 'invalid_custom_json' };
  }

  if (parsed?.t !== 'call' || !parsed.id || parsed.s === 'ended') {
    return { changed: false, reason: 'not_live_call_marker' };
  }

  const callId = String(parsed.id).trim();
  if (!callId) {
    await patchPresenceSafe(db, row.$id, { status: 'online', customStatus: '' });
    return { changed: true, reason: 'empty_call_id' };
  }

  try {
    const call = await db.getDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      callId,
    );
    const expRaw = String((call as { expiresAt?: string }).expiresAt || '').trim();
    const exp = expRaw ? new Date(expRaw).getTime() : NaN;

    const expired = Number.isFinite(exp) && exp <= Date.now();

    if (expired) {
      await deleteCallIfExpired(db as Parameters<typeof deleteCallIfExpired>[0], callId).catch(() => undefined);
      await patchPresenceSafe(db, row.$id, { status: 'online', customStatus: '' });
      return { changed: true, reason: 'call_expired' };
    }

    return { changed: false, reason: 'call_active' };
  } catch (e: unknown) {
    const code = Number((e as { code?: number }).code ?? (e as { status?: number }).status ?? 0);
    if (code === 404) {
      await patchPresenceSafe(db, row.$id, { status: 'online', customStatus: '' });
      return { changed: true, reason: 'call_missing' };
    }
    throw e;
  }
}

/** Internal batch sweep (cron / privileged jobs): busy rows whose live-call marker points at stale/missing/expired ledger entries. */
export async function sweepStaleLiveCallPresenceBatch(limit = 100): Promise<{
  scanned: number;
  cleared: number;
}> {
  const { databases } = createAdminClient();
  const rows = await databases.listDocuments(CHAT_DB, APP_ACTIVITY, [
    Query.equal('status', 'busy'),
    Query.orderDesc('$updatedAt'),
    Query.limit(Math.min(Math.max(limit, 1), 500)),
    Query.select(['$id', 'userId']),
  ]);

  let cleared = 0;

  for (const doc of rows.documents) {
    const uid = String((doc as { userId?: string }).userId || '').trim();
    if (!uid) continue;

    try {
      const r = await reconcileStaleLiveCallPresenceForUser(uid, databases);
      if (r.changed) cleared += 1;
    } catch {
      continue;
    }
  }

  return { scanned: rows.documents.length, cleared };
}
