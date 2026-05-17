'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role, Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createAdminClient, createAdminTablesDB } from '@/lib/appwrite-admin';
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
 * Reads session cookies to establish identity.
 */
async function getActor() {
  try {
    const { account } = await createServerClient();
    const actor = await account.get().catch(err => {
      console.warn('[secure-ops] Auth failure in account.get():', err?.message);
      return null;
    });
    return actor;
  } catch (err) {
    console.error('[secure-ops] Auth error:', err);
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
  const tables = createAdminTablesDB();
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
    const { databases } = createAdminClient();
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

export async function sharePublicNoteAsMomentSecure(input: { noteId: string; text?: string }) {
  const actor = await getActor();
  if (!actor) throw new Error('Unauthorized');

  const noteId = String(input?.noteId || '').trim();
  const text = String(input?.text || '').trim();
  if (!noteId) throw new Error('noteId is required');

  const { databases } = createAdminClient();
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
  const tables = createAdminTablesDB();
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

  const { databases } = createAdminClient();
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
  const requester = await getActor();
  if (!requester?.$id) throw new Error('Unauthorized');
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) throw new Error('userId is required');

  const { databases } = createAdminClient();
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

export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface PermissionChangeInput {
  userId: string;
  resourceId: string;
  resourceType: 'note' | 'task';
  resourceTitle: string;
  targetUserId: string;
  targetEmail?: string;
  permission: PermissionLevel;
  actorName: string;
}

export async function grantPermissionSecure(input: PermissionChangeInput) {
  const requester = await getActor();
  if (!requester) throw new Error('Unauthorized');

  const { client, users } = createAdminClient();
  const databases = new Databases(client);
  const appwritePerm = input.permission === 'admin' ? 'delete' : input.permission === 'edit' ? 'update' : 'read';

  // Securely resolve the target email if not explicitly provided
  let resolvedEmail = input.targetEmail;
  if (!resolvedEmail) {
    try {
      const targetUser = await users.get(input.targetUserId);
      resolvedEmail = targetUser.email;
    } catch (err) {
      console.warn('Failed to resolve target email for notification:', err);
    }
  }

  // 1. Grant via existing secure internal permissions service (Privileged Pass)
  await permissionsInternal('POST', {
    action: 'grant',
    permission: appwritePerm,
    targetUserId: input.targetUserId,
    resourceId: input.resourceId,
    resourceType: input.resourceType === 'note' ? 'ghost_note' : 'task',
    databaseId: 'chat',
    tableId: input.resourceType === 'note' ? 'notes' : 'tasks',
    rowId: input.resourceId,
  }, requester.$id);

  // 2. Automated Email
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

  return { success: true };
}
