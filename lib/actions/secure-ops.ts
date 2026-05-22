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

/** 
 * Standard actor discovery for Server Actions. 
 * Reads session cookies or explicit JWT to establish identity.
 */
async function getActor(jwt?: string) {
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
    moment = (await tables.getRow(chatDb, momentsTable, momentId)) as Record<string, unknown>;
  } catch {
    return { tokenMint: { accepted: false, reason: 'MOMENT_NOT_FOUND' } };
  }

  const creatorId = String(moment?.userId || '').trim();
  if (!creatorId) return { tokenMint: { accepted: false, reason: 'INVALID_MOMENT' } };

  const noteId = getNoteAttachmentIdFromMomentFileId(moment?.fileId);
  if (!noteId) return { tokenMint: { accepted: false, reason: 'NO_NOTE_ATTACHMENT' } };

  let note: Record<string, unknown>;
  try {
    const { databases } = createSystemClient();
    note = (await databases.getDocument(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      noteId,
    )) as Record<string, unknown>;
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

export async function sharePublicNoteAsMomentSecure(input: { noteId: string; text?: string }) {
  const actor = await getActor();
  if (!actor) throw new Error('Unauthorized');

  const noteId = String(input?.noteId || '').trim();
  const text = String(input?.text || '').trim();
  if (!noteId) throw new Error('noteId is required');

  const { databases } = createSystemClient();
  const note = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    noteId,
  );

  if (!Boolean(note?.isPublic)) throw new Error('Only public notes can be shared as moments');
  if (!hasWriteAccess(note, actor.$id)) throw new Error('Forbidden');

  const noteTitle = String(note?.title || 'Untitled Note').trim();
  const metadata = { type: 'post', attachments: [{ type: 'note', id: noteId }] };
  const now = new Date().toISOString();
  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const momentsTable = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
  const tables = createSystemTablesDB();
  const perms = [
    `read("user:${actor.$id}")`,
    `update("user:${actor.$id}")`,
    `delete("user:${actor.$id}")`,
  ];

  const moment = await tables.createRow(chatDb, momentsTable, ID.unique(), {
    userId: actor.$id,
    caption: text,
    type: 'image',
    momentKind: 'post',
    sourceId: null,
    searchTitle: noteTitle,
    fileId: JSON.stringify(metadata),
    createdAt: now,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }, perms);

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

  const { databases } = createSystemClient();
  const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

  if (cleanupAll && admin) {
    const rows = await databases.listDocuments(DB_ID, LINKS_TABLE, [
      Query.lessThan('expiresAt', new Date().toISOString()),
      Query.limit(500),
    ]);
    for (const row of rows.documents) {
      await databases.deleteDocument(DB_ID, LINKS_TABLE, row.$id);
    }
    return { deleted: rows.documents.length, callIds: rows.documents.map((row) => row.$id) };
  }

  if (targetUserId !== requester.$id && !admin && !callId) throw new Error('Forbidden');

  if (callId) {
    const call = await databases.getDocument(DB_ID, LINKS_TABLE, callId);
    if (String((call as any)?.userId || '') !== (admin ? (targetUserId || requester.$id) : requester.$id)) {
      throw new Error('Forbidden');
    }
    const result = await deleteCallIfExpired(databases as any, callId);
    const presenceUser = targetUserId || requester.$id;
    await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
    return result.deleted ? { deleted: 1, callIds: [callId] } : { deleted: 0, callIds: [] as string[] };
  }

  const expiredRows = await databases.listDocuments(DB_ID, LINKS_TABLE, [
    Query.equal('userId', targetUserId || requester.$id),
    Query.lessThan('expiresAt', new Date().toISOString()),
    Query.limit(200),
  ]);
  for (const row of expiredRows.documents) {
    await databases.deleteDocument(DB_ID, LINKS_TABLE, row.$id);
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

  const { databases } = createSystemClient();
  const getProfile = async () => {
    try {
      const byUserId = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        [Query.equal('userId', targetUserId), Query.limit(1)],
      );
      if (byUserId.documents[0]) return byUserId.documents[0];
    } catch {}
    try {
      return await databases.getDocument(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        targetUserId,
      );
    } catch {
      return null;
    }
  };

  const getWallets = async () => {
    const ownerId = `user:${targetUserId}`;
    const rows = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
      APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS,
      [
        Query.equal('ownerId', ownerId),
        Query.equal('type', 'main'),
        Query.limit(50),
        Query.select(['$id', 'chain', 'address', 'type', 'updatedAt', '$updatedAt']),
      ],
    );
    const dedupedByChain = new Map<string, any>();
    for (const row of rows.documents) {
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
    const { databases } = createSystemClient();
    const noteDoc = await databases.getDocument(dbId, tableId, input.resourceId);
    let meta: any = {};
    try {
      meta = JSON.parse(noteDoc.metadata || '{}');
    } catch {}
    if (!meta.collaborators) {
      meta.collaborators = {};
    }
    meta.collaborators[input.targetUserId] = input.permission; // 'viewer' | 'editor' | 'admin'
    await databases.updateDocument(dbId, tableId, input.resourceId, {
      metadata: JSON.stringify(meta)
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
        const { databases } = createSystemClient();
        const noteDoc = await databases.getDocument(dbId, tableId, input.resourceId);
        let meta: any = {};
        try {
            meta = JSON.parse(noteDoc.metadata || '{}');
        } catch {}
        if (meta.collaborators) {
            delete meta.collaborators[input.targetUserId];
            await databases.updateDocument(dbId, tableId, input.resourceId, {
                metadata: JSON.stringify(meta)
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
            const [, type, userId] = match;
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

    const { databases } = createSystemClient();
    const doc = await databases.getDocument(dbId, tableId, input.resourceId);
    
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

export async function createNoteSecure(data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

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
        const existingTagsRes = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          tagsCollection,
          [Query.equal('userId', userId), Query.equal('nameLower', unique.map((tag: any) => tag.toLowerCase())), Query.limit(unique.length)] as any
        );
        for (const td of existingTagsRes.documents as any[]) {
          if (td.nameLower) existingTagDocs[td.nameLower] = td;
        }
      } catch (tagListErr) {
        console.error('tag preload failed on server', tagListErr);
      }

      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        if (!existingTagDocs[key]) {
          try {
            const created = await databases.createDocument(
              APPWRITE_DATABASE_ID,
              tagsCollection,
              ID.unique(),
              { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 }
            );
            existingTagDocs[key] = created;
          } catch (createTagErr: any) {
            try {
              const retry = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                tagsCollection,
                [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any
              );
              if (retry.documents.length) existingTagDocs[key] = retry.documents[0];
            } catch {}
          }
        }
      }

      const existingPivot = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        noteTagsCollection,
        [Query.equal('noteId', noteId), Query.limit(500)] as any
      );
      const existingPairs = new Set(existingPivot.documents.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        const tagDoc = existingTagDocs[key];
        const tagId = tagDoc ? (tagDoc.$id || tagDoc.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        
        try {
          const res = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            tagsCollection,
            [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any
          );
          if (res.documents.length) {
            const tDoc: any = res.documents[0];
            const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
            await databases.updateDocument(APPWRITE_DATABASE_ID, tagsCollection, tDoc.$id, { usageCount: current + 1 });
          }
        } catch {}

        if (existingPairs.has(pairKey)) continue;
        try {
          await databases.createDocument(
            APPWRITE_DATABASE_ID,
            noteTagsCollection,
            ID.unique(),
            { noteId, tagId, tag: tagName, userId, createdAt: now }
          );
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
      return databases.createDocument(databaseId, tableId, rowId || ID.unique(), data as any, permissions) as any;
    },
    getNote: async (noteId) => {
      const doc = await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId) as any;
      try {
        const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const pivot = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          noteTagsCollection,
          [Query.equal('noteId', noteId), Query.limit(200)] as any
        );
        if (pivot.documents.length) {
          const tags = Array.from(new Set(pivot.documents.map((p: any) => p.tag).filter(Boolean)));
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

async function verifyNotePermission(noteId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const { databases } = createSystemClient();
  const note = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    noteId
  );
  
  const ownerId = String(note.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has all permissions
  }

  let metadata: any = {};
  try {
    metadata = JSON.parse(note.metadata || '{}');
  } catch {}

  const collaborators = metadata.collaborators || {};
  const userRole = collaborators[actorId]; // 'viewer' | 'editor' | 'admin'

  if (!userRole) return false;

  if (minLevel === 'viewer') {
    return ['viewer', 'editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'editor') {
    return ['editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'admin') {
    return userRole === 'admin';
  }
  return false;
}

export async function updateNoteSecure(noteId: string, data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this note');
  }

  const { databases } = createSystemClient();
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

  const doc = await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId, updatedData, permissions) as any;

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
          const existingTagsRes = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            tagsCollection,
            [Query.equal('userId', actor.$id), Query.equal('nameLower', normalizedIncoming.map(t => t.toLowerCase())), Query.limit(normalizedIncoming.length)] as any
          );
          for (const td of existingTagsRes.documents as any[]) {
            if (td.nameLower) tagDocs[td.nameLower] = td;
          }
        } catch (preErr) {
          console.error('updateNoteSecure tag preload failed', preErr);
        }
        for (const tagName of normalizedIncoming) {
          const key = tagName.toLowerCase();
          if (!tagDocs[key]) {
            try {
              const created = await databases.createDocument(
                APPWRITE_DATABASE_ID,
                tagsCollection,
                ID.unique(),
                { name: tagName, nameLower: key, userId: actor.$id, createdAt: updatedAt, usageCount: 0 }
              );
              tagDocs[key] = created;
            } catch (createErr) {
              try {
                const retry = await databases.listDocuments(
                  APPWRITE_DATABASE_ID,
                  tagsCollection,
                  [Query.equal('userId', actor.$id), Query.equal('nameLower', key), Query.limit(1)] as any
                );
                if (retry.documents.length) tagDocs[key] = retry.documents[0];
              } catch {}
            }
          }
        }
      }

      const existingPivot = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        noteTagsCollection,
        [Query.equal('noteId', noteId), Query.limit(500)] as any
      );
      const existingByTag: Record<string, any> = {};
      const existingPairs = new Set<string>();
      for (const p of existingPivot.documents as any[]) {
        if (p.tag) existingByTag[p.tag] = p;
        if (p.tagId && p.tag) existingPairs.add(`${p.tagId}::${p.tag}`);
      }

      for (const p of existingPivot.documents as any[]) {
        if (!p.tagId && p.tag) {
          const key = p.tag.toLowerCase();
          const tagDoc = tagDocs[key];
          if (tagDoc) {
            try {
              await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                noteTagsCollection,
                p.$id,
                { tagId: tagDoc.$id || tagDoc.id }
              );
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
          const res = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_TABLE_ID_TAGS,
            [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any
          );
          if (res.documents.length) {
            const tDoc: any = res.documents[0];
            const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
            await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tDoc.$id, { usageCount: current + 1 });
          }
        } catch {}

        try {
          await databases.createDocument(
            APPWRITE_DATABASE_ID,
            noteTagsCollection,
            ID.unique(),
            { noteId, tagId, tag: tagName, userId: actor.$id, createdAt: updatedAt }
          );
          existingPairs.add(pairKey);
        } catch (ie) {
          console.error('note_tags create (updateNoteSecure) failed', ie);
        }
      }

      for (const [tagName, pivotDoc] of Object.entries(existingByTag)) {
        if (!incomingSet.has(tagName)) {
          try {
            const res = await databases.listDocuments(
              APPWRITE_DATABASE_ID,
              APPWRITE_TABLE_ID_TAGS,
              [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any
            );
            if (res.documents.length) {
              const tDoc: any = res.documents[0];
              const current = typeof tDoc.usageCount === 'number' && !isNaN(tDoc.usageCount) ? tDoc.usageCount : 0;
              await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tDoc.$id, { usageCount: Math.max(0, current - 1) });
            }
          } catch {}

          try {
            await databases.deleteDocument(
              APPWRITE_DATABASE_ID,
              noteTagsCollection,
              (pivotDoc as any).$id
            );
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

export async function deleteNoteSecure(noteId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this note');
  }

  const { databases } = createSystemClient();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;

  try {
    try {
      const reactionsRes = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_CONFIG.TABLES.NOTE.REACTIONS,
        [Query.equal('targetId', noteId), Query.limit(1000)] as any
      );
      await Promise.all(
        reactionsRes.documents.map((r: any) =>
          databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_CONFIG.TABLES.NOTE.REACTIONS, r.$id)
        )
      );
    } catch {}

    try {
      const mappingsRes = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASES.VAULT,
        'key_mapping',
        [
          Query.equal('resourceType', 'note'),
          Query.equal('resourceId', noteId),
          Query.limit(1000),
        ] as any
      );
      await Promise.all(
        (mappingsRes.documents as any[]).map((mapping) =>
          databases.deleteDocument(APPWRITE_CONFIG.DATABASES.VAULT, 'key_mapping', mapping.$id)
        )
      );
    } catch (err) {
      console.error('deleteNoteSecure key_mapping cleanup failed:', err);
    }

    const commentsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_COMMENTS,
      [Query.equal('noteId', noteId), Query.limit(1000)] as any
    );
    const commentIds = (commentsRes.documents as any[]).map((c) => c.$id).filter(Boolean);
    if (commentIds.length) {
      try {
        const reactionsRes = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_CONFIG.TABLES.NOTE.REACTIONS,
          [Query.equal('targetType', 'comment'), Query.equal('targetId', commentIds), Query.limit(1000)] as any
        );
        await Promise.all(
          reactionsRes.documents.map((r: any) =>
            databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_CONFIG.TABLES.NOTE.REACTIONS, r.$id)
          )
        );
      } catch {}

      await Promise.all(
        commentIds.map((id) => databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, id))
      );
    }
  } catch (err: any) {
    console.error('deleteNoteSecure cascade cleanup failed:', err);
  }

  const result = await databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId);
  return JSON.parse(JSON.stringify(result));
}

// ==========================================
// PROJECT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyProjectPermission(projectId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const { databases } = createSystemClient();
  const project = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId
  );
  
  const ownerId = String(project.ownerId || project.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has full permissions
  }

  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}

  const collaborators = metadata.collaborators || {};
  const userRole = collaborators[actorId]; // 'viewer' | 'editor' | 'admin'

  if (!userRole) return false;

  if (minLevel === 'viewer') {
    return ['viewer', 'editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'editor') {
    return ['editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'admin') {
    return userRole === 'admin';
  }
  return false;
}

export async function createProjectSecure(data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const now = new Date().toISOString();
  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.update(Role.user(actor.$id)),
    Permission.delete(Role.user(actor.$id)),
  ];

  const project = await databases.createDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    ID.unique(),
    {
      ...data,
      ownerId: actor.$id,
      createdAt: now,
      updatedAt: now,
    },
    permissions
  );

  return JSON.parse(JSON.stringify(project));
}

export async function updateProjectSecure(projectId: string, data: any, permissions?: string[]) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this project');
  }

  const { databases } = createSystemClient();
  const now = new Date().toISOString();
  
  const project = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId,
    {
      ...data,
      updatedAt: now,
    },
    permissions
  );

  return JSON.parse(JSON.stringify(project));
}

export async function deleteProjectSecure(projectId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this project');
  }

  const { databases } = createSystemClient();

  // Cascade delete all object links
  try {
    const objects = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.CHAT,
      'project_objects',
      [Query.equal('projectId', projectId)] as any
    );
    await Promise.all(
      objects.documents.map((obj) =>
        databases.deleteDocument(APPWRITE_CONFIG.DATABASES.CHAT, 'project_objects', obj.$id)
      )
    );
  } catch (err) {
    console.error('deleteProjectSecure cascade objects cleanup failed:', err);
  }

  const result = await databases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId
  );

  return JSON.parse(JSON.stringify(result));
}

export async function addProjectCollaboratorSecure(projectId: string, targetUserId: string, permissionLevel: string = 'viewer') {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const { databases } = createSystemClient();

  // 1. Fetch current project to update permissions
  const project = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId
  );

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

  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId,
    {
      metadata: JSON.stringify(metadata),
    },
    Array.from(newPermissions)
  );

  // 2. Add object link in project_objects (if not already exists)
  const existingObjects = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'project_objects',
    [
      Query.equal('projectId', projectId),
      Query.equal('entityKind', 'collaborator'),
      Query.equal('entityId', targetUserId),
    ] as any
  );

  let objLink;
  const now = new Date().toISOString();
  if (existingObjects.documents.length > 0) {
    // Update existing
    objLink = await databases.updateDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      'project_objects',
      existingObjects.documents[0].$id,
      {
        role: permissionLevel,
        updatedAt: now,
      }
    );
  } else {
    // Create new project_objects row
    const objectPermissions = [
      Permission.read(Role.user(actor.$id)),
      Permission.update(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id)),
      Permission.read(Role.user(targetUserId)),
    ];
    objLink = await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      'project_objects',
      ID.unique(),
      {
        projectId,
        entityKind: 'collaborator',
        entityId: targetUserId,
        role: permissionLevel,
        createdAt: now,
        updatedAt: now,
      },
      objectPermissions
    );
  }

  return JSON.parse(JSON.stringify(objLink));
}

export async function removeProjectCollaboratorSecure(projectId: string, targetUserId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const { databases } = createSystemClient();

  // 1. Fetch current project to update permissions
  const project = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId
  );

  // Remove physical read permission
  const rawPermissions = project.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")` && p !== `update("user:${targetUserId}")` && p !== `delete("user:${targetUserId}")`;
  });

  // Remove from metadata.collaborators
  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}
  if (metadata.collaborators) {
    delete metadata.collaborators[targetUserId];
  }

  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId,
    {
      metadata: JSON.stringify(metadata),
    },
    updatedPerms
  );

  // 2. Remove all collaborator objects from project_objects
  try {
    const objects = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.CHAT,
      'project_objects',
      [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', targetUserId),
      ] as any
    );
    await Promise.all(
      objects.documents.map((obj) =>
        databases.deleteDocument(APPWRITE_CONFIG.DATABASES.CHAT, 'project_objects', obj.$id)
      )
    );
  } catch (err) {
    console.error('removeProjectCollaboratorSecure objects cleanup failed:', err);
  }

  return { success: true };
}

// ==========================================
// FORM COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyFormPermission(formId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const { databases } = createSystemClient();
  const form = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId
  );
  
  const ownerId = String(form.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has all permissions
  }

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}

  const collaborators = settings.collaborators || {};
  const userRole = collaborators[actorId]; // 'viewer' | 'editor' | 'admin'

  if (!userRole) return false;

  if (minLevel === 'viewer') {
    return ['viewer', 'editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'editor') {
    return ['editor', 'admin'].includes(userRole);
  }
  if (minLevel === 'admin') {
    return userRole === 'admin';
  }
  return false;
}

export async function createFormSecure(data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.read(Role.any()), // Allow public discovery via listRows filter
    Permission.update(Role.user(actor.$id)),
    Permission.delete(Role.user(actor.$id)),
  ];

  const form = await databases.createDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    ID.unique(),
    {
      ...data,
      userId: actor.$id,
      status: data.status || 'draft',
    },
    permissions
  );

  return JSON.parse(JSON.stringify(form));
}

export async function updateFormSecure(formId: string, data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this form');
  }

  const { databases } = createSystemClient();

  const form = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId
  );

  const ownerId = form.userId;
  const currentStatus = data.status || form.status;

  const permissions = [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
  ];

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

  const updatedForm = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId,
    data,
    permissions
  );

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function deleteFormSecure(formId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this form');
  }

  const { databases } = createSystemClient();
  const result = await databases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId
  );

  return JSON.parse(JSON.stringify(result));
}

export async function addFormCollaboratorSecure(formId: string, targetUserId: string, permissionLevel: string = 'viewer') {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const { databases } = createSystemClient();

  const form = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId
  );

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

  const updatedForm = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId,
    {
      settings: JSON.stringify(settings),
    },
    Array.from(permissions)
  );

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function removeFormCollaboratorSecure(formId: string, targetUserId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const { databases } = createSystemClient();

  const form = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId
  );

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (settings.collaborators) {
    delete settings.collaborators[targetUserId];
  }

  const rawPermissions = form.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")` && p !== `update("user:${targetUserId}")` && p !== `delete("user:${targetUserId}")`;
  });

  const updatedForm = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    formId,
    {
      settings: JSON.stringify(settings),
    },
    updatedPerms
  );

  return JSON.parse(JSON.stringify(updatedForm));
}

// ==========================================
// EVENT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================

async function verifyEventPermission(eventId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const { databases } = createSystemClient();
  const event = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId
  );
  
  const ownerId = String(event.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has full permissions
  }

  const guestsRes = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
    [
      Query.equal('eventId', eventId),
      Query.equal('userId', actorId),
      Query.limit(1)
    ] as any
  );

  if (guestsRes.documents.length === 0) return false;

  const guest = guestsRes.documents[0];
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

export async function createEventSecure(data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.update(Role.user(actor.$id)),
    Permission.delete(Role.user(actor.$id)),
  ];

  const event = await databases.createDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    ID.unique(),
    {
      ...data,
      userId: actor.$id,
    },
    permissions
  );

  return JSON.parse(JSON.stringify(event));
}

export async function updateEventSecure(eventId: string, data: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this event');
  }

  const { databases } = createSystemClient();

  const event = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId
  );

  const ownerId = event.userId;
  const permissions = [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
  ];

  // Include physical read permissions for all manager guests
  try {
    const guestsRes = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      [Query.equal('eventId', eventId)] as any
    );
    guestsRes.documents.forEach((g: any) => {
      if (g.userId && String(g.role || '').startsWith('manager-')) {
        permissions.push(Permission.read(Role.user(g.userId)));
      }
    });
  } catch (err) {
    console.error('Failed to query manager physical read permissions in updateEventSecure', err);
  }

  const updatedEvent = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId,
    data,
    permissions
  );

  return JSON.parse(JSON.stringify(updatedEvent));
}

export async function deleteEventSecure(eventId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this event');
  }

  const { databases } = createSystemClient();

  // Cascade delete guests
  try {
    const guestsRes = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      [Query.equal('eventId', eventId)] as any
    );
    await Promise.all(
      guestsRes.documents.map((g) =>
        databases.deleteDocument(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.GUESTS, g.$id)
      )
    );
  } catch (err) {
    console.error('deleteEventSecure cascade guests cleanup failed:', err);
  }

  const result = await databases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId
  );

  return JSON.parse(JSON.stringify(result));
}

export async function addEventManagerSecure(eventId: string, targetUserId: string, permissionLevel: string = 'viewer') {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const { databases } = createSystemClient();

  // 1. Fetch current event to update permissions
  const event = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId
  );

  // Update physical permissions: add READ permission only
  const permissions = new Set(event.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId,
    {},
    Array.from(permissions)
  );

  // 2. Add or update Guest entry
  const guestsRes = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
    [
      Query.equal('eventId', eventId),
      Query.equal('userId', targetUserId),
    ] as any
  );

  const virtualRole = `manager-${permissionLevel}`;
  let guestDoc;
  if (guestsRes.documents.length > 0) {
    // Update role
    guestDoc = await databases.updateDocument(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      guestsRes.documents[0].$id,
      {
        role: virtualRole,
      }
    );
  } else {
    // Create new
    guestDoc = await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      ID.unique(),
      {
        eventId,
        userId: targetUserId,
        role: virtualRole,
        status: 'attending',
      }
    );
  }

  return JSON.parse(JSON.stringify(guestDoc));
}

export async function removeEventManagerSecure(eventId: string, targetUserId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const { databases } = createSystemClient();

  // 1. Fetch current event to update permissions
  const event = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId
  );

  // Remove physical read permission
  const rawPermissions = event.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")` && p !== `update("user:${targetUserId}")` && p !== `delete("user:${targetUserId}")`;
  });

  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    eventId,
    {},
    updatedPerms
  );

  // 2. Remove Guest entry if it was a manager
  try {
    const guestsRes = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', targetUserId),
      ] as any
    );
    await Promise.all(
      guestsRes.documents.map((g: any) => {
        if (String(g.role || '').startsWith('manager-')) {
          return databases.deleteDocument(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.GUESTS, g.$id);
        }
        return Promise.resolve();
      })
    );
  } catch (err) {
    console.error('removeEventManagerSecure cleanup failed:', err);
  }

  return { success: true };
}

// ==========================================
// CALLS & HUDDLES COHOST SECURE ACTIONS
// ==========================================

export async function addCallCohostSecureAction(callId: string, cohostId: string, allowEndCall: boolean = false) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const call = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId
  );

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

  const updatedCall = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId,
    {
      metadata: JSON.stringify(meta),
    },
    Array.from(permissions)
  );

  return JSON.parse(JSON.stringify(updatedCall));
}

export async function endCallSecureAction(callId: string) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const call = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId
  );

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

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

  const result = await databases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId
  );

  return JSON.parse(JSON.stringify(result));
}

export async function updateCallMetadataSecureAction(callId: string, extraMetadata: any) {
  const actor = await getActor();
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { databases } = createSystemClient();
  const call = await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId
  );

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

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

  const updatedCall = await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    callId,
    {
      metadata: JSON.stringify(mergedMeta),
    }
  );

  return JSON.parse(JSON.stringify(updatedCall));
}

