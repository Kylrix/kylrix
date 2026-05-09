'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createAdminClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';

async function getActor() {
  try {
    const { account } = await createServerClient();
    return await account.get();
  } catch {
    return null;
  }
}

function getAdminEmailSet() {
  return new Set(
    String(process.env.ADMINS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isEnvAdminUser(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  return getAdminEmailSet().has(email);
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
  const moment = await databases.createDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.MOMENTS,
    ID.unique(),
    {
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
    [
      Permission.read(Role.user(actor.$id)),
      Permission.update(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id)),
    ],
  );

  let tokenMint: Record<string, unknown> = { accepted: false, reason: 'MINT_FAILED' };
  try {
    tokenMint = await InternalKylrixTokenService.mintForActivity({
      userId: actor.$id,
      idempotencyKey: `mint:share_public_note_moment:${moment.$id}`,
      activityType: 'share_public_note_moment',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'moment_share_note',
      sourceId: moment.$id,
      metadata: { noteId, momentId: moment.$id },
    });
  } catch (error: any) {
    tokenMint = { accepted: false, reason: String(error?.message || 'MINT_FAILED') };
  }

  return { moment, tokenMint };
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
  const admin = isEnvAdminUser(actor);
  if (!action) throw new Error('action is required');

  if (action === 'state') return InternalKylrixTokenService.getState();
  if (action === 'initialize') {
    if (!admin) throw new Error('Forbidden');
    const state = await InternalKylrixTokenService.initializeState();
    return { initialized: true, state };
  }
  if (action === 'mint_activity') {
    if (!admin) throw new Error('Forbidden');
    return InternalKylrixTokenService.mintForActivity({
      userId: String(body?.userId || '').trim(),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
      activityType: body?.activityType,
      uniqueActors: Number(body?.uniqueActors || 0),
      trustScore: Number(body?.trustScore || 0),
      sourceType: String(body?.sourceType || 'activity'),
      sourceId: String(body?.sourceId || ''),
      metadata: body?.metadata || undefined,
    });
  }
  if (action === 'transfer') {
    const fromUserId = String(body?.fromUserId || '').trim();
    if (!admin && fromUserId !== actor.$id) throw new Error('Forbidden');
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
    if (!admin && userId !== actor.$id) throw new Error('Forbidden');
    const rows = await InternalKylrixTokenService.listUserLedger(userId, Number(body?.limit || 100));
    return { rows };
  }
  if (action === 'balance') {
    const userId = String(body?.userId || actor.$id || '').trim();
    if (!admin && userId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.getUserBalance(userId);
  }
  if (action === 'fine_to_root') {
    if (!admin) throw new Error('Forbidden');
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
    if (!admin) throw new Error('Forbidden');
    return InternalKylrixTokenService.lockClaim({
      userId: String(body?.userId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      destinationWallet: String(body?.destinationWallet || '').trim(),
      chain: String(body?.chain || 'sol').trim(),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
    });
  }
  if (action === 'settle_claim') {
    if (!admin) throw new Error('Forbidden');
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
  if (!requester) throw new Error('Unauthorized');
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

export async function getQuickProfileSecure(userId: string) {
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
