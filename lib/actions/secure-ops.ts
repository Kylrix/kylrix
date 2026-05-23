'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role, Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server-only';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';
import { permissionsInternal } from '@/lib/services/internal/permissions';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { executeCascadeDeleteSecure } from './cascade-delete';

// Short-lived in-memory cache for document reads during permission checks.
// Prevents duplicate database fetches within a short timeframe (e.g. 5 seconds).
const documentCache = new Map<string, { doc: any; timestamp: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds

export async function getRowCached(params: { databaseId: string; tableId: string; rowId: string }) {
  const cacheKey = `${params.databaseId}:${params.tableId}:${params.rowId}`;
  const now = Date.now();
  const cached = documentCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.doc;
  }
  const tables = createSystemTablesDB();
  const doc = await tables.getRow(params);
  if (doc) {
    // Prune expired entries to keep memory low
    if (documentCache.size > 100) {
      for (const [key, val] of documentCache.entries()) {
        if (now - val.timestamp > CACHE_TTL_MS) {
          documentCache.delete(key);
        }
      }
    }
    documentCache.set(cacheKey, { doc, timestamp: now });
  }
  return doc;
}

/** 
 * Standard actor discovery for Server Actions. 
 * Reads session cookies or explicit JWT to establish identity.
 */
export async function getActor(jwt?: string) {
  try {
    const { account } = await createServerClient(jwt);
    const actor = await account.get().catch(err => {
      console.warn('[secure-ops] Auth failure in account.get():', err?.message);
      return null;
    });
    if (actor) {
        console.log('[secure-ops] Actor established:', actor.$id, actor.email);
    } else {
        console.warn('[secure-ops] Actor discovery returned null');
    }
    return actor;
  } catch (err) {
    console.error('[secure-ops] getActor exception:', err);
    return null;
  }
}

function isEnvSERVERSDKUser(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  const serverSDKSet = new Set(
    String(process.env.ADMINS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return serverSDKSet.has(email);
}

function isEnvAdminUser(user: any) {
  // Currently sharing same definition as SERVERSDK but kept separate for architectural growth
  return isEnvSERVERSDKUser(user);
}

function hasWriteAccess(note: any, actorId: string) {
  const ownerId = String(note?.userId || '').trim();
  if (ownerId && ownerId === actorId) return true;
  const collaborators = Array.isArray(note?.collaborators) ? note.collaborators : [];
  const collaboratorIds = collaborators
    .map((entry: any) => (typeof entry === 'string' ? entry : entry?.userId || entry?.id || ''))
    .filter(Boolean);
  try {
    const metadata = JSON.parse(note?.metadata || '{}');
    const writeCollaborators = Array.isArray(metadata?.writeCollaborators) ? metadata.writeCollaborators : [];
    collaboratorIds.push(...writeCollaborators.filter(Boolean));
  } catch {}
  return Array.from(new Set(collaboratorIds)).includes(actorId);
}

function serializeMomentRow(row: Record<string, unknown>) {
  return {
    $id: String(row?.$id || ''),
    $createdAt: row?.$createdAt,
    $updatedAt: row?.$updatedAt,
    userId: String(row?.userId || ''),
    caption: row?.caption ?? '',
    type: row?.type ?? '',
    momentKind: row?.momentKind ?? '',
    sourceId: row?.sourceId ?? null,
    searchTitle: row?.searchTitle ?? null,
    fileId: row?.fileId ?? '',
    createdAt: row?.createdAt ?? '',
    expiresAt: row?.expiresAt ?? '',
  };
}

function serializeTokenMintResult(raw: unknown): Record<string, unknown> {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return { accepted: false, reason: 'MINT_FAILED' };
  if (r.accepted) {
    return {
      accepted: true,
      ...(r.amount != null ? { amount: String(r.amount) } : {}),
      ...(r.amountMicro != null ? { amountMicro: String(r.amountMicro) } : {}),
      ...(r.symbol != null ? { symbol: String(r.symbol) } : {}),
    };
  }
  return {
    accepted: false,
    reason: String(r.reason || 'MINT_FAILED'),
  };
}

export async function mintNoteShareMomentSecure(input: { momentId: string }) {
  const momentId = String(input?.momentId || '').trim();
  if (!momentId) throw new Error('momentId is required');

  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const momentsTable = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
  const tables = createSystemTablesDB();
  let moment: Record<string, unknown>;
  try {
    moment = (await tables.getRow({
      databaseId: chatDb,
      tableId: momentsTable,
      rowId: momentId,
    })) as Record<string, unknown>;
  } catch {
    return { tokenMint: { accepted: false, reason: 'MOMENT_NOT_FOUND' } };
  }

  const creatorId = String(moment?.userId || '').trim();
  if (!creatorId) return { tokenMint: { accepted: false, reason: 'INVALID_MOMENT' } };

  const noteId = getNoteAttachmentIdFromMomentFileId(moment?.fileId);
  if (!noteId) return { tokenMint: { accepted: false, reason: 'NO_NOTE_ATTACHMENT' } };

  let note: Record<string, unknown>;
  try {
    const tables = createSystemTablesDB();
    note = (await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: noteId,
    })) as Record<string, unknown>;
  } catch {
    return { tokenMint: { accepted: false, reason: 'NOTE_NOT_FOUND' } };
  }

  if (!Boolean(note?.isPublic)) return { tokenMint: { accepted: false, reason: 'NOTE_NOT_PUBLIC' } };
  if (!hasWriteAccess(note, creatorId)) return { tokenMint: { accepted: false, reason: 'FORBIDDEN' } };

  let tokenMint: Record<string, unknown> = { accepted: false, reason: 'MINT_FAILED' };
  try {
    const rawMint = await InternalKylrixTokenService.mintForActivity({
      userId: creatorId,
      idempotencyKey: `mint:share_public_note_moment:${momentId}`,
      activityType: 'share_public_note_moment',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'moment_share_note',
      sourceId: momentId,
      metadata: { noteId, momentId },
    });
    tokenMint = serializeTokenMintResult(rawMint);
  } catch (error: unknown) {
    tokenMint = { accepted: false, reason: String((error as { message?: string })?.message || 'MINT_FAILED') };
  }

  return { tokenMint };
}

export async function mintDailyLoginSecure(input: { userId: string; dateKey: string; jwt?: string }) {
  const actor = await getActor(input.jwt);
  if (!actor) throw new Error('Unauthorized');
  
  const userId = String(input?.userId || '').trim();
  const dateKey = String(input?.dateKey || '').trim();
  if (!userId || !dateKey) throw new Error('userId and dateKey are required');

  if (userId !== actor.$id && !isEnvAdminUser(actor)) {
    throw new Error('Forbidden');
  }

  try {
    return await InternalKylrixTokenService.mintForActivity({
        userId,
        idempotencyKey: `mint:daily_login:${dateKey}:${userId}`,
        activityType: 'daily_login',
        uniqueActors: 1,
        trustScore: 70,
        sourceType: 'daily_login',
        sourceId: dateKey,
    });
  } catch (err: any) {
    return { accepted: false, reason: err?.message || 'MINT_FAILED' };
  }
}

export async function sharePublicNoteAsMomentSecure(input: { noteId: string; text?: string; jwt?: string }) {
  const actor = await getActor(input.jwt);
  if (!actor) throw new Error('Unauthorized');

  const noteId = String(input?.noteId || '').trim();
  const text = String(input?.text || '').trim();
  if (!noteId) throw new Error('noteId is required');

  const tables = createSystemTablesDB();
  const note = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: noteId,
    });

  if (!Boolean(note?.isPublic)) throw new Error('Only public notes can be shared as moments');
  if (!hasWriteAccess(note, actor.$id)) throw new Error('Forbidden');

  const noteTitle = String(note?.title || 'Untitled Note').trim();
  const metadata = { type: 'post', attachments: [{ type: 'note', id: noteId }] };
  const now = new Date().toISOString();
  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const momentsTable = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
  const perms = [
    `read("user:${actor.$id}")`];

  const moment = await tables.createRow({
      databaseId: chatDb,
      tableId: momentsTable,
      rowId: ID.unique(),
      data: {
    userId: actor.$id,
    caption: text,
    type: 'image',
    momentKind: 'post',
    sourceId: null,
    searchTitle: noteTitle,
    fileId: JSON.stringify(metadata),
    createdAt: now,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
      permissions: perms,
    });

  let tokenMint: Record<string, unknown> = { accepted: false, reason: 'MINT_FAILED' };
  try {
    const rawMint = await InternalKylrixTokenService.mintForActivity({
      userId: actor.$id,
      idempotencyKey: `mint:share_public_note_moment:${moment.$id}`,
      activityType: 'share_public_note_moment',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'moment_share_note',
      sourceId: moment.$id,
      metadata: { noteId, momentId: moment.$id },
    });
    tokenMint = serializeTokenMintResult(rawMint);
  } catch (error: unknown) {
    tokenMint = { accepted: false, reason: String((error as { message?: string })?.message || 'MINT_FAILED') };
  }

  return {
    moment: serializeMomentRow(moment as Record<string, unknown>),
    tokenMint,
  };
}

type TokenAction =
  | 'state'
  | 'initialize'
  | 'mint_activity'
  | 'transfer'
  | 'ledger'
  | 'balance'
  | 'fine_to_root'
  | 'lock_claim'
  | 'settle_claim';

export async function runTokenOperationSecure(body: any) {
  const actor = await getActor();
  if (!actor) throw new Error('Unauthorized');
  
  const action = String(body?.action || '').trim() as TokenAction;
  const isSERVERSDK = isEnvSERVERSDKUser(actor);
  if (!action) throw new Error('action is required');

  if (action === 'state') return InternalKylrixTokenService.getState();
  if (action === 'initialize') {
    if (!isSERVERSDK) throw new Error('Forbidden');
    const state = await InternalKylrixTokenService.initializeState();
    return { initialized: true, state };
  }
  if (action === 'transfer') {
    const fromUserId = String(body?.fromUserId || '').trim();
    if (!isSERVERSDK && fromUserId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.transfer({
      fromUserId,
      toUserId: String(body?.toUserId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
      sourceType: String(body?.sourceType || 'transfer'),
      sourceId: String(body?.sourceId || ''),
      metadata: body?.metadata || undefined,
    });
  }
  if (action === 'ledger') {
    const userId = String(body?.userId || actor.$id || '').trim();
    if (!isSERVERSDK && userId !== actor.$id) throw new Error('Forbidden');
    const rows = await InternalKylrixTokenService.listUserLedger(userId, Number(body?.limit || 100));
    return { rows };
  }
  if (action === 'balance') {
    const userId = String(body?.userId || actor.$id || '').trim();
    if (!isSERVERSDK && userId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.getUserBalance(userId);
  }
  if (action === 'fine_to_root') {
    if (!isSERVERSDK) throw new Error('Forbidden');
    return InternalKylrixTokenService.fineToRoot({
      userId: String(body?.userId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
      reason: String(body?.reason || 'policy_violation'),
      sourceType: String(body?.sourceType || 'moderation'),
      sourceId: String(body?.sourceId || ''),
      metadata: body?.metadata || undefined,
    });
  }
  if (action === 'lock_claim') {
      return InternalKylrixTokenService.lockClaim({
          userId: actor.$id,
          amountMicro: String(body?.amountMicro || ''),
          destinationWallet: String(body?.destinationWallet || ''),
          chain: String(body?.chain || 'solana'),
          idempotencyKey: String(body?.idempotencyKey || ''),
      });
  }
  if (action === 'settle_claim') {
      if (!isSERVERSDK) throw new Error('Forbidden');
      return InternalKylrixTokenService.settleClaim({
          userId: String(body?.userId || ''),
          amountMicro: String(body?.amountMicro || ''),
          destinationWallet: String(body?.destinationWallet || ''),
          chain: String(body?.chain || 'solana'),
          onchainTxHash: String(body?.onchainTxHash || ''),
          idempotencyKey: String(body?.idempotencyKey || ''),
      });
  }
  if (action === 'mint_activity' && isSERVERSDK) {
      return InternalKylrixTokenService.mintForActivity({
          userId: String(body?.userId || ''),
          idempotencyKey: String(body?.idempotencyKey || ''),
          activityType: body?.activityType as any,
          uniqueActors: Number(body?.uniqueActors || 1),
          trustScore: Number(body?.trustScore || 70),
          sourceType: String(body?.sourceType || ''),
          sourceId: String(body?.sourceId || ''),
          metadata: body?.metadata,
      });
  }

  throw new Error('Unknown token action');
}

const VIEWER_COOKIE = 'kylrix_viewer_id';
const viewerSecret = () => String(process.env.VIEWER_TOKEN_SECRET || process.env.APPWRITE_API || 'kylrix-viewer-secret');
const signViewerToken = (payload: string) => createHmac('sha256', viewerSecret()).update(payload).digest('base64url');
const issueViewerToken = () => {
  const payload = `${Date.now()}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${signViewerToken(payload)}`;
};
const isViewerTokenValid = (token: string) => {
  const trimmed = String(token || '').trim();
  if (!trimmed) return false;
  const parts = trimmed.split('.');
  if (parts.length < 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return signViewerToken(payload) === parts[2];
};

export async function trackEngagementViewSecure(input: Omit<TrackEngagementInput, 'viewerKind' | 'viewerUserId' | 'viewerTokenHash'> & { ip?: string | null; userAgent?: string | null }) {
  const actor = await getActor();
  const store = await cookies();
  const existing = store.get(VIEWER_COOKIE)?.value || '';
  const token = isViewerTokenValid(existing) ? existing : issueViewerToken();
  if (token !== existing) {
    store.set(VIEWER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return trackEngagementView({
    ...input,
    viewerKind: actor?.$id ? 'user' : 'anon',
    viewerUserId: actor?.$id || null,
    viewerTokenHash: token,
  });
}

export async function cleanupStaleCallsSecure(input?: { userId?: string; callId?: string | null; cleanupAll?: boolean }) {
  const requester = await getActor();
  if (!requester) return { success: false, reason: 'Unauthorized' };

  const admin = isEnvAdminUser(requester);
  const targetUserId = String(input?.userId || requester.$id || '').trim();
  const callId = String(input?.callId || '').trim() || null;
  const cleanupAll = Boolean(input?.cleanupAll);

  const tables = createSystemTablesDB();
  const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

  if (cleanupAll && admin) {
    const rows = await tables.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
      Query.lessThan('expiresAt', new Date().toISOString()),
      Query.limit(500)],
    });
    for (const row of rows.rows) {
      await tables.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
    }
    return { deleted: rows.rows.length, callIds: rows.rows.map((row) => row.$id) };
  }

  if (targetUserId !== requester.$id && !admin && !callId) throw new Error('Forbidden');

  if (callId) {
    const call = await tables.getRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: callId,
    });
    if (String((call as any)?.userId || '') !== (admin ? (targetUserId || requester.$id) : requester.$id)) {
      throw new Error('Forbidden');
    }
    const result = await deleteCallIfExpired(tables as any, callId);
    const presenceUser = targetUserId || requester.$id;
    await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
    return result.deleted ? { deleted: 1, callIds: [callId] } : { deleted: 0, callIds: [] as string[] };
  }

  const expiredRows = await tables.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
    Query.equal('userId', targetUserId || requester.$id),
    Query.lessThan('expiresAt', new Date().toISOString()),
    Query.limit(200)],
    });
  for (const row of expiredRows.rows) {
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
  }
  const presenceUser = targetUserId || requester.$id;
  await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
  return { deleted: expiredRows.rows.length, callIds: expiredRows.rows.map((row) => row.$id) };
}

export async function getQuickProfileSecure(userId: string, jwt?: string) {
  const requester = await getActor(jwt);
  if (!requester?.$id) throw new Error('Unauthorized');
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) throw new Error('userId is required');

  const tables = createSystemTablesDB();
  const getProfile = async () => {
    try {
      const byUserId = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      queries: [Query.equal('userId', targetUserId), Query.limit(1)],
    });
      if (byUserId.rows[0]) return byUserId.rows[0];
    } catch {}
    try {
      return await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      rowId: targetUserId,
    });
    } catch {
      return null;
    }
  };

  const getWallets = async () => {
    const ownerId = `user:${targetUserId}`;
    const rows = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
      tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS,
      queries: [
        Query.equal('ownerId', ownerId),
        Query.equal('type', 'main'),
        Query.limit(50),
        Query.select(['$id', 'chain', 'address', 'type', 'updatedAt', '$updatedAt'])],
    });
    const dedupedByChain = new Map<string, any>();
    for (const row of rows.rows) {
      const chain = String((row as any).chain || '').trim().toLowerCase();
      const address = String((row as any).address || '').trim();
      if (!chain || !address) continue;
      if (!dedupedByChain.has(chain)) {
        dedupedByChain.set(chain, {
          chain,
          address,
          updatedAt: (row as any).updatedAt || row.$updatedAt || null,
        });
      }
    }
    return Array.from(dedupedByChain.values());
  };

  const [profile, wallets] = await Promise.all([getProfile(), getWallets()]);
  return {
    profile: profile
      ? {
          $id: profile.$id,
          userId: (profile as any).userId || profile.$id,
          username: (profile as any).username || null,
          displayName: (profile as any).displayName || null,
          bio: (profile as any).bio || null,
          avatar: (profile as any).avatar || null,
          tier: (profile as any).tier || null,
          publicKey: (profile as any).publicKey || null,
        }
      : null,
    wallets,
  };
}

export type PermissionLevel = 'viewer' | 'editor' | 'admin';

export interface PermissionChangeInput {
  userId: string;
  resourceId: string;
  resourceType: 'note' | 'task';
  resourceTitle: string;
  targetUserId: string;
  targetEmail?: string;
  permission: PermissionLevel;
  actorName: string;
  jwt?: string;
  skipEmail?: boolean;
}

export async function grantPermissionSecure(input: PermissionChangeInput) {
  const requester = await getActor(input.jwt);
  if (!requester) {
      console.error('[secure-ops] grantPermissionSecure: Actor null');
      throw new Error('Unauthorized');
  }

  const { client, users } = createSystemClient();
  const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  // 1. Grant physical READ permission only!
  await permissionsInternal('POST', {
    action: 'grant',
    permission: 'read',
    targetUserId: input.targetUserId,
    resourceId: input.resourceId,
    resourceType: input.resourceType === 'note' ? 'ghost_note' : 'task',
    databaseId: dbId,
    tableId: tableId,
    rowId: input.resourceId,
  }, requester.$id);

  // 2. Set the virtual permission level in metadata.collaborators
  if (input.resourceType === 'note') {
    const tables = createSystemTablesDB();
    const noteDoc = await tables.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
    let meta: any = {};
    try {
      meta = JSON.parse(noteDoc.metadata || '{}');
    } catch {}
    if (!meta.collaborators) {
      meta.collaborators = {};
    }
    meta.collaborators[input.targetUserId] = input.permission; // 'viewer' | 'editor' | 'admin'
    await tables.updateRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
      data: {
      metadata: JSON.stringify(meta)
    },
    });
  }

  // 3. Automated Email (Optional)
  if (!input.skipEmail) {
    let resolvedEmail = input.targetEmail;
    if (!resolvedEmail) {
      try {
        const targetUser = await users.get(input.targetUserId);
        resolvedEmail = targetUser.email;
      } catch (err) {
        console.warn('Failed to resolve target email for notification:', err);
      }
    }

    if (resolvedEmail) {
      await dispatchEmail({
        eventType: 'resource_shared',
        sourceApp: 'kylrix',
        actorName: input.actorName,
        recipientEmails: [resolvedEmail],
        resourceId: input.resourceId,
        resourceTitle: input.resourceTitle,
        resourceType: input.resourceType,
        rightsLabel: input.permission,
        templateKey: 'RESOURCE_SHARED_NOTIFY',
        metadata: {
          permissionType: input.permission,
          iconUrl: 'https://kylrix.space/logo.svg'
        }
      });
    }
  }

  return { success: true };
}

export async function revokePermissionSecure(input: {
    resourceId: string;
    resourceType: 'note' | 'task';
    targetUserId: string;
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : APPWRITE_CONFIG.TABLES.FLOW.TASKS;

    // 1. Physically revoke from row
    await permissionsInternal('POST', {
        action: 'revoke',
        targetUserId: input.targetUserId,
        resourceId: input.resourceId,
        resourceType: input.resourceType === 'note' ? 'ghost_note' : 'task',
        databaseId: dbId,
        tableId: tableId,
        rowId: input.resourceId,
    }, requester.$id);

    // 2. Remove virtual permission from metadata
    if (input.resourceType === 'note') {
        const tables = createSystemTablesDB();
        const noteDoc = await tables.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
        let meta: any = {};
        try {
            meta = JSON.parse(noteDoc.metadata || '{}');
        } catch {}
        if (meta.collaborators) {
            delete meta.collaborators[input.targetUserId];
            await tables.updateRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
      data: {
                metadata: JSON.stringify(meta)
            },
    });
        }
    }

    return { success: true };
}

/**
 * Parses user IDs and their highest permission level from Appwrite strings.
 */
function extractCollaboratorsFromPermissions(permissions: string[]): Array<{ userId: string, level: string }> {
    const userMap = new Map<string, Set<string>>();
    const userRegex = /^(read|update|delete)\("user:([^"]+)"\)$/;
    
    for (const perm of permissions) {
        const match = perm.match(userRegex);
        if (match) {
            const [ type, userId] = match;
            if (!userMap.has(userId)) userMap.set(userId, new Set());
            userMap.get(userId)!.add(type);
        }
    }
    
    return Array.from(userMap.entries()).map(([userId, types]) => {
        let level = 'viewer';
        if (types.has('delete')) level = 'admin';
        else if (types.has('update')) level = 'editor';
        return { userId, level };
    });
}

export async function getResourceCollaboratorsSecure(input: {
    resourceId: string;
    resourceType: 'note' | 'task';
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : APPWRITE_CONFIG.TABLES.FLOW.TASKS;

    const tables = createSystemTablesDB();
    const doc = await tables.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
    
    let filteredCollabs: Array<{ userId: string, level: string }> = [];
    
    if (input.resourceType === 'note') {
        let meta: any = {};
        try {
            meta = JSON.parse(doc.metadata || '{}');
        } catch {}
        const collaboratorsMap = meta.collaborators || {};
        filteredCollabs = Object.entries(collaboratorsMap).map(([userId, level]) => ({
            userId,
            level: String(level)
        }));
    } else {
        // Fallback for tasks
        const rawPermissions = doc.$permissions || [];
        const collabMeta = extractCollaboratorsFromPermissions(rawPermissions);
        const ownerId = String((doc as any).userId || '').trim();
        filteredCollabs = collabMeta.filter(c => c.userId !== ownerId && c.userId !== requester.$id);
    }

    if (filteredCollabs.length === 0) return { collaborators: [] };

    // 3. Hydrate profiles
    const { UsersService } = await import('@/lib/services/users');
    const collaborators = await Promise.all(
        filteredCollabs.map(async (collab) => {
            const p = await UsersService.getProfileById(collab.userId);
            if (!p) return null;
            return {
                $id: p.$id,
                userId: p.userId || p.$id,
                username: p.username,
                displayName: p.displayName,
                avatar: p.avatar || p.profilePicId || null,
                tier: p.tier,
                verified: p.tier === 'admin' || p.verified,
                permissionLevel: collab.level
            };
        })
    );

    return { collaborators: collaborators.filter(Boolean) };
}

export async function createNoteSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const { 
    cleanDocumentData, 
    filterNoteData, 
    getNotePermissions,
    createNoteCreationService,
  } = await import('@/lib/appwrite/note');

  const syncTags = async ({ noteId, rawTags, userId, now }: any) => {
    try {
      const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsCollection = APPWRITE_TABLE_ID_TAGS;
      const unique = Array.from(new Set(rawTags.map((tag: any) => tag.trim()))).filter(Boolean) as string[];
      if (!unique.length) return;

      const existingTagDocs: Record<string, any> = {};
      try {
        const existingTagsRes = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', unique.map((tag: any) => tag.toLowerCase())), Query.limit(unique.length)] as any,
    });
        for (const td of existingTagsRes.rows as any[]) {
          if (td.nameLower) existingTagDocs[td.nameLower] = td;
        }
      } catch (tagListErr) {
        console.error('tag preload failed on server', tagListErr);
      }

      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        if (!existingTagDocs[key]) {
          try {
            const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 },
    });
            existingTagDocs[key] = created;
          } catch (createTagErr: any) {
            try {
              const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
              if (retry.rows.length) existingTagDocs[key] = retry.rows[0];
            } catch {}
          }
        }
      }

      const existingPivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      queries: [Query.equal('noteId', noteId), Query.limit(500)] as any,
    });
      const existingPairs = new Set(existingPivot.rows.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        const tagDoc = existingTagDocs[key];
        const tagId = tagDoc ? (tagDoc.$id || tagDoc.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        
        try {
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      queries: [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tDoc: any = res.rows[0];
            const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      rowId: tDoc.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        if (existingPairs.has(pairKey)) continue;
        try {
          await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      rowId: ID.unique(),
      data: { noteId, tagId, tag: tagName, userId, createdAt: now },
    });
        } catch (e: any) {
          console.error('note_tags create failed on server', e?.message || e);
        }
      }
    } catch (e: any) {
      console.error('dual-write note_tags error on server', e);
    }
  };

  const noteCreationServiceServer = createNoteCreationService({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    getCurrentUser: async () => ({ $id: actor.$id }),
    createRow: async (databaseId, tableId, data, rowId, permissions) => {
      return tables.createRow({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId || ID.unique(),
      data: data as any,
      permissions: permissions,
    }) as any;
    },
    getNote: async (noteId) => {
      const doc = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
    }) as any;
      try {
        const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const pivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      queries: [Query.equal('noteId', noteId), Query.limit(200)] as any,
    });
        if (pivot.rows.length) {
          const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
          (doc as any).tags = tags;
        }
      } catch {}
      if (!doc.attachments || !Array.isArray(doc.attachments)) {
        doc.attachments = [];
      }
      return doc;
    },
    getNotePermissions,
    cleanDocumentData,
    filterNoteData,
    syncTags,
  });

  const note = await noteCreationServiceServer.createNote(data);
  return JSON.parse(JSON.stringify(note));
}

/**
 * Generic Modular Permission Checker Engine
 * Handles multiple systems for securely carrying out actions.
 * Tightly coupled to:
 * - Create: Tied mathematically to current user (ownerId === actorId)
 * - Update: Current user or collaborator with 'editor'/'admin' level from metadata setting
 * - Delete: Current user or collaborator with 'admin' level from metadata setting
 * - Read (Publicity): Checks metadata fields if publicity is enabled (isPublic is true)
 */
export async function verifyResourcePermissionSecure(params: {
  databaseId?: string;
  collectionId?: string;
  documentId?: string;
  actorId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  ownerFields?: string[];
  metadataField?: string;
  data?: any;
}) {
  const { databaseId, collectionId, documentId, actorId, action, ownerFields = ['userId', 'ownerId'], metadataField = 'metadata', data } = params;
  
  let doc = data;
  if (!doc && databaseId && collectionId && documentId) {
    doc = await getRowCached({
      databaseId: databaseId,
      tableId: collectionId,
      rowId: documentId,
    });
  }

  if (!doc) {
    return false;
  }
  
  let isOwner = false;
  for (const field of ownerFields) {
    const val = String(doc[field] || '').trim();
    if (val && val === actorId) {
      isOwner = true;
      break;
    }
  }

  if (isOwner) {
    return true;
  }

  if (action === 'create') {
    // For create operations, if the user is not the owner (isOwner is false), they cannot create it.
    // This mathematically ties the create operation strictly to the current user.
    return false;
  }

  let meta: any = {};
  try {
    const rawMeta = doc[metadataField];
    meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta || {};
  } catch {}

  const collaborators = meta.collaborators || {};
  const userRole = collaborators[actorId];

  if (action === 'read') {
    const isPublic = doc.isPublic === true || String(doc.isPublic) === 'true' ||
                     (collectionId !== APPWRITE_CONFIG.TABLES.NOTE.NOTES && (
                       meta.isPublic === true || String(meta.isPublic) === 'true' ||
                       meta.publicity === true || String(meta.publicity) === 'true'
                     ));
    if (isPublic) {
      return true;
    }
    if (userRole) {
      return ['viewer', 'editor', 'admin'].includes(userRole);
    }
    return false;
  }

  if (action === 'update') {
    if (userRole) {
      return ['editor', 'admin'].includes(userRole);
    }
    return false;
  }

  if (action === 'delete') {
    if (userRole) {
      return userRole === 'admin';
    }
    return false;
  }

  return false;
}

async function verifyNotePermission(noteId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    collectionId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    documentId: noteId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId'],
    metadataField: 'metadata',
  });
}

export async function updateNoteSecure(noteId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this note');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const { 
    cleanDocumentData, 
    filterNoteData, 
    getNotePermissions,
  } = await import('@/lib/appwrite/note');

  const cleanData = cleanDocumentData(data);
  const updatedAt = new Date().toISOString();
  const updatedData = filterNoteData({ ...cleanData, updatedAt: updatedAt });

  let permissions = undefined;
  if (data.isPublic !== undefined) {
    permissions = getNotePermissions(actor.$id, !!data.isPublic);
  }

  const doc = await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
      data: updatedData,
      permissions: permissions,
    }) as any;

  try {
    if (Array.isArray((data as any).tags)) {
      const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsCollection = APPWRITE_TABLE_ID_TAGS;
      const incomingRaw: string[] = (data as any).tags.filter(Boolean).map((t: string) => t.trim());
      const normalizedIncoming = Array.from(new Set(incomingRaw)).filter(Boolean);
      const incomingSet = new Set(normalizedIncoming);

      const tagDocs: Record<string, any> = {};
      if (normalizedIncoming.length) {
        try {
          const existingTagsRes = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', normalizedIncoming.map(t => t.toLowerCase())), Query.limit(normalizedIncoming.length)] as any,
    });
          for (const td of existingTagsRes.rows as any[]) {
            if (td.nameLower) tagDocs[td.nameLower] = td;
          }
        } catch (preErr) {
          console.error('updateNoteSecure tag preload failed', preErr);
        }
        for (const tagName of normalizedIncoming) {
          const key = tagName.toLowerCase();
          if (!tagDocs[key]) {
            try {
              const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId: actor.$id, createdAt: updatedAt, usageCount: 0 },
    });
              tagDocs[key] = created;
            } catch (createErr) {
              try {
                const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsCollection,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
                if (retry.rows.length) tagDocs[key] = retry.rows[0];
              } catch {}
            }
          }
        }
      }

      const existingPivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      queries: [Query.equal('noteId', noteId), Query.limit(500)] as any,
    });
      const existingByTag: Record<string, any> = {};
      const existingPairs = new Set<string>();
      for (const p of existingPivot.rows as any[]) {
        if (p.tag) existingByTag[p.tag] = p;
        if (p.tagId && p.tag) existingPairs.add(`${p.tagId}::${p.tag}`);
      }

      for (const p of existingPivot.rows as any[]) {
        if (!p.tagId && p.tag) {
          const key = p.tag.toLowerCase();
          const tagDoc = tagDocs[key];
          if (tagDoc) {
            try {
              await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      rowId: p.$id,
      data: { tagId: tagDoc.$id || tagDoc.id },
    });
              existingPairs.add(`${tagDoc.$id || tagDoc.id}::${p.tag}`);
            } catch (patchErr) {
              console.error('legacy pivot patch failed in updateNoteSecure', patchErr);
            }
          }
        }
      }

      for (const tagName of normalizedIncoming) {
        const key = tagName.toLowerCase();
        const tagDoc = tagDocs[key];
        const tagId = tagDoc ? (tagDoc.$id || tagDoc.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        if (existingPairs.has(pairKey)) continue;

        try {
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tDoc: any = res.rows[0];
            const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tDoc.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        try {
          await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      rowId: ID.unique(),
      data: { noteId, tagId, tag: tagName, userId: actor.$id, createdAt: updatedAt },
    });
          existingPairs.add(pairKey);
        } catch (ie) {
          console.error('note_tags create (updateNoteSecure) failed', ie);
        }
      }

      for (const [tagName, pivotDoc] of Object.entries(existingByTag)) {
        if (!incomingSet.has(tagName)) {
          try {
            const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
            if (res.rows.length) {
              const tDoc: any = res.rows[0];
              const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
              await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tDoc.$id,
      data: { usageCount: Math.max(0, current - 1) },
    });
            }
          } catch {}

          try {
            await tables.deleteRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsCollection,
      rowId: (pivotDoc as any).$id,
    });
          } catch (de) {
            console.error('note_tags stale delete failed in updateNoteSecure', de);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('dual-write note_tags update error in updateNoteSecure', e);
  }

  return JSON.parse(JSON.stringify(doc));
}

export async function deleteNoteSecure(noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this note');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;

  try {
    await executeCascadeDeleteSecure(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId);
  } catch (err: any) {
    console.error('deleteNoteSecure cascade cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
    });
  return JSON.parse(JSON.stringify(result));
}

// ==========================================
// PROJECT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyProjectPermission(projectId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    collectionId: 'projects',
    documentId: projectId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['ownerId', 'userId'],
    metadataField: 'metadata',
  });
}

export async function createProjectSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.ownerId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['ownerId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const now = new Date().toISOString();
  const permissions = [
    Permission.read(Role.user(actor.$id))];

  const project = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: ID.unique(),
      data: {
      ...data,
      ownerId: actor.$id,
      createdAt: now,
      updatedAt: now,
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(project));
}

export async function updateProjectSecure(projectId: string, data: any, permissions?: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this project');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const now = new Date().toISOString();
  
  const project = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      ...data,
      updatedAt: now,
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(project));
}

export async function deleteProjectSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this project');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // Cascade delete all object links
  try {
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.CHAT, 'projects', projectId);
  } catch (err: any) {
    console.error('deleteProjectSecure cascade objects cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  return JSON.parse(JSON.stringify(result));
}

export async function addProjectCollaboratorSecure(projectId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // 1. Fetch current project to update permissions
  const project = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  // Update physical permissions: add READ permission only
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${targetUserId}")`);

  // Update virtual level in metadata
  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}
  if (!metadata.collaborators) {
    metadata.collaborators = {};
  }
  metadata.collaborators[targetUserId] = permissionLevel;

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      metadata: JSON.stringify(metadata),
    },
      permissions: Array.from(newPermissions),
    });

  // 2. Add object link in project_objects (if not already exists)
  const existingObjects = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
      Query.equal('projectId', projectId),
      Query.equal('entityKind', 'collaborator'),
      Query.equal('entityId', targetUserId)] as any,
    });

  let objLink;
  const now = new Date().toISOString();
  if (existingObjects.rows.length > 0) {
    // Update existing
    objLink = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: existingObjects.rows[0].$id,
      data: {
        role: permissionLevel,
        updatedAt: now,
      },
    });
  } else {
    // Create new project_objects row
    const objectPermissions = [
      Permission.read(Role.user(actor.$id)),
      Permission.read(Role.user(targetUserId))];
    objLink = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: ID.unique(),
      data: {
        projectId,
        entityKind: 'collaborator',
        entityId: targetUserId,
        role: permissionLevel,
        createdAt: now,
        updatedAt: now,
      },
      permissions: objectPermissions,
    });
  }

  return JSON.parse(JSON.stringify(objLink));
}

export async function removeProjectCollaboratorSecure(projectId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // 1. Fetch current project to update permissions
  const project = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  // Remove physical read permission
  const rawPermissions = project.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  // Remove from metadata.collaborators
  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}
  if (metadata.collaborators) {
    delete metadata.collaborators[targetUserId];
  }

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      metadata: JSON.stringify(metadata),
    },
      permissions: updatedPerms,
    });

  // 2. Remove all collaborator objects from project_objects
  try {
    const objects = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', targetUserId)] as any,
    });
    await Promise.all(
      objects.rows.map((obj) =>
        tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: obj.$id,
    })
      )
    );
  } catch (err) {
    console.error('removeProjectCollaboratorSecure objects cleanup failed:', err);
  }

  return { success: true };
}

export async function addObjectToProjectSecure(
  projectId: string,
  entityKind: string,
  entityId: string,
  role?: string,
  metadata?: any,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage objects in this project');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const now = new Date().toISOString();

  const permissions = [
    Permission.read(Role.user(actor.$id))];

  const obj = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: ID.unique(),
      data: {
      projectId,
      entityKind,
      entityId,
      role: role || 'member',
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      createdAt: now,
      updatedAt: now,
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(obj));
}

export async function removeObjectFromProjectSecure(objectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const obj = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: objectId,
    });

  const projectId = obj.projectId;
  const isOwner = obj.$permissions?.some((p: string) => p.includes(actor.$id));
  const isProjectAdmin = await verifyProjectPermission(projectId, actor.$id, 'admin').catch(() => false);

  if (!isOwner && !isProjectAdmin) {
    throw new Error('Forbidden: Insufficient permissions to remove this object from the project');
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: objectId,
    });

  return JSON.parse(JSON.stringify(result));
}

// ==========================================
// FORM COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyFormPermission(formId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    collectionId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    documentId: formId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId'],
    metadataField: 'settings',
  });
}

export async function createFormSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.read(Role.any()), // Allow public discovery via listRows filter
    ];

  const form = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: ID.unique(),
      data: {
      ...data,
      userId: actor.$id,
      status: data.status || 'draft',
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(form));
}

export async function updateFormSecure(formId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this form');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  const ownerId = form.userId;
  const currentStatus = data.status || form.status;

  const permissions = [
    Permission.read(Role.user(ownerId))];

  if (currentStatus === 'published') {
    permissions.push(Permission.read(Role.any()));
  }

  // Include physical read permissions for collaborators in the new permissions set
  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (settings.collaborators) {
    Object.keys(settings.collaborators).forEach((userId) => {
      permissions.push(Permission.read(Role.user(userId)));
    });
  }

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: data,
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function deleteFormSecure(formId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this form');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  try {
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, formId);
  } catch (err: any) {
    console.error('deleteFormSecure cascade cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  return JSON.parse(JSON.stringify(result));
}

export async function addFormCollaboratorSecure(formId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (!settings.collaborators) {
    settings.collaborators = {};
  }
  settings.collaborators[targetUserId] = permissionLevel;

  const permissions = new Set(form.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: {
      settings: JSON.stringify(settings),
    },
      permissions: Array.from(permissions),
    });

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function removeFormCollaboratorSecure(formId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (settings.collaborators) {
    delete settings.collaborators[targetUserId];
  }

  const rawPermissions = form.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: {
      settings: JSON.stringify(settings),
    },
      permissions: updatedPerms,
    });

  return JSON.parse(JSON.stringify(updatedForm));
}

// ==========================================
// EVENT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyEventPermission(eventId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });
  
  const ownerId = String(event.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has full permissions
  }

  // A. Check polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', actorId),
        Query.limit(1),
      ] as any,
    });
    if (collabsRes.rows.length > 0) {
      const collab = collabsRes.rows[0];
      const p = collab.permission; // 'read' | 'write' | 'admin'
      if (minLevel === 'viewer') {
        if (['read', 'write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'editor') {
        if (['write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'admin') {
        if (p === 'admin') return true;
      }
    }
  } catch (err) {
    console.error('[verifyEventPermission] Polymorphic query failed:', err);
  }

  // B. Fallback to legacy guests table check
  const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', actorId),
      Query.limit(1)
    ] as any,
    });

  if (guestsRes.rows.length === 0) return false;

  const guest = guestsRes.rows[0];
  const role = String(guest.role || '').trim(); // e.g. 'manager-viewer', 'manager-editor', 'manager-admin'

  if (!role.startsWith('manager-')) return false;

  const managerLevel = role.replace('manager-', ''); // 'viewer' | 'editor' | 'admin'

  if (minLevel === 'viewer') {
    return ['viewer', 'editor', 'admin'].includes(managerLevel);
  }
  if (minLevel === 'editor') {
    return ['editor', 'admin'].includes(managerLevel);
  }
  if (minLevel === 'admin') {
    return managerLevel === 'admin';
  }
  return false;
}

export async function createEventSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const permissions = [
    Permission.read(Role.user(actor.$id))];

  const event = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: ID.unique(),
      data: {
      ...data,
      userId: actor.$id,
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(event));
}

export async function updateEventSecure(eventId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this event');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  const ownerId = event.userId;
  const permissions = [
    Permission.read(Role.user(ownerId))];

  // Include physical read permissions for all manager guests
  try {
    const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [Query.equal('eventId', eventId)] as any,
    });
    guestsRes.rows.forEach((g: any) => {
      if (g.userId && String(g.role || '').startsWith('manager-')) {
        permissions.push(Permission.read(Role.user(g.userId)));
      }
    });
  } catch (err) {
    console.error('Failed to query manager physical read permissions in updateEventSecure', err);
  }

  const updatedEvent = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: data,
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(updatedEvent));
}

export async function deleteEventSecure(eventId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this event');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // Cascade delete guests
  try {
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, eventId);
  } catch (err: any) {
    console.error('deleteEventSecure cascade guests cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  return JSON.parse(JSON.stringify(result));
}

export async function addEventManagerSecure(eventId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // 1. Fetch current event to update permissions
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  // Update physical permissions: add READ permission only
  const permissions = new Set(event.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: Array.from(permissions),
    });

  // 2. Add or update Guest entry
  const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', targetUserId)] as any,
    });

  const virtualRole = `manager-${permissionLevel}`;
  let guestDoc;
  if (guestsRes.rows.length > 0) {
    // Update role
    guestDoc = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: guestsRes.rows[0].$id,
      data: {
        role: virtualRole,
      },
    });
  } else {
    // Create new
    guestDoc = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: ID.unique(),
      data: {
        eventId,
        userId: targetUserId,
        role: virtualRole,
        status: 'attending',
      },
    });
  }

  // 3. Polyfill/Primary write to polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const existingCollab = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', targetUserId),
        Query.limit(1),
      ] as any,
    });

    const permission = permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read');

    if (existingCollab.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existingCollab.rows[0].$id,
        data: {
          permission,
          invitedAt: existingCollab.rows[0].invitedAt || new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'manager',
        },
      });
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: eventId,
          resourceType: 'event',
          userId: targetUserId,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'manager',
        },
      });
    }
  } catch (err) {
    console.error('[Event secure action] Polymorphic write failed:', err);
  }

  return JSON.parse(JSON.stringify(guestDoc));
}

export async function removeEventManagerSecure(eventId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  // 1. Fetch current event to update permissions
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  // Remove physical read permission
  const rawPermissions = event.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: updatedPerms,
    });

  // 2. Remove Guest entry if it was a manager
  try {
    const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
        Query.equal('eventId', eventId),
        Query.equal('userId', targetUserId)] as any,
    });
    await Promise.all(
      guestsRes.rows.map((g: any) => {
        if (String(g.role || '').startsWith('manager-')) {
          return tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: g.$id,
    });
        }
        return Promise.resolve();
      })
    );
  } catch (err) {
    console.error('removeEventManagerSecure cleanup failed:', err);
  }

  // 3. Remove entry from polymorphic whisperrflow.Collaborators table
  try {
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', targetUserId),
      ] as any,
    });
    await Promise.all(
      collabsRes.rows.map((row: any) =>
        tables.deleteRow({
          databaseId: FLOW_DATABASE_ID,
          tableId: COLLABORATORS_TABLE,
          rowId: row.$id,
        })
      )
    );
  } catch (err) {
    console.error('[Event secure action] Polymorphic delete failed:', err);
  }

  return { success: true };
}

// ==========================================
// CALLS & HUDDLES COHOST SECURE ACTIONS
// ==========================================

export async function addCallCohostSecureAction(callId: string, cohostId: string, allowEndCall: boolean = false, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  if (ownerId !== actor.$id) {
    throw new Error('Forbidden: Only the call host can manage co-hosts');
  }

  let meta: any = {};
  try {
    meta = JSON.parse(call.metadata || '{}');
  } catch {}
  if (!meta.cohosts) {
    meta.cohosts = {};
  }
  meta.cohosts[cohostId] = { allowDelete: allowEndCall };

  // Sync to participantIds array in call metadata just in case
  if (Array.isArray(meta.participantIds)) {
    if (!meta.participantIds.includes(cohostId)) {
      meta.participantIds.push(cohostId);
    }
  }

  // Physially add read permission only
  const permissions = new Set(call.$permissions || []);
  permissions.add(`read("user:${cohostId}")`);

  const updatedCall = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
      data: {
      metadata: JSON.stringify(meta),
    },
      permissions: Array.from(permissions),
    });

  // Polyfill to polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const existing = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', callId),
        Query.equal('resourceType', 'call'),
        Query.equal('userId', cohostId),
        Query.limit(1),
      ] as any,
    });

    const permission = allowEndCall ? 'admin' : 'write';

    if (existing.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existing.rows[0].$id,
        data: {
          permission,
          invitedAt: existing.rows[0].invitedAt || new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'cohost',
        },
      });
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: callId,
          resourceType: 'call',
          userId: cohostId,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'cohost',
        },
      });
    }
  } catch (err) {
    console.error('[Cohost secure action] Polymorphic write failed:', err);
  }

  return JSON.parse(JSON.stringify(updatedCall));
}

export async function endCallSecureAction(callId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  if (!isAllowed) {
    // A. Check polymorphic Collaborators table
    try {
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.rows.length > 0) {
        const collab = collabsRes.rows[0];
        if (collab.permission === 'admin' && collab.role === 'cohost') {
          isAllowed = true;
        }
      }
    } catch (err) {
      console.error('[endCallSecureAction] Polymorphic query failed:', err);
    }
  }

  if (!isAllowed) {
    let meta: any = {};
    try {
      meta = JSON.parse(call.metadata || '{}');
    } catch {}
    const cohosts = meta.cohosts || {};
    const cohostSettings = cohosts[actor.$id];
    if (cohostSettings && cohostSettings.allowDelete) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to end this call');
  }

  try {
    await executeCascadeDeleteSecure(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      callId
    );
  } catch (err: any) {
    console.error('endCallSecureAction cascade cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  return JSON.parse(JSON.stringify(result));
}

export async function updateCallMetadataSecureAction(callId: string, extraMetadata: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  if (!isAllowed) {
    try {
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.rows.length > 0 && collabsRes.rows[0].role === 'cohost') {
        isAllowed = true;
      }
    } catch (err) {
      console.error('[updateCallSecureAction] Polymorphic query failed:', err);
    }
  }

  if (!isAllowed) {
    let meta: any = {};
    try {
      meta = JSON.parse(call.metadata || '{}');
    } catch {}
    const cohosts = meta.cohosts || {};
    if (cohosts[actor.$id]) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this call');
  }

  let currentMeta: any = {};
  try {
    currentMeta = JSON.parse(call.metadata || '{}');
  } catch {}

  const mergedMeta = {
    ...currentMeta,
    ...extraMetadata,
  };

  const updatedCall = await tables.updateRow({

      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
      data: {
      metadata: JSON.stringify(mergedMeta),
    },
    });

  return JSON.parse(JSON.stringify(updatedCall));
}

export async function createCallSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const now = new Date().toISOString();

  const permissions = [];
  if (data.allowGuests) {
    permissions.push(`read("any")`);
  } else {
    permissions.push(`read("users")`);
  }
  permissions.push(`read("user:${actor.$id}")`);
  permissions.push(`update("user:${actor.$id}")`);
  permissions.push(`delete("user:${actor.$id}")`);

  const payload = {
    userId: actor.$id,
    type: data.type || 'video',
    expiresAt: data.expiresAt || new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    startsAt: data.startsAt || now,
    title: data.title || undefined,
    metadata: data.metadata || undefined,
    conversationId: data.conversationId || undefined,
  };

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    rowId: ID.unique(),
    data: payload,
    permissions,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteSecure(data: {
  title: string;
  content: string;
  format?: string;
  ghostSecret: string;
  expiresAt?: string;
  isEncrypted?: boolean;
  creatorDeletionProofHash?: string;
}) {
  const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    ghostSecret: data.ghostSecret,
    expiresAt: expiresAt,
    version: 'v2',
    isEncrypted: data.isEncrypted || false,
    ...(data.creatorDeletionProofHash ? { creatorDeletionProofHash: data.creatorDeletionProofHash } : {}),
  });

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: data.title,
      content: data.content,
      format: data.format || 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
    },
    permissions: [`read("any")`],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createSendGhostObjectSecure(data: {
  title: string;
  content: string;
  format?: string;
  ghostSecret: string;
  expiresAt?: string;
  isEncrypted?: boolean;
  creatorDeletionProofHash?: string;
  sendObject: { kind: string; bucketId?: string; fileId?: string };
}) {
  const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    send_object: data.sendObject,
    ghostSecret: data.ghostSecret,
    expiresAt,
    version: 'v2',
    isEncrypted: data.isEncrypted ?? false,
    ...(data.creatorDeletionProofHash ? { creatorDeletionProofHash: data.creatorDeletionProofHash } : {}),
  });

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: data.title,
      content: data.content,
      format: data.format || 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
    },
    permissions: [`read("any")`],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteForCallSecure(callId: string, title?: string, jwt?: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedSource: 'call',
    linkedTaskId: callId,
    expiresAt: expiresAt,
    version: 'v2',
  });

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: title || 'Call Chat',
      content: '',
      format: 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
    },
    permissions: [`read("any")`],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function getIsSpecializedTable(tableId: string): Promise<boolean> {
  return (
    tableId === APPWRITE_CONFIG.TABLES.FLOW.GUESTS || 
    tableId === 'Collaborators' || 
    tableId === 'collaborators' ||
    tableId === 'formSubmissions' ||
    tableId === 'wallets' ||
    tableId === 'walletMap' ||
    tableId === 'follows' ||
    tableId === 'activityLog'
  );
}

export async function createRowSecure(
  databaseId: string,
  tableId: string,
  data: any,
  permissions?: string[],
  jwt?: string
) {
  // 1. Check if it's an anonymous-friendly form submission
  let isAnonymousFormSubmission = false;
  if (tableId === 'formSubmissions' && data && data.formId) {
    try {
      const tables = createSystemTablesDB();
      const form = await tables.getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
        rowId: data.formId,
      });
      if (form && form.status === 'published') {
        let settings: any = {};
        try {
          settings = JSON.parse(form.settings || '{}');
        } catch (_) {}
        if (settings.allowAnonymousFill) {
          isAnonymousFormSubmission = true;
        }
      }
    } catch (e) {
      console.warn('[createRowSecure] Failed to check form for anonymous fill:', e);
    }
  }

  // 2. Fetch actor
  let actor: any = null;
  if (!isAnonymousFormSubmission) {
    actor = await getActor(jwt);
    if (!actor || !actor.$id) throw new Error('Unauthorized');
  } else {
    try {
      actor = await getActor(jwt);
    } catch (_) {}
  }

  // 3. Security checks and payload preparation
  if (data && typeof data === 'object') {
    const isSpecializedTable = await getIsSpecializedTable(tableId);

    if (!isSpecializedTable) {
      if (data.userId && data.userId !== actor.$id) {
        throw new Error('Forbidden: Cannot create resource for another user');
      }
      if (data.ownerId && data.ownerId !== actor.$id) {
        throw new Error('Forbidden: Cannot create resource for another user');
      }
      if (!data.userId && !data.ownerId) {
        data.userId = actor.$id;
      }
    } else {
      // Specialized Table Policies on creation
      if (tableId === 'Collaborators' || tableId === 'collaborators') {
        const noteIdStr = String(data.noteId || '');
        if (noteIdStr.startsWith('task:')) {
          const taskId = noteIdStr.replace('task:', '');
          const isAllowed = await verifyResourcePermissionSecure({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            collectionId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
            documentId: taskId,
            actorId: actor.$id,
            action: 'update',
          });
          if (!isAllowed) throw new Error('Forbidden: Insufficient permissions on parent task');
        }
      } else if (tableId === 'formSubmissions') {
        let metadata: any = {};
        try {
          metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata || {};
        } catch (_) {}
        if (metadata.isDraft) {
          if (!actor || !actor.$id) throw new Error('Unauthorized: Drafts require authentication');
          if (data.submitterId && data.submitterId !== actor.$id) {
            throw new Error('Forbidden: Cannot create draft for another user');
          }
          data.submitterId = actor.$id;
        } else {
          // It's a real submission
          if (actor && actor.$id) {
            if (data.submitterId && data.submitterId !== actor.$id) {
              throw new Error('Forbidden: Submitter ID must match authenticated actor');
            }
            data.submitterId = actor.$id;
          } else {
            // Anonymous Submission
            if (!isAnonymousFormSubmission) {
              throw new Error('Unauthorized: Authentication required for this form');
            }
            data.submitterId = null;
          }
        }
      } else if (tableId === 'wallets') {
        if (data.ownerId && data.ownerId !== `user:${actor.$id}`) {
          throw new Error('Forbidden: Cannot create wallet for another user');
        }
        data.ownerId = `user:${actor.$id}`;
      } else if (tableId === 'walletMap') {
        if (data.userId && data.userId !== actor.$id) {
          throw new Error('Forbidden: Cannot map wallet for another user');
        }
        data.userId = actor.$id;
      } else if (tableId === 'follows') {
        if (data.followerId && data.followerId !== actor.$id) {
          throw new Error('Forbidden: Cannot follow user as someone else');
        }
        data.followerId = actor.$id;
      } else if (tableId === 'activityLog') {
        if (!actor && !isAnonymousFormSubmission) {
          throw new Error('Unauthorized: Notification logging requires an active session');
        }
      }
    }
  }

  const tables = createSystemTablesDB();
  // Setup permissions
  let perms = permissions;
  if (!perms) {
    if (actor && actor.$id) {
      perms = [Permission.read(Role.user(actor.$id))];
    } else {
      let formOwnerId: string | null = null;
      if (data && data.formId) {
        try {
          const form = await tables.getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            rowId: data.formId,
          });
          formOwnerId = form?.userId || null;
        } catch (_) {}
      }
      perms = formOwnerId ? [Permission.read(Role.user(formOwnerId))] : [];
    }
  }
  
  const customRowId = (data && data.$id) ? String(data.$id) : ID.unique();
  const dataCopy = data ? { ...data } : {};
  if (dataCopy.$id) {
    delete dataCopy.$id;
  }

  const result = await tables.createRow({
    databaseId,
    tableId,
    rowId: customRowId,
    data: dataCopy,
    permissions: perms,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function updateRowSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  data: any,
  permissions?: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  let isAllowed = false;
  const isSpecializedTable = await getIsSpecializedTable(tableId);

  if (isSpecializedTable) {
    const existingRow = await getRowCached({ databaseId, tableId, rowId });

    if (tableId === 'Collaborators' || tableId === 'collaborators') {
      const noteIdStr = String(existingRow?.noteId || '');
      if (noteIdStr.startsWith('task:')) {
        const taskId = noteIdStr.replace('task:', '');
        isAllowed = await verifyResourcePermissionSecure({
          databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
          collectionId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          documentId: taskId,
          actorId: actor.$id,
          action: 'update',
        });
      } else {
        isAllowed = true;
      }
    } else if (tableId === 'formSubmissions') {
      const isSubmitter = existingRow?.submitterId === actor.$id;
      if (isSubmitter) {
        isAllowed = true;
      } else {
        const parentFormId = existingRow?.formId;
        if (parentFormId) {
          isAllowed = await verifyResourcePermissionSecure({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            collectionId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            documentId: parentFormId,
            actorId: actor.$id,
            action: 'update',
          });
        }
      }
    } else if (tableId === 'wallets') {
      isAllowed = existingRow?.ownerId === `user:${actor.$id}`;
    } else if (tableId === 'walletMap') {
      isAllowed = existingRow?.userId === actor.$id;
    } else if (tableId === 'follows') {
      isAllowed = existingRow?.followerId === actor.$id || existingRow?.followingId === actor.$id;
    } else if (tableId === 'activityLog') {
      isAllowed = existingRow?.userId === actor.$id;
    } else {
      isAllowed = true;
    }
  } else {
    isAllowed = await verifyResourcePermissionSecure({
      databaseId,
      collectionId: tableId,
      documentId: rowId,
      actorId: actor.$id,
      action: 'update',
      data,
    });
  }

  if (!isAllowed) throw new Error('Forbidden');

  const tables = createSystemTablesDB();
  const result = await tables.updateRow({
    databaseId,
    tableId,
    rowId,
    data,
    permissions,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function deleteRowSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  let isAllowed = false;
  const isSpecializedTable = await getIsSpecializedTable(tableId);

  if (isSpecializedTable) {
    const existingRow = await getRowCached({ databaseId, tableId, rowId });

    if (tableId === 'Collaborators' || tableId === 'collaborators') {
      const noteIdStr = String(existingRow?.noteId || '');
      if (noteIdStr.startsWith('task:')) {
        const taskId = noteIdStr.replace('task:', '');
        isAllowed = await verifyResourcePermissionSecure({
          databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
          collectionId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          documentId: taskId,
          actorId: actor.$id,
          action: 'update',
        });
      } else {
        isAllowed = true;
      }
    } else if (tableId === 'formSubmissions') {
      const isSubmitter = existingRow?.submitterId === actor.$id;
      if (isSubmitter) {
        isAllowed = true;
      } else {
        const parentFormId = existingRow?.formId;
        if (parentFormId) {
          isAllowed = await verifyResourcePermissionSecure({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            collectionId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            documentId: parentFormId,
            actorId: actor.$id,
            action: 'delete',
          });
        }
      }
    } else if (tableId === 'wallets') {
      isAllowed = existingRow?.ownerId === `user:${actor.$id}`;
    } else if (tableId === 'walletMap') {
      isAllowed = existingRow?.userId === actor.$id;
    } else if (tableId === 'follows') {
      isAllowed = existingRow?.followerId === actor.$id || existingRow?.followingId === actor.$id;
    } else if (tableId === 'activityLog') {
      isAllowed = existingRow?.userId === actor.$id;
    } else {
      isAllowed = true;
    }
  } else {
    isAllowed = await verifyResourcePermissionSecure({
      databaseId,
      collectionId: tableId,
      documentId: rowId,
      actorId: actor.$id,
      action: 'delete',
    });
  }

  if (!isAllowed) throw new Error('Forbidden');

  const tables = createSystemTablesDB();
  try {
    await executeCascadeDeleteSecure(databaseId, tableId, rowId);
  } catch (err: any) {
    console.error('deleteRowSecure cascade cleanup failed:', err);
  }

  return JSON.parse(JSON.stringify(result));
}

export async function searchGlobalUsersSecure(query: string, limit = 10) {
  const cleaned = String(query || '').trim().replace(/^@/, '');
  if (!cleaned) return [];

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  try {
    const res = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.or([
          Query.startsWith('username', cleaned.toLowerCase()),
          Query.startsWith('displayName', cleaned)
        ]),
        Query.limit(limit),
        Query.select(['$id', 'userId', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey'])
      ] as any,
    });

    return JSON.parse(JSON.stringify(res.rows.map(doc => ({
      id: doc.username || doc.userId || doc.$id, // Use username as ID for cleaner routing
      type: 'user' as const,
      title: doc.displayName || doc.username,
      subtitle: `@${doc.username}`,
      avatar: doc.avatar,
      username: doc.username,
      userId: doc.userId || doc.$id,
      publicKey: doc.publicKey || null,
    }))));
  } catch (error: any) {
    console.warn('[searchGlobalUsersSecure] Search failed:', error?.message);
    return [];
  }
}

export async function getProfileByUsernameSecure(username: string) {
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '');
  if (!normalized) return null;

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  try {
    const res = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.equal('username', normalized),
        Query.limit(1)
      ] as any,
    });

    const doc = res.rows[0];
    if (!doc) return null;

    return JSON.parse(JSON.stringify({
      $id: doc.$id,
      userId: doc.userId || doc.$id,
      username: doc.username,
      displayName: doc.displayName,
      bio: doc.bio,
      avatar: doc.avatar,
      publicKey: doc.publicKey,
      tier: doc.tier,
      updatedAt: doc.updatedAt || doc.$updatedAt,
    }));
  } catch (error: any) {
    console.warn('[getProfileByUsernameSecure] Failed:', error?.message);
    return null;
  }
}


