'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role, Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan } from '@/lib/utils';
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

// Short-lived in-memory cache for row reads during permission checks.
// Prevents duplicate database fetches within a short timeframe (e.g. 5 seconds).
const rowCache = new Map<string, { row: any; timestamp: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds

export async function getRowCached(params: { databaseId: string; tableId: string; rowId: string }) {
  const cacheKey = `${params.databaseId}:${params.tableId}:${params.rowId}`;
  const now = Date.now();
  const cached = rowCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.row;
  }
  const tables = createSystemTablesDB();
  const row = await collections.getRow(params);
  if (row) {
    // Prune expired entries to keep memory low
    if (rowCache.size > 100) {
      for (const [key, val] of rowCache.entries()) {
        if (now - val.timestamp > CACHE_TTL_MS) {
          rowCache.delete(key);
        }
      }
    }
    rowCache.set(cacheKey, { row, timestamp: now });
  }
  return row;
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
    moment = (await collections.getRow({
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
    note = (await collections.getRow({
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
  const note = await collections.getRow({
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

  const moment = await collections.createRow({
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
    const rows = await collections.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
      Query.lessThan('expiresAt', new Date().toISOString()),
      Query.limit(500)],
    });
    for (const row of rows.rows) {
      await collections.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
    }
    return { deleted: rows.documents.length, callIds: rows.documents.map((row) => row.$id) };
  }

  if (targetUserId !== requester.$id && !admin && !callId) throw new Error('Forbidden');

  if (callId) {
    const call = await collections.getRow({
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

  const expiredRows = await collections.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
    Query.equal('userId', targetUserId || requester.$id),
    Query.lessThan('expiresAt', new Date().toISOString()),
    Query.limit(200)],
    });
  for (const row of expiredRows.rows) {
    await collections.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
  }
  const presenceUser = targetUserId || requester.$id;
  await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
  return { deleted: expiredRows.documents.length, callIds: expiredRows.documents.map((row) => row.$id) };
}

export async function getQuickProfileSecure(userId: string, jwt?: string) {
  const requester = await getActor(jwt);
  if (!requester?.$id) throw new Error('Unauthorized');
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) throw new Error('userId is required');

  const tables = createSystemTablesDB();
  const getProfile = async () => {
    try {
      const byUserId = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      queries: [Query.equal('userId', targetUserId), Query.limit(1)],
    });
      if (byUserId.rows[0]) return byUserId.rows[0];
    } catch {}
    try {
      return await collections.getRow({
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
    const rows = await collections.listRows({
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
  resourceType: 'note' | 'task' | 'project';
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

  const { client, users, teams } = createSystemClient();

  // Handle Project Team synchronization
  if (input.resourceType === 'project') {
    try {
        // Sync to native Appwrite Team for optimized read-access
        await teams.createMembership(
            input.resourceId, 
            [input.permission], 
            undefined, 
            input.targetUserId
        );
    } catch (teamErr: any) {
        console.warn('[grantPermissionSecure] Team membership sync skipped or failed:', teamErr?.message);
    }
  }

  const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
               input.resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
               APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                  input.resourceType === 'project' ? 'projects' :
                  APPWRITE_CONFIG.TABLES.FLOW.TASKS;

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
    const noteRow = await collections.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
    let meta: any = {};
    try {
      meta = JSON.parse(noteRow.metadata || '{}');
    } catch {}

    // Enforce 8-collaborator limit for FREE tier
    const currentCollaborators = meta.collaborators ? Object.keys(meta.collaborators) : [];
    if (currentCollaborators.length >= 8 && !hasPaidKylrixPlan(requester)) {
        throw new Error('Limit reached: Free plan is limited to 8 collaborators per note. Upgrade to PRO for unlimited sharing.');
    }

    if (!meta.collaborators) {
      meta.collaborators = {};
    }
    meta.collaborators[input.targetUserId] = input.permission; // 'viewer' | 'editor' | 'admin'

    await collections.updateRow({
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
    resourceType: 'note' | 'task' | 'project';
    targetUserId: string;
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    const { teams } = createSystemClient();

    // Handle Project Team synchronization
    if (input.resourceType === 'project') {
      try {
          // List memberships to find the one to delete
          const memberships = await teams.listMemberships(input.resourceId);
          const membership = memberships.memberships.find(m => m.userId === input.targetUserId);
          if (membership) {
              await teams.deleteMembership(input.resourceId, membership.$id);
          }
      } catch (teamErr: any) {
          console.warn('[revokePermissionSecure] Team membership removal skipped or failed:', teamErr?.message);
      }
    }

    const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
                 input.resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
                 APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                    input.resourceType === 'project' ? 'projects' :
                    APPWRITE_CONFIG.TABLES.FLOW.TASKS;

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
        const noteRow = await collections.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
        let meta: any = {};
        try {
            meta = JSON.parse(noteRow.metadata || '{}');
        } catch {}
        if (meta.collaborators) {
            delete meta.collaborators[input.targetUserId];
            await collections.updateRow({
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
    const row = await collections.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
    
    let filteredCollabs: Array<{ userId: string, level: string }> = [];
    
    if (input.resourceType === 'note') {
        let meta: any = {};
        try {
            meta = JSON.parse(row.metadata || '{}');
        } catch {}
        const collaboratorsMap = meta.collaborators || {};
        filteredCollabs = Object.entries(collaboratorsMap).map(([userId, level]) => ({
            userId,
            level: String(level)
        }));
    } else {
        // Fallback for tasks
        const rawPermissions = row.$permissions || [];
        const collabMeta = extractCollaboratorsFromPermissions(rawPermissions);
        const ownerId = String((row as any).userId || '').trim();
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
    cleanRowData, 
    filterNoteData, 
    getNotePermissions,
    createNoteCreationService,
  } = await import('@/lib/appwrite/note');

  const syncTags = async ({ noteId, rawTags, userId, now }: any) => {
    try {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const unique = Array.from(new Set(rawTags.map((tag: any) => tag.trim()))).filter(Boolean) as string[];
      if (!unique.length) return;

      const existingTagRows: Record<string, any> = {};
      try {
        const existingTagsRes = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', unique.map((tag: any) => tag.toLowerCase())), Query.limit(unique.length)] as any,
    });
        for (const td of existingTagsRes.rows as any[]) {
          if (td.nameLower) existingTagRows[td.nameLower] = td;
        }
      } catch (tagListErr) {
        console.error('tag preload failed on server', tagListErr);
      }

      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        if (!existingTagRows[key]) {
          try {
            const created = await collections.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 },
    });
            existingTagRows[key] = created;
          } catch (createTagErr: any) {
            try {
              const retry = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
              if (retry.documents.length) existingTagRows[key] = retry.rows[0];
            } catch {}
          }
        }
      }

      const existingPivot = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any,
    });
      const existingPairs = new Set(existingPivot.documents.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        const tagRow = existingTagRows[key];
        const tagId = tagRow ? (tagRow.$id || tagRow.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        
        try {
          const res = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.documents.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        if (existingPairs.has(pairKey)) continue;
        try {
          await collections.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: ID.unique(),
      data: { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId, createdAt: now },
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
      return collections.createRow({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId || ID.unique(),
      data: data as any,
      permissions: permissions,
    }) as any;
    },
    getNote: async (noteId) => {
      const row = await collections.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
    }) as any;
      try {
        const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const pivot = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
    });
        if (pivot.documents.length) {
          const tags = Array.from(new Set(pivot.documents.map((p: any) => p.tag).filter(Boolean)));
          (row as any).tags = tags;
        }
      } catch {}
      if (!row.attachments || !Array.isArray(row.attachments)) {
        row.attachments = [];
      }
      return row;
    },
    getNotePermissions,
    cleanRowData,
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
  tableId?: string;
  rowId?: string;
  actorId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  ownerFields?: string[];
  metadataField?: string;
  data?: any;
}) {
  const { databaseId, tableId, rowId, actorId, action, ownerFields = ['userId', 'ownerId'], metadataField = 'metadata', data } = params;
  
  let row = data;
  if (!row && databaseId && tableId && rowId) {
    row = await getRowCached({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId,
    }).catch(() => null);
  }

  if (!row) {
    return false;
  }
  
  let isOwner = false;
  for (const field of ownerFields) {
    const val = String(row[field] || '').trim();
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

  // 1. Native Visibility Flags (isPublic, isGuest)
  // These grant universal read-only access based on the new native columns.
  const isGuest = row.isGuest === true;
  const isPublic = row.isPublic === true;

  // 2. Project-Level Inheritance (isGeneral)
  // If a resource is linked to a project with isGeneral = true, all project members inherit read access.
  let isInheritedGeneralRead = false;
  if (action === 'read' && rowId) {
    try {
      const tables = createSystemTablesDB();
      const objLinks = await collections.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        queries: [Query.equal('entityId', rowId)] as any
      });
      
      for (const link of objLinks.rows) {
        if (link.isGeneral === true) {
          const project = await getRowCached({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'projects',
            rowId: link.projectId
          });

          if (project) {
            if (project.ownerId === actorId) {
                isInheritedGeneralRead = true;
                break;
            }
            // Check if current user is an explicit collaborator in that project
            const projectCollabs = await collections.listRows({
                databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                tableId: 'project_objects',
                queries: [
                    Query.equal('projectId', link.projectId),
                    Query.equal('entityKind', 'collaborator'),
                    Query.equal('entityId', actorId)
                ] as any
            }).catch(() => ({ rows: [] }));
            
            if (projectCollabs.documents.length > 0) {
                isInheritedGeneralRead = true;
                break;
            }
          }
        }
      }
    } catch (err) {
      console.error('[verifyResourcePermissionSecure] Inheritance check failed:', err);
    }
  }

  if (action === 'read') {
    if (isPublic || isInheritedGeneralRead) return true;
    if (isGuest && !actorId) return true; 
  }

  // 3. Discrete Access Control: Collaborators table / legacy metadata.collaborators
  let matchedCollabRole: 'viewer' | 'editor' | 'admin' | null = null;

  if (actorId && rowId) {
    try {
      const tables = createSystemTablesDB();
      const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
      const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      
      const collabsRes = await collections.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('userId', actorId)
        ] as any
      });
      
      if (collabsRes.documents.length > 0) {
        const p = collabsRes.rows[0].permission; // 'read' | 'write' | 'admin'
        if (p === 'admin') matchedCollabRole = 'admin';
        else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
        else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
      }
    } catch (err) {
      console.error('[verifyResourcePermissionSecure] Polymorphic table check failed:', err);
    }
  }

  // Legacy fallback to metadata.collaborators
  if (!matchedCollabRole) {
    let meta: any = {};
    try {
      const rawMeta = row[metadataField];
      meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta || {};
    } catch {}
    const collaborators = meta.collaborators || {};
    const userRole = collaborators[actorId];
    if (userRole) {
      matchedCollabRole = userRole;
    }
  }

  if (action === 'read') {
    if (matchedCollabRole) {
      return ['viewer', 'editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'update') {
    if (matchedCollabRole) {
      return ['editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'delete') {
    if (matchedCollabRole) {
      return matchedCollabRole === 'admin';
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
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId,
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
    cleanRowData, 
    filterNoteData, 
    getNotePermissions,
  } = await import('@/lib/appwrite/note');

  const cleanData = cleanRowData(data);
  const updatedAt = new Date().toISOString();
  const updatedData = filterNoteData({ ...cleanData, updatedAt: updatedAt });

  let permissions = undefined;
  if (data.isPublic !== undefined) {
    permissions = getNotePermissions(actor.$id, !!data.isPublic);
  }

  const row = await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
      data: updatedData,
      permissions: permissions,
    }) as any;

  try {
    if (Array.isArray((data as any).tags)) {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const incomingRaw: string[] = (data as any).tags.filter(Boolean).map((t: string) => t.trim());
      const normalizedIncoming = Array.from(new Set(incomingRaw)).filter(Boolean);
      const incomingSet = new Set(normalizedIncoming);

      const tagRows: Record<string, any> = {};
      if (normalizedIncoming.length) {
        try {
          const existingTagsRes = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', normalizedIncoming.map(t => t.toLowerCase())), Query.limit(normalizedIncoming.length)] as any,
    });
          for (const td of existingTagsRes.rows as any[]) {
            if (td.nameLower) tagRows[td.nameLower] = td;
          }
        } catch (preErr) {
          console.error('updateNoteSecure tag preload failed', preErr);
        }
        for (const tagName of normalizedIncoming) {
          const key = tagName.toLowerCase();
          if (!tagRows[key]) {
            try {
              const created = await collections.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId: actor.$id, createdAt: updatedAt, usageCount: 0 },
    });
              tagRows[key] = created;
            } catch (createErr) {
              try {
                const retry = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
                if (retry.documents.length) tagRows[key] = retry.rows[0];
              } catch {}
            }
          }
        }
      }

      const existingPivot = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any,
    });
      const existingByTag: Record<string, any> = {};
      const existingPairs = new Set<string>();
      for (const p of existingPivot.rows as any[]) {
        if (p.tag) existingByTag[p.tag] = p;
        if (p.tagId && p.tag) existingPairs.add(`${p.tagId}::${p.tag}`);
      }

      for (const tagName of normalizedIncoming) {
        const key = tagName.toLowerCase();
        const tagRow = tagRows[key];
        const tagId = tagRow ? (tagRow.$id || tagRow.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        if (existingPairs.has(pairKey)) continue;

        try {
          const res = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.documents.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        try {
          await collections.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: ID.unique(),
      data: { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId: actor.$id, createdAt: updatedAt },
    });
          existingPairs.add(pairKey);
        } catch (ie) {
          console.error('note_tags create (updateNoteSecure) failed', ie);
        }
      }

      for (const [tagName, pivotRow] of Object.entries(existingByTag)) {
        if (!incomingSet.has(tagName)) {
          try {
            const res = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
            if (res.documents.length) {
              const tRow: any = res.rows[0];
              const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
              await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: Math.max(0, current - 1) },
    });
            }
          } catch {}

          try {
            await collections.deleteRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: (pivotRow as any).$id,
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

  return JSON.parse(JSON.stringify(row));
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

  const result = await collections.deleteRow({
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
    tableId: 'projects',
    rowId: projectId,
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
  const { databases, teams } = createSystemClient();
  const now = new Date().toISOString();
  const projectId = ID.unique();

  // 1. Create native Appwrite Team for high-performance read-access
  try {
      await teams.create(projectId, data.name || data.title || 'New Project');
      // Add creator as owner
      await teams.createMembership(projectId, ['owner'], undefined, actor.$id);
  } catch (teamErr: any) {
      console.warn('[createProjectSecure] Team creation skipped or failed:', teamErr?.message);
  }

  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.read(Role.team(projectId)),
    Permission.update(Role.user(actor.$id)),
    Permission.delete(Role.user(actor.$id)),
  ];

  const project = await collections.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
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
  
  const project = await collections.updateRow({
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

  const result = await collections.deleteRow({
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
  const { databases, teams } = createSystemClient();

  // 1. Sync to native Appwrite Team for optimized read-access
  try {
      await teams.createMembership(
          projectId, 
          [permissionLevel], 
          undefined, 
          targetUserId
      );
  } catch (teamErr: any) {
      console.warn('[addProjectCollaboratorSecure] Team membership sync skipped or failed:', teamErr?.message);
  }

  // 2. Fetch current project to update permissions
  const project = await collections.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  // Enforce 8-collaborator limit for FREE tier
  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}
  const currentCollaborators = metadata.collaborators ? Object.keys(metadata.collaborators) : [];

  // Fetch owner to check plan
  const owner = await getActor(undefined); // Fallback to current session
  if (currentCollaborators.length >= 8 && !hasPaidKylrixPlan(owner)) {
      throw new Error('Limit reached: Free plan is limited to 8 collaborators. Upgrade to PRO for unlimited team members.');
  }

  // Update physical permissions: add READ permission only
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${targetUserId}")`);
  // Ensure native team permission is present
  newPermissions.add(`read("team:${projectId}")`);

  if (!metadata.collaborators) {
    metadata.collaborators = {};
  }
  metadata.collaborators[targetUserId] = permissionLevel;
  await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      metadata: JSON.stringify(metadata),
    },
      permissions: Array.from(newPermissions),
    });

  // 2. Add object link in project_objects (if not already exists)
  const existingObjects = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
      Query.equal('projectId', projectId),
      Query.equal('entityKind', 'collaborator'),
      Query.equal('entityId', targetUserId)] as any,
    });

  let objLink;
  const now = new Date().toISOString();
  if (existingObjects.documents.length > 0) {
    // Update existing
    objLink = await collections.updateRow({
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
    objLink = await collections.createRow({
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

  // 3. E2E Private Chat Group Member Auto-Sync
  if (metadata && metadata.encryptedGroupId) {
    try {
      const convId = metadata.encryptedGroupId;
      const existingMembers = await collections.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', convId),
          Query.equal('userId', targetUserId)
        ] as any
      }).catch(() => ({ rows: [] }));

      if (existingMembers.documents.length === 0) {
        const memberPerms = [
          Permission.read(Role.user(actor.$id)),
          Permission.read(Role.user(targetUserId))
        ];
        await collections.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
          tableId: 'conversationMembers',
          rowId: ID.unique(),
          data: {
            conversationId: convId,
            userId: targetUserId,
          },
          permissions: memberPerms
        });
      }
    } catch (e) {
      console.warn('[addProjectCollaboratorSecure] Failed to sync to E2E project group:', e);
    }
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
  const { databases, teams } = createSystemClient();

  // 1. Sync to native Appwrite Team for optimized read-access
  try {
      const memberships = await teams.listMemberships(projectId);
      const membership = memberships.memberships.find(m => m.userId === targetUserId);
      if (membership) {
          await teams.deleteMembership(projectId, membership.$id);
      }
  } catch (teamErr: any) {
      console.warn('[removeProjectCollaboratorSecure] Team membership removal skipped or failed:', teamErr?.message);
  }

  // 2. Fetch current project to update permissions
  const project = await collections.getRow({
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

  await collections.updateRow({
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
    const objects = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', targetUserId)] as any,
    });
    await Promise.all(
      objects.documents.map((obj) =>
        collections.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: obj.$id,
    })
      )
    );
  } catch (err) {
    console.error('removeProjectCollaboratorSecure objects cleanup failed:', err);
  }

  // 3. E2E Private Chat Group Member Auto-Sync
  if (metadata && metadata.encryptedGroupId) {
    try {
      const convId = metadata.encryptedGroupId;
      const memberRows = await collections.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', convId),
          Query.equal('userId', targetUserId)
        ] as any
      }).catch(() => ({ rows: [] }));

      await Promise.all(
        memberRows.documents.map((row) =>
          collections.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
            tableId: 'conversationMembers',
            rowId: row.$id
          })
        )
      );
    } catch (e) {
      console.warn('[removeProjectCollaboratorSecure] Failed to sync from E2E project group:', e);
    }
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

  const obj = await collections.createRow({
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

  const obj = await collections.getRow({
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

  const result = await collections.deleteRow({
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
    tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    rowId: formId,
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

  const form = await collections.createRow({
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

  const form = await collections.getRow({
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

  const updatedForm = await collections.updateRow({
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

  const result = await collections.deleteRow({
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

  const form = await collections.getRow({
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

  const updatedForm = await collections.updateRow({
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

  const form = await collections.getRow({
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

  const updatedForm = await collections.updateRow({
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
  const event = await collections.getRow({
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
    const collabsRes = await collections.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', actorId),
        Query.limit(1),
      ] as any,
    });
    if (collabsRes.documents.length > 0) {
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
  const guestsRes = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', actorId),
      Query.limit(1)
    ] as any,
    });

  if (guestsRes.documents.length === 0) return false;

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

  const event = await collections.createRow({
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

  const event = await collections.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  const ownerId = event.userId;
  const permissions = [
    Permission.read(Role.user(ownerId))];

  // Include physical read permissions for all manager guests
  try {
    const guestsRes = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [Query.equal('eventId', eventId)] as any,
    });
    guestsRes.documents.forEach((g: any) => {
      if (g.userId && String(g.role || '').startsWith('manager-')) {
        permissions.push(Permission.read(Role.user(g.userId)));
      }
    });
  } catch (err) {
    console.error('Failed to query manager physical read permissions in updateEventSecure', err);
  }

  const updatedEvent = await collections.updateRow({
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

  const result = await collections.deleteRow({
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
  const event = await collections.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  // Update physical permissions: add READ permission only
  const permissions = new Set(event.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: Array.from(permissions),
    });

  // 2. Add or update Guest entry
  const guestsRes = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', targetUserId)] as any,
    });

  const virtualRole = `manager-${permissionLevel}`;
  let guestRow;
  if (guestsRes.documents.length > 0) {
    // Update role
    guestRow = await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: guestsRes.rows[0].$id,
      data: {
        role: virtualRole,
      },
    });
  } else {
    // Create new
    guestRow = await collections.createRow({
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
    const existingCollab = await collections.listRows({
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

    if (existingCollab.documents.length > 0) {
      await collections.updateRow({
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
      await collections.createRow({
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

  return JSON.parse(JSON.stringify(guestRow));
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
  const event = await collections.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });

  // Remove physical read permission
  const rawPermissions = event.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: updatedPerms,
    });

  // 2. Remove Guest entry if it was a manager
  try {
    const guestsRes = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
        Query.equal('eventId', eventId),
        Query.equal('userId', targetUserId)] as any,
    });
    await Promise.all(
      guestsRes.documents.map((g: any) => {
        if (String(g.role || '').startsWith('manager-')) {
          return collections.deleteRow({
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
    const collabsRes = await collections.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', targetUserId),
      ] as any,
    });
    await Promise.all(
      collabsRes.documents.map((row: any) =>
        collections.deleteRow({
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
  const call = await collections.getRow({
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

  const updatedCall = await collections.updateRow({
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
    const existing = await collections.listRows({
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

    if (existing.documents.length > 0) {
      await collections.updateRow({
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
      await collections.createRow({
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
  const call = await collections.getRow({
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
      const collabsRes = await collections.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.documents.length > 0) {
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

  const result = await collections.deleteRow({
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
  const call = await collections.getRow({
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
      const collabsRes = await collections.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.documents.length > 0 && collabsRes.rows[0].role === 'cohost') {
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

  const updatedCall = await collections.updateRow({

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

  const result = await collections.createRow({
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
  const result = await collections.createRow({
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
      isGhost: true,
      isThread: false,
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
  const result = await collections.createRow({
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
      isGhost: true,
      isThread: false,
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
  const result = await collections.createRow({
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
      isGhost: true,
      isThread: true,
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
      const form = await collections.getRow({
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
            tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
            rowId: taskId,
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
        
        // Grant read permission to both follower and following
        if (!permissions) {
            permissions = [
                Permission.read(Role.user(data.followerId)),
                Permission.read(Role.user(data.followingId))
            ];
        }
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
          const form = await collections.getRow({
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

  const result = await collections.createRow({
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
          tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          rowId: taskId,
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
            tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            rowId: parentFormId,
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
      tableId: tableId,
      rowId: rowId,
      actorId: actor.$id,
      action: 'update',
      data,
    });
  }

  if (!isAllowed) throw new Error('Forbidden');

  const tables = createSystemTablesDB();
  const result = await collections.updateRow({
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
          tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          rowId: taskId,
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
            tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            rowId: parentFormId,
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
      tableId: tableId,
      rowId: rowId,
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

  const result = await collections.deleteRow({
    databaseId,
    tableId,
    rowId,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function searchGlobalUsersSecure(query: string, limit = 10) {
  const cleaned = String(query || '').trim().replace(/^@/, '');
  if (!cleaned) return [];

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  try {
    const res = await collections.listRows({
      databaseId,
      tableId,
      queries: [
        Query.or([
          Query.startsWith('username', cleaned.toLowerCase()),
          Query.startsWith('displayName', cleaned)
        ]),
        Query.equal('isPublic', true),
        Query.limit(limit)
      ] as any,
    });

    return JSON.parse(JSON.stringify(res.rows));
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
    const res = await collections.listRows({
      databaseId,
      tableId,
      queries: [
        Query.equal('username', normalized),
        Query.limit(1)
      ] as any,
    });

    return JSON.parse(JSON.stringify(res.rows[0] || null));
  } catch (error: any) {
    console.warn('[getProfileByUsernameSecure] Failed:', error?.message);
    return null;
  }
}

export async function listRowsSecure(databaseId: string, tableId: string, queries: string[] = [], jwt?: string) {
  console.log('[listRowsSecure] Request:', { databaseId, tableId, queries });
  
  // Use user-scoped client to respect Row Level Security
  const { client } = await createServerClient(jwt);
  const databases = new Databases(client);

  try {
    const res = await databases.listRows(
      databaseId,
      tableId,
      queries as any,
    );
    console.log('[listRowsSecure] Success. Total:', res.total, 'Count:', res.rows?.length);
    return JSON.parse(JSON.stringify({
        total: res.total,
        rows: res.rows
    }));
  } catch (error: any) {
    console.error('[listRowsSecure] Failed:', error?.message);
    throw error;
  }
}

export async function getRowSecure(databaseId: string, tableId: string, rowId: string, jwt?: string) {
  console.log('[getRowSecure] Request:', { databaseId, tableId, rowId });
  
  // Use user-scoped client to respect Row Level Security
  const { client } = await createServerClient(jwt);
  const databases = new Databases(client);

  try {
    const res = await databases.getRow(
      databaseId,
      tableId,
      rowId,
    );
    return JSON.parse(JSON.stringify(res));
  } catch (error: any) {
    console.error('[getRowSecure] Failed:', error?.message);
    throw error;
  }
}

export async function getFilePreviewSecure(bucketId: string, fileId: string, width = 100, height = 100) {
  const { storage } = createSystemClient();
  try {
    const url = storage.getFilePreview(bucketId, fileId, width, height);
    return url.toString();
  } catch (error: any) {
    console.warn('[getFilePreviewSecure] Failed:', error?.message);
    return null;
  }
}

export async function convertResponseToGoalSecure(submissionId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const submission = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: 'formSubmissions',
    rowId: submissionId
  });

  if (!submission) {
    throw new Error('Submission not found');
  }

  // Parse payload to build a nice description
  let payload: any = {};
  try {
    payload = JSON.parse(submission.payload);
  } catch {
    payload = { data: submission.payload };
  }

  let desc = `Derived from Form Response ${submission.$id.slice(-8)} submitted by ${submission.submitterName || 'Anonymous'}.\n\n`;
  for (const [k, v] of Object.entries(payload)) {
    desc += `**${k.toUpperCase()}**: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`;
  }

  const now = new Date().toISOString();
  const permissions = [Permission.read(Role.user(actor.$id))];
  
  // Create task in whisperrflow
  const task = await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: 'tasks',
    rowId: ID.unique(),
    data: {
      title: `Action: Form Response ${submission.$id.slice(-8)}`,
      description: desc,
      status: 'todo',
      priority: 'high',
      userId: actor.$id,
      createdAt: now,
      updatedAt: now,
      metadata: JSON.stringify({ origin: 'form_response', submissionId: submission.$id, formId: submission.formId })
    },
    permissions: permissions
  });

  // Link task to parent projects if the form is linked to any
  try {
    const parentLinks = await collections.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('entityId', submission.formId),
        Query.equal('entityKind', 'form')
      ] as any
    });

    for (const link of parentLinks.rows) {
      await collections.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        rowId: ID.unique(),
        data: {
          projectId: link.projectId,
          entityKind: 'goal',
          entityId: task.$id,
          role: 'member',
          createdAt: now,
          updatedAt: now,
          isGeneral: true // Default project internal eyes-on visibility flag
        },
        permissions: permissions
      });
    }
  } catch (err) {
    console.error('Failed to link converted goal to parent projects:', err);
  }

  return JSON.parse(JSON.stringify(task));
}

export async function createGhostNoteForProjectSecure(projectId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedResourceType: 'project',
    linkedResourceId: projectId,
    expiresAt: expiresAt,
    version: 'v2',
  });

  const tables = createSystemTablesDB();
  const result = await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: title || 'Project Discussion',
      content: '',
      format: 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: [`read("any")`],
  });

  // Update parent project metadata with discussionNoteId
  const project = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  }).catch(() => null);
  
  if (project) {
    let projMeta: any = {};
    try {
      projMeta = JSON.parse(project.metadata || '{}');
    } catch {}
    projMeta.discussionNoteId = result.$id;
    await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
        metadata: JSON.stringify(projMeta)
      }
    });
  }

  return JSON.parse(JSON.stringify(result));
}

export async function promoteGhostThreadToStorySecure(projectId: string, noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const noteRow = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId
  });

  if (!noteRow) {
    throw new Error('Note thread not found');
  }

  // Update note properties to be a permanent Story note
  let meta: any = {};
  try {
    meta = JSON.parse(noteRow.metadata || '{}');
  } catch {}

  meta.isGhost = false;
  meta.isStory = true;
  delete meta.expiresAt;

  const updatedNote = await collections.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId,
    data: {
      userId: actor.$id, // Note now owned by user
      metadata: JSON.stringify(meta),
      updatedAt: new Date().toISOString()
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
      Permission.write(Role.user(actor.$id)),
      Permission.update(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id))
    ]
  });

  // Link note as permanent integrated note inside the project
  const now = new Date().toISOString();
  await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'project_objects',
    rowId: ID.unique(),
    data: {
      projectId,
      entityKind: 'note',
      entityId: noteId,
      role: 'member',
      createdAt: now,
      updatedAt: now,
      isGeneral: true
    },
    permissions: [
      Permission.read(Role.user(actor.$id))
    ]
  });

  // Clear discussionNoteId from project metadata so a new huddle thread can be started
  const project = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  }).catch(() => null);

  if (project) {
    let projMeta: any = {};
    try {
      projMeta = JSON.parse(project.metadata || '{}');
    } catch {}
    delete projMeta.discussionNoteId;
    await collections.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
        metadata: JSON.stringify(projMeta)
      }
    });
  }

  return JSON.parse(JSON.stringify(updatedNote));
}

export async function createEncryptedGroupForProjectSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const project = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // 1. Gather all current project members (owner + collaborators)
  const collaborators = await collections.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'project_objects',
    queries: [
      Query.equal('projectId', projectId),
      Query.equal('entityKind', 'collaborator')
    ] as any
  }).catch(() => ({ rows: [] }));

  const memberIds = [project.ownerId];
  for (const collab of collaborators.rows) {
    if (collab.entityId && !memberIds.includes(collab.entityId)) {
      memberIds.push(collab.entityId);
    }
  }

  const uniqueParticipants = Array.from(new Set(memberIds));

  // 2. Create standard Connect conversation group
  const now = new Date().toISOString();
  const convId = ID.unique();
  const permissions = uniqueParticipants.map(id => Permission.read(Role.user(id)));

  const conversation = await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'conversations',
    rowId: convId,
    data: {
      participants: uniqueParticipants,
      participantCount: uniqueParticipants.length,
      type: 'group',
      name: project.title,
      creatorId: actor.$id,
      admins: [actor.$id],
      isPinned: [],
      isMuted: [],
      isArchived: [],
      tags: [],
      isEncrypted: false,
      encryptionVersion: '1.0',
      createdAt: now,
      updatedAt: now,
    },
    permissions
  });

  // 3. Create conversation memberships
  for (const userId of uniqueParticipants) {
    await collections.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'conversationMembers',
      rowId: ID.unique(),
      data: {
        conversationId: convId,
        userId
      },
      permissions
    });
  }

  // 4. Update project metadata with encryptedGroupId
  let projMeta: any = {};
  try {
    projMeta = JSON.parse(project.metadata || '{}');
  } catch {}
  projMeta.encryptedGroupId = convId;

  const updatedProject = await collections.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(projMeta)
    }
  });

  return JSON.parse(JSON.stringify(updatedProject));
}

export async function createGhostNoteForResourceSecure(
  resourceId: string,
  resourceType: 'task' | 'project' | 'tag' | 'event' | 'form',
  title?: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedResourceType: resourceType,
    linkedResourceId: resourceId,
    expiresAt: expiresAt,
    version: 'v2',
  });

  const tables = createSystemTablesDB();
  
  // Try to delete any existing Ghost Note for this resource to avoid duplicates
  try {
    await collections.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    });
  } catch {}

  const result = await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId, // RowId matches the resourceId directly!
    data: {
      title: title || `Discussion Thread`,
      content: '',
      format: 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: [`read("any")`],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function promoteGhostResourceThreadToStorySecure(
  resourceId: string,
  resourceType: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();

  // 1. Fetch all comments linked to this resource's discussion note
  const commentsList = await collections.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    queries: [
      Query.equal('noteId', resourceId)
    ] as any
  }).catch(() => ({ rows: [] }));

  // 2. Fetch the ghost note itself to see if it exists
  const noteRow = await collections.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId
  }).catch(() => null);

  const title = noteRow?.title || `Discussion: ${resourceType} ${resourceId.slice(-8)}`;

  // 3. Compile comments history into a clean markdown row
  let markdownContent = `# Discussion History\n\n*Resource Type: ${resourceType}*\n*Date: ${new Date().toLocaleDateString()}*\n\n`;
  if (commentsList.documents.length === 0) {
    markdownContent += `*No comments were recorded in this thread.*`;
  } else {
    // Sort comments chronologically
    const sorted = [...commentsList.rows].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const c of sorted) {
      markdownContent += `### ${c.userId === actor.$id ? 'You' : 'Collaborator'} (${new Date(c.createdAt).toLocaleTimeString()})\n${c.content}\n\n`;
    }
  }

  // 4. Provision a new permanent story note
  const now = new Date().toISOString();
  const storyNoteId = ID.unique();
  const storyMeta = JSON.stringify({
    isGhost: false,
    isStory: true,
    linkedResourceType: resourceType,
    linkedResourceId: resourceId,
    version: 'v2'
  });

  const storyNote = await collections.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: storyNoteId,
    data: {
      title: `Story: ${title}`,
      content: markdownContent,
      format: 'markdown',
      isPublic: true,
      userId: actor.$id,
      createdAt: now,
      updatedAt: now,
      metadata: storyMeta
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
      Permission.write(Role.user(actor.$id)),
      Permission.update(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id))
    ]
  });

  // 5. Cleanup the original ghost note comments
  await Promise.all(
    commentsList.documents.map(c => 
      collections.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
        rowId: c.$id
      }).catch(() => null)
    )
  );

  // 6. Delete the original ghost note
  if (noteRow) {
    await collections.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    }).catch(() => null);
  }

  return JSON.parse(JSON.stringify(storyNote));
}

export async function tagResourceSecure(
  resourceId: string,
  resourceType: string,
  tagName: string,
  isPublic = false,
  isGuest = false,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const tagsTable = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
  const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

  const key = tagName.trim();
  const nameLower = key.toLowerCase();
  if (!key) throw new Error('Tag name cannot be empty');

  // 1. Preload or create tag row
  let tagRow: any = null;
  try {
    const existingTags = await collections.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [
        Query.equal('userId', actor.$id),
        Query.equal('nameLower', nameLower),
        Query.limit(1)
      ] as any
    });
    if (existingTags.documents.length) {
      tagRow = existingTags.rows[0];
    }
  } catch {}

  if (!tagRow) {
    try {
      tagRow = await collections.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: tagsTable,
        rowId: ID.unique(),
        data: {
          name: key,
          nameLower,
          userId: actor.$id,
          isPublic,
          isGuest,
          usageCount: 0,
          metadata: JSON.stringify({ version: 'v2' })
        }
      });
    } catch {
      // Race condition lookup
      const retry = await collections.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: tagsTable,
        queries: [
          Query.equal('userId', actor.$id),
          Query.equal('nameLower', nameLower),
          Query.limit(1)
        ] as any
      });
      if (retry.documents.length) tagRow = retry.rows[0];
    }
  }

  if (!tagRow) throw new Error('Failed to resolve or create tag');

  // 2. Check if polymorphic pivot already exists
  const tagId = tagRow.$id || tagRow.id;
  const existingPivot = await collections.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.equal('tagId', tagId),
      Query.limit(1)
    ] as any
  });

  if (existingPivot.documents.length) {
    return JSON.parse(JSON.stringify(existingPivot.rows[0]));
  }

  // 3. Create polymorphic pivot record
  const result = await collections.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    rowId: ID.unique(),
    data: {
      tagId,
      tag: key,
      resourceId,
      resourceType,
      userId: actor.$id,
      isPublic,
      isGuest,
      metadata: JSON.stringify({ version: 'v2' })
    }
  });

  // 4. Increment tag usageCount
  try {
    const current = typeof tagRow.usageCount === 'number' ? tagRow.usageCount : 0;
    await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tagId,
      data: { usageCount: current + 1 }
    });
  } catch {}

  return JSON.parse(JSON.stringify(result));
}

export async function untagResourceSecure(
  resourceId: string,
  resourceType: string,
  tagName: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const tagsTable = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
  const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

  const nameLower = tagName.trim().toLowerCase();
  if (!nameLower) throw new Error('Tag name cannot be empty');

  // 1. Lookup tagRow
  const existingTags = await collections.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: tagsTable,
    queries: [
      Query.equal('userId', actor.$id),
      Query.equal('nameLower', nameLower),
      Query.limit(1)
    ] as any
  });
  if (!existingTags.documents.length) return { success: true };

  const tagRow = existingTags.rows[0];
  const tagId = tagRow.$id || tagRow.id;

  // 2. Find polymorphic pivot records
  const existingPivot = await collections.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.equal('tagId', tagId),
      Query.limit(100)
    ] as any
  });

  if (!existingPivot.documents.length) return { success: true };

  // 3. Delete pivot records
  for (const pivot of existingPivot.rows as any[]) {
    try {
      await collections.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: pivotTable,
        rowId: pivot.$id
      });
    } catch {}
  }

  // 4. Decrement tag usageCount
  try {
    const current = typeof tagRow.usageCount === 'number' ? tagRow.usageCount : 0;
    await collections.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tagId,
      data: { usageCount: Math.max(0, current - existingPivot.documents.length) }
    });
  } catch {}

  return { success: true };
}

export async function getResourceTagsSecure(
  resourceId: string,
  resourceType: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

  const pivotRes = await collections.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.limit(100)
    ] as any
  });

  return JSON.parse(JSON.stringify(pivotRes.rows));
}




