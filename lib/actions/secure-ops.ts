'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createAdminClient, createAdminTablesDB } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server-only';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';

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

/** Plain object safe to return from a Server Action (no BigInt / circular refs). */
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

/**
 * After the client creates a moment with a note attachment, verifies row + note (admin) and mints once.
 * No end-user session on the server — trust boundary is admin reads + ledger idempotency.
 */
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
  if (!creatorId) {
    return { tokenMint: { accepted: false, reason: 'INVALID_MOMENT' } };
  }

  const noteId = getNoteAttachmentIdFromMomentFileId(moment?.fileId);
  if (!noteId) {
    return { tokenMint: { accepted: false, reason: 'NO_NOTE_ATTACHMENT' } };
  }

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

  if (!Boolean(note?.isPublic)) {
    return { tokenMint: { accepted: false, reason: 'NOTE_NOT_PUBLIC' } };
  }
  if (!hasWriteAccess(note, creatorId)) {
    return { tokenMint: { accepted: false, reason: 'FORBIDDEN' } };
  }

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

/**
 * Server-side note→moment with admin DB + token mint. Requires Appwrite session cookies on the
 * server (often missing during browser Server Actions). Prefer `SocialService.createMoment` from
 * the Connect client (see Feed compose) so the user's session attaches automatically.
 */
export async function sharePublicNoteAsMomentSecure(input: { noteId: string; text?: string }) {
  
  

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
  // mint_activity removed from generic handler to prevent abuse
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
    if (!isSERVERSDK) throw new Error('Forbidden');
    return InternalKylrixTokenService.lockClaim({
      userId: String(body?.userId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      destinationWallet: String(body?.destinationWallet || '').trim(),
      chain: String(body?.chain || 'sol').trim(),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
    });
  }
  if (action === 'settle_claim') {
    if (!isSERVERSDK) throw new Error('Forbidden');
    return InternalKylrixTokenService.settleClaim({
      userId: String(body?.userId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      destinationWallet: String(body?.destinationWallet || '').trim(),
      chain: String(body?.chain || 'sol').trim(),
      onchainTxHash: String(body?.onchainTxHash || '').trim(),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
    });
  }
  throw new Error(`Unsupported action: ${action}`);
}

export async function mintDailyLoginSecure(input: { userId: string, dateKey: string }) {
  // We use Server SDK credentials for minting tasks.
  // The daily login minting has its own specific trust score and validation logic.
  const { users } = createAdminClient();
  
  try {
      // 1. Verify the user exists on the backend
      const user = await users.get(input.userId);
      if (!user) {
          return { accepted: false, reason: 'INVALID_USER' };
      }

      // 2. Perform the mint operation using Server SDK.
      // We rely on the Ledger's strict IDEMPOTENCY_CONFLICT check to prevent duplicate daily mints,
      // rather than the generic in-memory rate limiter.
      const rawMint = await InternalKylrixTokenService.mintForActivity({
          userId: user.$id,
          idempotencyKey: `mint:daily_login:${input.dateKey}:${user.$id}`,
          activityType: 'daily_login',
          uniqueActors: 1, // Standard daily login weight
          trustScore: 70, // Standard daily login trust score
          sourceType: 'daily_login',
          sourceId: input.dateKey,
          metadata: { action: 'daily_login', date: input.dateKey }
      });
      return serializeTokenMintResult(rawMint);
  } catch (err: any) {
      console.error('[secure-ops] mintDailyLoginSecure failed:', err);
      return { accepted: false, reason: err.message || 'MINT_FAILED' };
  }
}

const VIEWER_COOKIE = 'kylrix_viewer_v1';
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

async function checkActivityRateLimit(userId: string, activityType: string): Promise<boolean> {
  const key = `activity_limit:${userId}:${activityType}`;
  // NOTE: Simple in-memory rate limiting.
  const tracker = (global as any).activityRateLimits || ((global as any).activityRateLimits = {});
  
  const now = Date.now();
  if (!tracker[key] || tracker[key].resetAt < now) {
    tracker[key] = { count: 0, resetAt: now + 3600_000 }; // 1h window
  }
  
  const maxPerHour: Record<string, number> = {
    'chat_message': 100,
    'note_create': 10,
    'call_participate': 5,
    'comment_add': 50,
    'daily_login': 2,
    'referral_signup': 100,
  };
  
  const limit = maxPerHour[activityType] || 50;
  if (tracker[key].count >= limit) return false;
  
  tracker[key].count++;
  return true;
}

async function validateReferralMint(referrerId: string, newUserId: string): Promise<{ valid: boolean; reason?: string }> {
  // Check: Referrer monthly limit
  const lastMonth = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { databases } = createAdminClient();
  const { documents: recent } = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.CHAT, 
    APPWRITE_CONFIG.TABLES.CHAT.KYLRIX_TOKEN_LEDGER, 
    [
      Query.equal('userId', referrerId),
      Query.equal('eventType', 'mint_activity'),
      Query.equal('sourceType', 'referral_signup'),
      Query.greaterThanEqual('createdAt', lastMonth),
      Query.limit(101),
    ]
  );
  
  if (recent.length >= 100) return { valid: false, reason: 'REFERRER_MONTHLY_LIMIT_REACHED' };
  
  // Check: New user account age > 10 min
  const { users } = createAdminClient();
  const newUser = await users.get(newUserId).catch(() => null);
  if (!newUser) return { valid: false, reason: 'NEW_USER_NOT_FOUND' };
  
  const accountAgeSecs = (Date.now() - new Date(newUser.$createdAt).getTime()) / 1000;
  if (accountAgeSecs < 600) return { valid: false, reason: 'NEW_ACCOUNT_TOO_YOUNG' };
  
  return { valid: true };
}

import { KylrixActivityType, KylrixActivitySignal } from '@/lib/sdk/token/contract';

export async function trackEngagementViewSecure(input: Omit<TrackEngagementInput, 'viewerKind' | 'viewerUserId' | 'viewerTokenHash'> & { ip?: string | null; userAgent?: string | null }) {
  
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
  if (!requester) {
    console.warn('[secure-ops] cleanupStaleCallsSecure: Requester unauthenticated, skipping cleanup.');
    return { success: false, reason: 'Unauthorized' };
  }
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
  const requester = await getActor(jwt);
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
