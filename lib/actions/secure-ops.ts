'use server';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role, Databases, TablesDB, Account } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { Registry } from '@/lib/core/di/registry';
import { createServerClient } from '@/lib/appwrite/server';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { applyPermissionMutation, revokePermissionMutation } from '@/lib/services/internal/permissions';
import { normalizeTargetUserIds, upsertLockboxRows, provisionHybridTeamExpansionSecure } from '@/lib/api/permission-updater';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';
import { executeSessionRuntimeJob, isSessionRuntimeJobId } from '@/lib/runtime-functions/session-jobs';
import { normalizeMfaFactors, sessionNeedsTotpMfa } from '@/lib/mfa-session';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';
import { permissionsInternal } from '@/lib/services/internal/permissions';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { dispatchSecureNotification } from '@/lib/services/internal/notification-dispatcher';
import { executeCascadeDeleteSecure } from './cascade-delete';
import { verifyCreatorDeletionProof } from '@/lib/ephemeral/ephemeral-proof';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import { 
  MutatePermissionsSchema, 
  IDSchema, 
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema,
  NoteSchema,
  ProjectSchema,
  EventSchema,
  FormSchema,
  TokenOperationSchema,
  TelemetrySchema,
  EphemeralNoteSchema,
  SuggestionParamsSchema
} from '@/lib/validations/schemas';

/**
 * Updates row-level permissions for a resource.
 * Replaces legacy POST /api/permissions.
 */
export async function mutatePermissionsSecure(body: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  // Rigorous runtime validation
  const validated = MutatePermissionsSchema.parse(body);
  const action = validated.action;

  if (action === 'pin_ghost_note') {
    const noteIds = normalizeTargetUserIds(validated.noteIds || validated.resourceIds || validated.resourceId);
    const wrappedKey = validated.wrappedKey || validated.ghostSecret;
    if (noteIds.length === 0) throw new Error('At least one noteId is required');
    if (!wrappedKey) throw new Error('wrappedKey is required');

    const keyMappings = noteIds.map((noteId) => ({
      resourceId: noteId,
      resourceType: validated.resourceType || 'ghost_note',
      grantee: actor.$id,
      wrappedKey,
      metadata: validated.metadata || null,
    }));
    const { databases } = createSystemClient();
    const rows = await upsertLockboxRows(databases, actor.$id, keyMappings);
    return { success: true, action, rows };
  }

  const result = await applyPermissionMutation(actor.$id, validated);
  return {
    success: true,
    action,
    rowId: validated.rowId || null,
    permissions: (result as any)?.permissions || null,
  };
}

/**
 * Revokes row-level permissions for a resource.
 * Replaces legacy DELETE /api/permissions.
 */
export async function revokePermissionsSecure(body: any, targetUserId?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  // Rigorous runtime validation
  const validated = MutatePermissionsSchema.parse(body);
  const validatedTargetUserId = IDSchema.optional().parse(targetUserId);

  await revokePermissionMutation(actor.$id, validated, validatedTargetUserId);
  return { success: true, action: 'revoke', rowId: validated.rowId || null };
}

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
  const db = Registry.getDatabase();
  const row = await db.getRow<any>(params.databaseId, params.tableId, params.rowId, { forceSystem: true });
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
    const actor = await Registry.getAuth().getActor(jwt);
    if (actor) {
        console.log('[secure-ops] Actor established via AuthPort:', actor.$id, actor.email);
    } else {
        console.warn('[secure-ops] Actor discovery via AuthPort returned null');
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

export async function recordAnonymizedTelemetrySecure(params: {
  niche: any;
  app: string;
  action: string;
  intent?: string | null;
  metadata?: any | null;
}) {
  const { TelemetryService } = await import('@/lib/services/telemetry');
  return await TelemetryService.recordTelemetry({
    niche: params.niche,
    app: params.app,
    action: params.action,
    intent: params.intent || null,
    metadata: params.metadata || null
  });
}

/**
 * Session-scoped privileged maintenance (current user only).
 * Replaces legacy /api/me/runtime-functions route.
 */
export async function executeSessionRuntimeJobSecure(job: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  if (!isSessionRuntimeJobId(job)) {
    throw new Error('Unknown or forbidden job');
  }

  return executeSessionRuntimeJob(job, actor.$id);
}

/**
 * Burns an ephemeral ghost / Send row using a per-note deletion secret.
 * Replaces legacy /api/ephemeral-note/delete.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function burnEphemeralNoteSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = EphemeralNoteSchema.parse({ noteId: params.noteId, secret: params.deletionSecret });
  const validatedJwt = JWTSchema.parse(jwt);

  const noteId = validated.noteId;
  const deletionSecret = validated.secret;

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // Parallel Fetch: Actor identity + Note document
  const [actor, doc] = await Promise.all([
    getActor(validatedJwt),
    databases.getRow(dbId, tableId, noteId).catch(() => null)
  ]);

  // We don't strictly REQUIRE actor for burning as it's often done anonymously via secret link
  // but we should log it if they ARE logged in.
  console.log(`[burnEphemeralNoteSecure] Burn requested for note ${noteId} by actor ${actor?.$id || 'anonymous'}`);

  if (!doc) {
    throw new Error('Note not found');
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String((doc as any).metadata || '{}'));
  } catch {
    meta = {};
  }

  if (!meta.isGhost) {
    throw new Error('Not an ephemeral note');
  }

  const expectedHash = String(meta.creatorDeletionProofHash || '').trim();
  if (!expectedHash) {
    throw new Error('This note cannot be burned remotely');
  }

  if (!verifyCreatorDeletionProof(meta, deletionSecret)) {
    throw new Error('Invalid deletion proof');
  }

  // Recursive cleanup for storage files, comments, reactions, etc.
  await executeCascadeDeleteSecure(dbId, tableId, noteId);

  await databases.deleteRow(dbId, tableId, noteId);
  return { success: true };
}

/**
 * Removes the ghost row (and Send ciphertext file) after successful import.
 * Replaces legacy /api/ephemeral-note/consume.
 */
export async function consumeEphemeralNoteSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = EphemeralNoteSchema.parse({ noteId: params.noteId, secret: params.claimSecret });
  const validatedJwt = JWTSchema.parse(jwt);

  const noteId = validated.noteId;
  const claimSecret = validated.secret;

  const { databases, storage } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // Parallel Fetch: Actor identity + Note document
  const [actor, doc] = await Promise.all([
    getActor(validatedJwt),
    databases.getRow(dbId, tableId, noteId).catch(() => null)
  ]);

  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  if (!doc) {
    throw new Error('Note not found');
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String((doc as any).metadata || '{}'));
  } catch {
    meta = {};
  }

  if (!meta.isGhost) {
    throw new Error('Not an ephemeral note');
  }

  if (!verifyCreatorDeletionProof(meta, claimSecret)) {
    throw new Error('Invalid claim proof');
  }

  const sendObj = meta.send_object as { kind?: string; bucketId?: string; fileId?: string } | undefined;
  if (sendObj?.kind === 'file' && !hasPaidKylrixPlan(actor)) {
    const err = new Error('Kylrix Pro is required to claim Send files into your library.');
    (err as any).code = 'PRO_REQUIRED';
    throw err;
  }

  if (sendObj?.kind === 'file' && sendObj.bucketId && sendObj.fileId) {
    await storage.deleteFile(sendObj.bucketId, sendObj.fileId).catch(() => undefined);
  }

  await databases.deleteRow(dbId, tableId, noteId);
  return { success: true };
}

/**
 * Dispatches an unorganic email notification.
 * Replaces legacy /api/emails route.
 */
export async function dispatchEmailSecure(payload: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    // We allow unauthenticated dispatch ONLY if it's a dry run or if there's no actor but we have a recipient email
    // However, the legacy API was authorized via verifyUser or a secret.
    // For Server Actions, we'll require an actor for now unless specified.
    throw new Error('Unauthorized');
  }

  return dispatchEmail({
    ...payload,
    actorId: actor.$id,
    actorName: actor.name || actor.email || payload.actorName,
  });
}

/**
 * Creates a temporal session token for app handoff.
 * Replaces legacy /api/auth/session route.
 */
export async function createHandoffSessionSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  // Session context verification (MFA check)
  const { account: userAccount } = await createServerClient();

  const [session, factors] = await Promise.all([
    userAccount.getSession('current').catch(() => null),
    userAccount.listMfaFactors().catch(() => null)
  ]);

  if (sessionNeedsTotpMfa({
    session,
    availableFactors: normalizeMfaFactors(factors),
  })) {
    const err = new Error('user_more_factors_required');
    (err as any).code = 'MFA_REQUIRED';
    throw err;
  }

  const { users } = createSystemClient();
  const sessionToken = await users.createToken(actor.$id);

  return {
    userId: actor.$id,
    secret: sessionToken.secret,
    expire: sessionToken.expire,
  };
}

/**
 * Resolves user names and avatars for a list of user IDs.
 * Replaces legacy /api/shared/profiles route.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function getSharedProfilesSecure(userIds: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { rows: [] };
  }

  // Limit to 100 users per request for safety
  const targetIds = userIds.slice(0, 100);

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  const res = await databases.listRows(
    dbId,
    tableId,
    [
      Query.equal('$id', targetIds),
      Query.limit(targetIds.length),
      Query.select(['$id', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey'])
    ]
  );

  const publicProfiles = res.rows.map(doc => ({
    $id: doc.$id,
    name: doc.displayName || doc.username,
    displayName: doc.displayName || null,
    username: doc.username,
    avatar: doc.avatar || null,
    bio: doc.bio || null,
    walletAddress: doc.walletAddress || null,
    publicKey: doc.publicKey || null,
  }));

  return { rows: publicProfiles };
}

/**
 * Fetches a public note and its metadata.
 * Replaces legacy /api/shared/[noteid] route.
 */
/**
 * Read-only public goal/task payload for /flow/goal/[id] guest pages.
 */
export async function getPublicGoalDataSecure(goalId: string) {
  const tables = createSystemTablesDB();
  const row = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: goalId,
  }).catch(() => null);

  if (!row) return null;

  const isGuest = row.isGuest === true;
  const isPublic = row.isPublic === true;
  if (!isGuest && !isPublic) return null;

  return JSON.parse(JSON.stringify({
    id: row.$id,
    title: row.title || 'Untitled goal',
    description: row.description || null,
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    dueDate: row.dueDate || null,
    isPublic,
    isGuest,
    updatedAt: row.$updatedAt,
  }));
}

export async function getPublicNoteDataSecure(noteId: string) {
  const note = await validatePublicNoteAccess(noteId);
  if (!note) return null;

  // Stale call cleanup
  const metadata = JSON.parse(String((note as any).metadata || '{}'));
  const huddleCallId = (note as any).huddleCallId || metadata.huddleCallId;
  if (huddleCallId) {
    try {
      const { databases } = createSystemClient();
      await deleteCallIfExpired(databases as any, huddleCallId);
    } catch {}
  }

  return note;
}

/**
 * Fetches comments for a public note.
 * Replaces legacy /api/shared/[noteid]/comments route.
 */
export async function getPublicNoteCommentsSecure(noteId: string) {
  const note = await validatePublicNoteAccess(noteId);
  if (!note) throw new Error('Note not found or not public');

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    [
      Query.equal('noteId', noteId),
      Query.orderAsc('$createdAt'),
      Query.limit(200)
    ]
  );
  return { rows: res.rows };
}

/**
 * Fetches reactions for a public note or target.
 * Replaces legacy /api/shared/[noteid]/reactions route.
 */
export async function getPublicNoteReactionsSecure(noteId: string, targetId?: string, targetType?: string) {
  const note = await validatePublicNoteAccess(noteId);
  if (!note) throw new Error('Note not found or not public');

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.REACTIONS,
    [
      Query.equal('targetType', targetType || 'note'),
      Query.equal('targetId', targetId || noteId),
      Query.orderAsc('$createdAt'),
      Query.limit(500)
    ]
  );
  return { rows: res.rows };
}

/**
 * Fetches referral status and links for the current user.
 * Replaces legacy GET /api/referrals.
 */
export async function getReferralStatusSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  
  const [profiles, events] = await Promise.all([
    databases.listRows(dbId, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
      Query.equal('userId', actor.$id),
      Query.limit(1)
    ]),
    databases.listRows(dbId, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, [
      Query.equal('userId', actor.$id),
      Query.equal('type', 'referral'),
      Query.limit(1)
    ]),
  ]);
  const profile = profiles.rows[0] || null;
  const referralEvent = events.rows[0] || null;

  const referrerProfile = referralEvent?.actorId ? await databases.getRow(dbId, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, referralEvent.actorId).catch(() => null) : null;

  const username = profile?.username || (actor as any).prefs?.username || null;
  const referralLink = username ? `https://www.kylrix.space/referral/${encodeURIComponent(username)}` : null;

  return {
    success: true,
    referralLink,
    currentUsername: username,
    hasReferral: Boolean(referralEvent),
    referralEvent: referralEvent || null,
    referrer: referrerProfile
      ? {
          userId: referrerProfile.userId || referrerProfile.$id,
          username: referrerProfile.username,
          displayName: referrerProfile.displayName || referrerProfile.username,
          avatar: referrerProfile.avatar || null,
        }
      : null,
  };
}

/**
 * Applies a referral to the current user.
 * Replaces legacy POST /api/referrals.
 */
export async function applyReferralSecure(params: { referrerUsername?: string; referrerUserId?: string }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const eventsTableId = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

  // Check existing
  const existing = await databases.listRows(dbId, eventsTableId, [
    Query.equal('userId', actor.$id),
    Query.equal('type', 'referral'),
    Query.limit(1)
  ]);
  if (existing.total > 0) return { success: true, alreadyReferred: true };

  let referrerProfile = null;
  if (params.referrerUserId) {
    referrerProfile = await databases.getRow(dbId, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, params.referrerUserId).catch(() => null);
  } else if (params.referrerUsername) {
    const res = await databases.listRows(dbId, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
      Query.equal('username', params.referrerUsername),
      Query.limit(1)
    ]);
    referrerProfile = res.rows[0] || null;
  }

  if (!referrerProfile) throw new Error('Referrer not found');
  if (referrerProfile.userId === actor.$id || referrerProfile.$id === actor.$id) throw new Error('Self referral not allowed');

  const referrerId = referrerProfile.userId || referrerProfile.$id;

  const event = await databases.createRow(dbId, eventsTableId, ID.unique(), {
    userId: actor.$id,
    type: 'referral',
    actorId: referrerId,
    relatedUserId: referrerId,
    delta: 10,
    status: 'active',
    metadata: JSON.stringify({
      source: 'referral-link',
      referrerUsername: referrerProfile.username,
      referrerUserId: referrerId,
      refereeUserId: actor.$id,
    }),
  }, [Permission.read(Role.user(actor.$id))]);

  // Reward referrer
  await databases.createRow(dbId, eventsTableId, ID.unique(), {
    userId: referrerId,
    type: 'reputation',
    actorId: actor.$id,
    relatedUserId: actor.$id,
    delta: 10,
    status: 'active',
    metadata: JSON.stringify({
      source: 'referral-reward',
      referrerUsername: referrerProfile.username,
      referrerUserId: referrerId,
      refereeUserId: actor.$id,
    }),
  }, [Permission.read(Role.user(referrerId))]);

  return { success: true, applied: true, referralEvent: event };
}

/**
 * Resolves a referral profile by username.
 * Replaces legacy GET /api/referrals/[username].
 */
export async function getReferralProfileSecure(username: string) {
  const cleaned = String(username || '').trim().replace(/^@+/, '').toLowerCase();
  if (!cleaned) throw new Error('Invalid username');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  const res = await databases.listRows(dbId, tableId, [
    Query.equal('username', cleaned),
    Query.limit(1)
  ]);

  const profile = res.rows[0] || null;
  if (!profile || !profile.username) throw new Error('Profile not found');

  return {
    success: true,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    avatar: profile.avatar || null,
    userId: profile.userId || profile.$id,
    referralLink: `https://www.kylrix.space/referral/${encodeURIComponent(profile.username)}`,
  };
}

/**
 * MASTER PURGE: Wipes all Tier 2 (Zero-Knowledge) data for the authenticated actor.
 * Triggered upon Master Password Reset.
 * Replaces legacy POST /api/reset-purge.
 */
export async function executeMasterPurgeSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const userId = actor.$id;
  const { databases, users } = createSystemClient();

  const vaultDb = APPWRITE_CONFIG.DATABASES.VAULT;
  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const passwordDb = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
  
  // Parallel Discovery Sweep: Scan all domains for Tier 2 footprint concurrently
  const [
    credsRes, 
    totpsRes, 
    memberRowsRes, 
    identitiesRes, 
    mappingsRes, 
    profilesRes
  ] = await Promise.all([
    // 1. Vault
    databases.listRows(vaultDb, APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN, [Query.equal('userId', userId), Query.limit(1000)]),
    databases.listRows(vaultDb, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets', [Query.equal('userId', userId), Query.limit(1000)]).catch(() => ({ rows: [] })),
    // 2. Connect
    databases.listRows(chatDb, 'conversationMembers', [Query.equal('userId', userId), Query.limit(1000)]),
    // 3. Keychain
    databases.listRows(passwordDb, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES, [Query.equal('userId', userId), Query.limit(100)]),
    databases.listRows(passwordDb, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING, [
        Query.or([Query.equal('grantee', userId), Query.contains('metadata', userId), Query.equal('resourceId', userId)]),
        Query.limit(1000)
    ]),
    // 4. Profiles
    databases.listRows(chatDb, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [Query.equal('userId', userId), Query.limit(1)])
  ]);

  // Parallel Execution Phase: Trigger all deletions and updates concurrently
  const purgeActions: Promise<any>[] = [];

  // 1. Purge Vault
  credsRes.rows.forEach((c: any) => purgeActions.push(databases.deleteRow(vaultDb, APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN, c.$id)));
  totpsRes.rows.forEach((t: any) => purgeActions.push(databases.deleteRow(vaultDb, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets', t.$id)));

  // 2. Purge Connect (Direct Messages)
  const conversationIds = Array.from(new Set(memberRowsRes.rows.map((row: any) => row.conversationId).filter(Boolean)));
  if (conversationIds.length > 0) {
    // This is still a bit complex for a flat Promise.all, let's keep it sequential or sub-parallel
    purgeActions.push((async () => {
        const convsRes = await databases.listRows(chatDb, APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS, [Query.equal('$id', conversationIds), Query.equal('type', 'direct')]);
        const subActions: Promise<any>[] = [];
        for (const conv of convsRes.rows) {
          const isSelfChat = conv.participants.every((p: string) => p === userId);
          const msgsRes = await databases.listRows(chatDb, APPWRITE_CONFIG.TABLES.CHAT.MESSAGES, [Query.equal('conversationId', conv.$id), Query.equal('senderId', userId), Query.limit(1000)]);
          msgsRes.rows.forEach(m => subActions.push(databases.deleteRow(chatDb, APPWRITE_CONFIG.TABLES.CHAT.MESSAGES, m.$id)));
          if (isSelfChat) subActions.push(databases.deleteRow(chatDb, APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS, conv.$id));
        }
        await Promise.all(subActions);
    })());
  }

  // 3. Purge Keychain
  identitiesRes.rows.forEach(id => purgeActions.push(databases.deleteRow(passwordDb, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES, id.$id)));
  mappingsRes.rows.forEach(m => purgeActions.push(databases.deleteRow(passwordDb, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING, m.$id)));

  // 4. Reset Profiles
  if (profilesRes.total > 0) {
    purgeActions.push(databases.updateRow(chatDb, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, profilesRes.rows[0].$id, { publicKey: null, updatedAt: new Date().toISOString() }));
  }

  // 5. Update User Prefs
  purgeActions.push(users.getPrefs(userId).then(async (prefs) => {
    await users.updatePrefs(userId, { ...(prefs as any), masterpass: false, isPasskey: false });
  }));

  await Promise.all(purgeActions);
  return { success: true };
}

/**
 * Fetches cross-app action suggestions.
 * Replaces legacy GET /api/cross/suggest.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function getCrossSuggestionsSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = SuggestionParamsSchema.parse(params);
  const validatedJwt = JWTSchema.parse(jwt);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { sourceApp, sourceType, sourceId } = validated;
  const baseId = sourceId || 'unknown';

  let suggestions = [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note-link action.' },
    { id: `event:${baseId}`, label: 'Create Event', description: 'Expose an event creation action.' }
  ];

  if (sourceApp === 'note' || sourceType === 'note') {
    suggestions = [
      { id: `task:${baseId}`, label: 'Create Task', description: 'Convert the note into an actionable task.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Turn the note into a scheduled event.' },
      { id: `followup:${baseId}`, label: 'Add Follow-up', description: 'Generate a follow-up action from this note.' }
    ];
  } else if (sourceType === 'task' || sourceApp === 'flow') {
    suggestions = [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Link a source note to this task.' },
      { id: `event:${baseId}`, label: 'Calendar Event', description: 'Map this task onto a calendar surface.' }
    ];
  }

  return { sourceApp, sourceType, sourceId, suggestions };
}

/**
 * Verifies if the authenticated actor has admin privileges.
 * Replaces legacy GET /api/admin/check.
 */
export async function verifyAdminSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  
  const admin = isEnvAdminUser(actor);
  if (!admin) throw new Error('Forbidden: admin privileges required');

  return { success: true, userId: actor.$id };
}

/**
 * Creates a report for one or more target users.
 * Replaces legacy POST /api/reports.
 */
export async function createReportSecure(params: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const targetUserIds = Array.isArray(params.targetUserIds) ? params.targetUserIds : [params.targetUserId].filter(Boolean);
  if (targetUserIds.length === 0) throw new Error('At least one target userId is required');
  if (targetUserIds.includes(actor.$id)) throw new Error('Self reports are not allowed');

  const reason = String(params.reason || params.message || '').trim();
  if (!reason) throw new Error('reason is required');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

  const created: any[] = [];
  for (const targetUserId of targetUserIds) {
    const payload = {
      userId: targetUserId,
      type: 'report',
      actorId: actor.$id,
      relatedUserId: targetUserId,
      status: 'pending',
      metadata: JSON.stringify({
        source: 'accounts.reports',
        sourceApp: params.sourceApp || 'kylrix',
        report: {
          reporterId: actor.$id,
          targetUserId,
          reason,
          contextType: params.contextType || 'profile',
          contextId: params.contextId || null,
          contextUrl: params.contextUrl || null,
          notes: params.notes || null,
          reviewState: 'unverified',
        },
      }),
    };

    const row = await databases.createRow(dbId, tableId, ID.unique(), payload, [Permission.read(Role.user(actor.$id))]);
    created.push(row);
  }

  return { success: true, count: created.length, reports: created };
}

/**
 * Lists reports authored by or targeting the authenticated actor.
 * Replaces legacy GET /api/reports.
 */
export async function listReportsSecure(statusFilter?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const queries = [
    Query.equal('type', 'report'),
    Query.or([Query.equal('actorId', actor.$id), Query.equal('userId', actor.$id)])
  ];
  if (statusFilter) queries.push(Query.equal('status', statusFilter.toLowerCase()));

  const result = await databases.listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, queries);
  return { success: true, reports: result.rows };
}

/**
 * Creates one or more account event rows (referrals, reports, profile syncs, etc.).
 * Replaces legacy POST /api/account-events.
 */
export async function createAccountEventSecure(params: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

  const type = String(params.type || '').trim().toLowerCase();
  if (!type) throw new Error('type is required');

  const targetUserIds = Array.isArray(params.targetUserIds) ? params.targetUserIds : [params.userId || actor.$id];
  
  const created: any[] = [];
  for (const targetUserId of targetUserIds) {
    const payload = {
      userId: targetUserId,
      type,
      actorId: actor.$id,
      relatedUserId: params.relatedUserId || targetUserId,
      status: params.status || 'active',
      delta: params.delta ?? null,
      discountPercent: params.discountPercent ?? null,
      expiresAt: params.expiresAt || null,
      metadata: typeof params.metadata === 'string' ? params.metadata : JSON.stringify(params.metadata || {}),
    };

    const row = await databases.createRow(dbId, tableId, ID.unique(), payload, [Permission.read(Role.user(targetUserId))]);
    created.push(row);
  }

  return { success: true, count: created.length, rows: created };
}

/**
 * Initializes a new Cloudflare Calls session.
 * Replaces legacy POST /api/calls/session.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function initCloudflareCallSessionSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

/**
 * Adds tracks to an existing Cloudflare Calls session.
 * Replaces legacy POST /api/calls/tracks.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function initCloudflareCallTracksSecure(params: { sessionId: string; tracks: any[] }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { sessionId, tracks } = params;
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${sessionId}/tracks/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tracks }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

/**
 * Verifies a Cloudflare Turnstile token.
 * Replaces legacy POST /api/turnstile/verify.
 */
export async function verifyTurnstileSecure(token: string) {
  if (!token) throw new Error('token is required');
  const result = await verifyTurnstileToken(token);
  if (!result.success) {
    throw new Error(`Turnstile verification failed: ${result.error_codes?.join(', ') || 'unknown'}`);
  }
  return { success: true };
}

/**
 * Transaction-Clock Delta Sync: Computes surgical patches for notes.
 * Follows "The Golden Rule of Server Action Security".
 * Eliminates thundering herds by returning only changed records.
 */
export async function syncNotesDeltaSecure(localManifest: { id: string; updatedAt: string }[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // 1. Fetch all server-side note IDs and their updatedAt timestamps for this user
  // This is a lightweight metadata-only fetch
  const serverRows = await databases.listRows(dbId, tableId, [
    Query.equal('userId', actor.$id),
    Query.select(['$id', '$updatedAt']),
    Query.limit(5000)
  ]);

  const serverManifest = new Map(serverRows.rows.map(d => [d.$id, d.$updatedAt]));
  const localMap = new Map(localManifest.map(m => [m.id, m.updatedAt]));

  const toFetch: string[] = [];
  const toDelete: string[] = [];

  // Check for updates or new items
  for (const [sId, sUpdated] of serverManifest.entries()) {
    const lUpdated = localMap.get(sId);
    if (!lUpdated || new Date(sUpdated) > new Date(lUpdated)) {
      toFetch.push(sId);
    }
  }

  // Check for deletions
  for (const lId of localMap.keys()) {
    if (!serverManifest.has(lId)) {
      toDelete.push(lId);
    }
  }

  // 2. Surgical Fetch: Only get the full records that have changed
  let patches: any[] = [];
  if (toFetch.length > 0) {
    // Chunk requests if there are too many (Appwrite limit)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
        const chunk = toFetch.slice(i, i + CHUNK_SIZE);
        const res = await databases.listRows(dbId, tableId, [
            Query.equal('$id', chunk),
            Query.limit(CHUNK_SIZE)
        ]);
        patches.push(...res.rows);
    }
  }

  return {
    success: true,
    patches,
    deletedIds: toDelete,
    serverTime: new Date().toISOString()
  };
}

/**
 * RxDB Replication: Pull Handler (Server -> Client)
 * Fetches changed notes since the last checkpoint.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function pullNotesDeltaSecure(params: { lastCheckpoint: string | null; limit: number }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const queries = [
    Query.equal('userId', actor.$id),
    Query.orderAsc('$updatedAt'),
    Query.limit(params.limit || 50)
  ];

  if (params.lastCheckpoint) {
    queries.push(Query.greaterThan('$updatedAt', params.lastCheckpoint));
  }

  const res = await databases.listRows(dbId, tableId, queries);

  const documents = res.rows.map(doc => ({
    id: doc.$id,
    title: doc.title,
    content: doc.content,
    userId: doc.userId,
    metadata: doc.metadata,
    updatedAt: doc.$updatedAt,
    crdt: doc.crdt || null,
    _deleted: doc.isDeleted || false
  }));

  const lastDoc = documents[documents.length - 1];
  const checkpoint = lastDoc ? { updatedAt: lastDoc.updatedAt, id: lastDoc.id } : null;

  return { documents, checkpoint };
}

/**
 * RxDB Replication: Push Handler (Client -> Server)
 * Persists local changes to the server and detects conflicts.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function pushNotesDeltaSecure(rows: any[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const conflicts: any[] = [];

  for (const row of rows) {
    const { newDocumentState, assumedMasterState } = row;
    const noteId = newDocumentState.id;

    // 1. Fetch current master state
    const currentMaster = await databases.getRow(dbId, tableId, noteId).catch(() => null);

    if (currentMaster) {
      // 2. Authorization: Verify ownership
      if (currentMaster.userId !== actor.$id) {
          // Check shared access if not owner
          const hasAccess = await verifyResourcePermissionSecure({
              databaseId: dbId,
              tableId: tableId,
              rowId: noteId,
              actorId: actor.$id,
              action: 'update'
          });
          if (!hasAccess) {
              console.warn(`[PushDelta] Unauthorized write attempt for ${noteId} by ${actor.$id}`);
              continue; 
          }
      }

      // 3. Conflict Detection
      if (!assumedMasterState || currentMaster.$updatedAt !== assumedMasterState.updatedAt) {
        console.log(`[PushDelta] Conflict detected for ${noteId}. Server: ${currentMaster.$updatedAt}, Client assumed: ${assumedMasterState?.updatedAt}`);
        conflicts.push({
            id: currentMaster.$id,
            title: currentMaster.title,
            content: currentMaster.content,
            userId: currentMaster.userId,
            metadata: currentMaster.metadata,
            updatedAt: currentMaster.$updatedAt,
            crdt: currentMaster.crdt || null,
            _deleted: false
        });
        continue;
      }

      // 4. No conflict: Update
      await databases.updateRow(dbId, tableId, noteId, {
        title: newDocumentState.title,
        content: newDocumentState.content,
        metadata: newDocumentState.metadata,
        crdt: typeof newDocumentState.crdt === 'string' ? newDocumentState.crdt : JSON.stringify(newDocumentState.crdt),
      });
    } else {
      // 5. New document: Create
      await databases.createRow(dbId, tableId, noteId || ID.unique(), {
        title: newDocumentState.title,
        content: newDocumentState.content,
        userId: actor.$id,
        metadata: newDocumentState.metadata,
        crdt: typeof newDocumentState.crdt === 'string' ? newDocumentState.crdt : JSON.stringify(newDocumentState.crdt),
      });
    }
  }

  return conflicts;
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
  resourceType: 'note' | 'task' | 'project' | 'secret' | 'totp';
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
               input.resourceType === 'secret' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
               input.resourceType === 'totp' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
               APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                  input.resourceType === 'project' ? 'projects' :
                  input.resourceType === 'secret' ? 'credentials' :
                  input.resourceType === 'totp' ? 'totpSecrets' :
                  APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  // 1. Grant physical READ permission only!
  await permissionsInternal('POST', {
    action: 'grant',
    permission: 'read',
    targetUserId: input.targetUserId,
    resourceId: input.resourceId,
    resourceType: input.resourceType === 'note' ? 'ghost_note' : (input.resourceType === 'secret' || input.resourceType === 'totp' ? 'secret' : 'task'),
    databaseId: dbId,
    tableId: tableId,
    rowId: input.resourceId,
  }, requester.$id);

  // 2. Set virtual permission in polymorphic flow.collaborators table
  if (input.resourceType === 'note' || input.resourceType === 'project' || input.resourceType === 'secret' || input.resourceType === 'totp') {
    const tables = createSystemTablesDB();
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

    // Enforce 3-collaborator limit for FREE tier
    const existingCollabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', input.resourceId),
        Query.equal('resourceType', input.resourceType)
      ] as any
    });

    const userTier = getUserSubscriptionTier(requester);
    if (userTier === 'FREE') {
      throw new Error(`Adding collaborators is a premium feature. Upgrade to PRO or TEAMS to collaborate on your ${input.resourceType}.`);
    }
    const maxCollabs = userTier === 'PRO' ? 3 : Infinity;
    if (existingCollabsRes.rows.length >= maxCollabs) {
      throw new Error(`Limit reached: PRO tier is limited to 3 collaborators per ${input.resourceType}. Upgrade to TEAMS for unlimited team members.`);
    }

    const existingCollab = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', input.resourceId),
        Query.equal('resourceType', input.resourceType),
        Query.equal('userId', input.targetUserId)
      ] as any
    });

    const permission = input.permission === 'admin' ? 'admin' : (input.permission === 'editor' ? 'write' : 'read');

    if (existingCollab.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existingCollab.rows[0].$id,
        data: {
          permission,
          status: 'accepted',
          accepted: true
        }
      });
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: input.resourceId,
          resourceType: input.resourceType,
          userId: input.targetUserId,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'collaborator'
        }
      });
    }
  }

  // 3. Structured Notification Layer (Optional)
  if (!input.skipEmail) {
    try {
      await dispatchSecureNotification({
        targetUserId: input.targetUserId,
        type: 'invite',
        title: 'New Invitation',
        body: `${input.actorName} has invited you to collaborate.`,
        actorName: input.actorName,
        resourceId: input.resourceId,
        resourceTitle: input.resourceTitle,
        resourceType: input.resourceType as any,
        permission: input.permission
      });
    } catch (notifErr) {
      console.error('[grantPermissionSecure] Notification dispatch failed:', notifErr);
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

    // 2. Remove virtual permission from metadata for legacy compatibility
    if (input.resourceType === 'note') {
        const tables = createSystemTablesDB();
        const noteRow = await tables.getRow({
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

    // 3. Remove polymorphic collaborators row for any resource type
    try {
      const tables = createSystemTablesDB();
      const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
      const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', input.resourceId),
          Query.equal('resourceType', input.resourceType),
          Query.equal('userId', input.targetUserId)
        ] as any
      });
      await Promise.all(
        collabsRes.rows.map((row) =>
          tables.deleteRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id
          })
        )
      );
    } catch (err) {
      console.error('[revokePermissionSecure] Failed to remove polymorphic collaborator row:', err);
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
    resourceType: 'note' | 'task' | 'project' | 'event' | 'form' | 'huddle' | 'call' | 'secret' | 'totp';
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
                 input.resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
                 input.resourceType === 'secret' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
                 input.resourceType === 'totp' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
                 APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                    input.resourceType === 'project' ? 'projects' :
                    input.resourceType === 'event' ? (APPWRITE_CONFIG.TABLES.FLOW.EVENTS || 'events') :
                    input.resourceType === 'form' ? (APPWRITE_CONFIG.TABLES.FLOW.FORMS || 'forms') :
                    input.resourceType === 'huddle' ? 'huddles' :
                    input.resourceType === 'call' ? 'calls' :
                    input.resourceType === 'secret' ? 'credentials' :
                    input.resourceType === 'totp' ? 'totpSecrets' :
                    APPWRITE_CONFIG.TABLES.FLOW.TASKS;

    const tables = createSystemTablesDB();
    const row = await tables.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
    
    let filteredCollabs: Array<{ userId: string, level: string, status: string, accepted: boolean }> = [];
    
    if (input.resourceType === 'note' || input.resourceType === 'project' || input.resourceType === 'event' || input.resourceType === 'form' || input.resourceType === 'huddle' || input.resourceType === 'call' || input.resourceType === 'secret' || input.resourceType === 'totp') {
        // Query polymorphic collaborators table as the single source of truth
        try {
            const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
            const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
            const collabsRes = await tables.listRows({
                databaseId: FLOW_DATABASE_ID,
                tableId: COLLABORATORS_TABLE,
                queries: [
                    Query.equal('resourceId', input.resourceId),
                    Query.equal('resourceType', input.resourceType)
                ] as any
            });

            if (collabsRes.rows.length > 0) {
                filteredCollabs = collabsRes.rows.map(c => ({
                    userId: c.userId,
                    level: c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer'),
                    status: (c.status === 'pending' && (!c.inviterId || c.inviterId === '')) ? 'requested' : (c.status || 'pending'),
                    accepted: c.accepted ?? false
                }));
            } else {
                // Legacy fallback to metadata.collaborators
                let meta: any = {};
                try {
                    meta = JSON.parse(row.metadata || '{}');
                } catch {}
                const collaboratorsMap = meta.collaborators || {};
                filteredCollabs = Object.entries(collaboratorsMap).map(([userId, level]) => ({
                    userId,
                    level: String(level),
                    status: 'accepted',
                    accepted: true
                }));
            }
        } catch (e) {
            console.warn('[getResourceCollaboratorsSecure] Failed to query polymorphic status:', e);
        }
    } else {
        // Fallback for tasks
        const rawPermissions = row.$permissions || [];
        const collabMeta = extractCollaboratorsFromPermissions(rawPermissions);
        const ownerId = String((row as any).userId || '').trim();
        filteredCollabs = collabMeta
            .filter(c => c.userId !== ownerId && c.userId !== requester.$id)
            .map(c => ({ userId: c.userId, level: c.level, status: 'accepted', accepted: true }));
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
                permissionLevel: collab.level,
                status: collab.status,
                accepted: collab.accepted
            };
        })
    );

    return { collaborators: collaborators.filter(Boolean) };
}

export async function getUsersByIdsSecure(ids: string[]) {
  const { UsersService } = await import('@/lib/services/users');
  const profiles = await UsersService.getUsersByIds(ids);
  return JSON.parse(JSON.stringify(profiles));
}

export async function createNoteSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Rigorous runtime validation
  const validated = NoteSchema.parse(data);

  // Mathematically tie the create operation to the current user
  const noteData: any = {
    ...validated,
    userId: actor.$id,
  };

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data: noteData,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const contentLength = (noteData.content || '').length;
  const BASE_NOTE_LIMIT = 655350;
  const PRO_NOTE_LIMIT = 655350000;

  if (contentLength > BASE_NOTE_LIMIT) {
    if (!hasPaidKylrixPlan(actor)) {
      throw new Error('PAYWALL_REQUIRED: Note content exceeds free limit');
    }
    if (contentLength > PRO_NOTE_LIMIT) {
      throw new Error('Note content exceeds maximum allowed limit');
    }
    // Anything beyond the base limit is considered an article
    noteData.isArticle = true;
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
        const existingTagsRes = await tables.listRows({
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
            const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 },
    });
            existingTagRows[key] = created;
          } catch (createTagErr: any) {
            try {
              const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
              if (retry.rows.length) existingTagRows[key] = retry.rows[0];
            } catch {}
          }
        }
      }

      const existingPivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any,
    });
      const existingPairs = new Set(existingPivot.rows.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        const tagRow = existingTagRows[key];
        const tagId = tagRow ? (tagRow.$id || tagRow.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        
        try {
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        if (existingPairs.has(pairKey)) continue;
        try {
          await tables.createRow({
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
    generateId: () => ID.unique(),
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
      const row = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
    }) as any;
      try {
        const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const pivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
    });
        if (pivot.rows.length) {
          const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
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

  const note = await noteCreationServiceServer.createNote(noteData);
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
  const { databaseId, tableId, rowId, actorId, action, ownerFields = ['userId', 'ownerId', 'creatorId'], metadataField = 'metadata', data } = params;
  
  let row = null;
  
  // Authoritative existing row fetch for permission validation
  if (databaseId && tableId && rowId) {
    row = await getRowCached({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId,
    }).catch(() => null);

    // Dynamic Admin RLS Bypass Fallback (Second Gate)
    if (!row) {
      try {
        const systemTables = createSystemTablesDB();
        row = await systemTables.getRow(
          databaseId,
          tableId,
          rowId
        );
      } catch (err) {
        console.warn('[verifyResourcePermissionSecure] Admin fallback fetch failed:', err);
      }
    }
  }

  // If no existing row found and it's not a create action, we cannot verify permissions
  if (!row && action !== 'create') {
    return false;
  }

  // Use provided data as fallback (primarily for 'create' or specialized injections)
  if (!row && data) {
    row = data;
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

  // 0. Inherited Project Ownership
  // Case A: Authoritative resourceType/resourceId link (standard for Notes/Secrets)
  if (actorId && row.resourceType === 'project' && row.resourceId) {
    try {
      const project = await getRowCached({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'projects',
        rowId: row.resourceId,
      });
      if (project && project.ownerId === actorId) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance (Case A) check failed:', err);
    }
  }

  // Case B: Explicit projectId column (standard for Tasks/Goals)
  if (actorId && row.projectId) {
    try {
      const project = await getRowCached({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'projects',
        rowId: row.projectId,
      });
      if (project && project.ownerId === actorId) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance (Case B) check failed:', err);
    }
  }

  // 0.1 Parent Resource Inheritance (e.g. Comments in a Note)
  if (actorId && tableId === 'comments' && row.noteId) {
    try {
      const hasParentAccess = await verifyResourcePermissionSecure({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
        rowId: row.noteId,
        actorId,
        action: action as any,
      });
      if (hasParentAccess) return true;
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Parent note inheritance check failed:', err);
    }
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
      const objLinks = await tables.listRows({
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
            const projectCollabs = await tables.listRows({
                databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                tableId: 'project_objects',
                queries: [
                    Query.equal('projectId', link.projectId),
                    Query.equal('entityKind', 'collaborator'),
                    Query.equal('entityId', actorId)
                ] as any
            }).catch(() => ({ rows: [] }));
            
            if (projectCollabs.rows.length > 0) {
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
      
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('userId', actorId)
        ] as any
      });
      
      if (collabsRes.rows.length > 0) {
        const p = collabsRes.rows[0].permission; // 'read' | 'write' | 'admin'
        if (p === 'admin') matchedCollabRole = 'admin';
        else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
        else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
      } else {
        // Hybrid Team Expansion Check
        const teamId = `rt_${rowId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30)}`;
        const teamCollabsRes = await tables.listRows({
          databaseId: FLOW_DATABASE_ID,
          tableId: COLLABORATORS_TABLE,
          queries: [
            Query.equal('resourceId', teamId),
            Query.equal('resourceType', 'team'),
            Query.equal('userId', actorId)
          ] as any
        });
        
        if (teamCollabsRes.rows.length > 0) {
          const p = teamCollabsRes.rows[0].permission;
          if (p === 'admin') matchedCollabRole = 'admin';
          else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
          else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
        }
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

  const contentLength = (data.content || '').length;
  const BASE_NOTE_LIMIT = 655350;
  const PRO_NOTE_LIMIT = 655350000;

  if (contentLength > BASE_NOTE_LIMIT) {
    if (!hasPaidKylrixPlan(actor)) {
      throw new Error('PAYWALL_REQUIRED: Note content exceeds free limit');
    }
    if (contentLength > PRO_NOTE_LIMIT) {
      throw new Error('Note content exceeds maximum allowed limit');
    }
    // Anything beyond the base limit is considered an article
    data.isArticle = true;
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const { 
    cleanRowData, 
    filterNoteData, 
    getNotePermissions,
    createNoteCreationService,
    sanitizeNoteUpdatePatch,
  } = await import('@/lib/appwrite/note');

  const noteRow = await tables.getRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    rowId: noteId,
  }) as { creatorId?: string | null; userId?: string | null };

  const noteOwnerId = noteRow.creatorId || noteRow.userId || '';
  const patch = sanitizeNoteUpdatePatch({ ...data }, { actorId: actor.$id, noteOwnerId });

  const hydrateNoteRow = async (rowId: string) => {
    const hydrated = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId,
    }) as any;
    try {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const pivot = await tables.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: noteTagsTable,
        queries: [Query.equal('resourceId', rowId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
      });
      if (pivot.rows.length) {
        const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
        hydrated.tags = tags;
      }
    } catch {}
    if (!hydrated.attachments || !Array.isArray(hydrated.attachments)) {
      hydrated.attachments = [];
    }
    return hydrated;
  };

  const noteService = createNoteCreationService({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    getCurrentUser: async () => ({ $id: actor.$id }),
    createRow: async () => {
      throw new Error('createRow is not available in updateNoteSecure');
    },
    updateRow: async (_databaseId, _tableId, rowId, rowData, permissions) => {
      return tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID_NOTES,
        rowId,
        data: rowData as any,
        permissions,
      }) as any;
    },
    getNote: hydrateNoteRow,
    getNotePermissions,
    cleanRowData,
    filterNoteData,
  });

  const updatedAt = new Date().toISOString();
  const row = await noteService.updateNote(noteId, patch, { ownerId: noteOwnerId || actor.$id });

  try {
    if (Array.isArray(patch.tags)) {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const incomingRaw: string[] = patch.tags.filter(Boolean).map((t: string) => t.trim());
      const normalizedIncoming = Array.from(new Set(incomingRaw)).filter(Boolean);
      const incomingSet = new Set(normalizedIncoming);

      const tagRows: Record<string, any> = {};
      if (normalizedIncoming.length) {
        try {
          const existingTagsRes = await tables.listRows({
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
              const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId: actor.$id, createdAt: updatedAt, usageCount: 0 },
    });
              tagRows[key] = created;
            } catch (createErr) {
              try {
                const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
                if (retry.rows.length) tagRows[key] = retry.rows[0];
              } catch {}
            }
          }
        }
      }

      const existingPivot = await tables.listRows({
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
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        try {
          await tables.createRow({
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
            const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
            if (res.rows.length) {
              const tRow: any = res.rows[0];
              const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
              await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: Math.max(0, current - 1) },
    });
            }
          } catch {}

          try {
            await tables.deleteRow({
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
    tableId: 'projects',
    rowId: projectId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['ownerId', 'userId'],
    metadataField: 'metadata',
  });
}

export async function listProjectsWithCollaborationsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // Parallel Fetch: Owned projects + Collaborator rows
  const [ownedProjectsRes, collabRowsRes] = await Promise.all([
    tables.listRows({
        databaseId: CHAT_DATABASE_ID,
        tableId: 'projects',
        queries: [Query.equal('ownerId', actor.$id)],
    }),
    tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceType', 'project'),
          Query.equal('userId', actor.$id),
        ] as any,
    })
  ]);

  const projectsListMap = new Map<string, any>();

  // Initialize map with owned projects
  for (const proj of ownedProjectsRes.rows) {
    projectsListMap.set(proj.$id, {
      ...proj,
      collabStatus: 'owner',
      isPending: false,
    });
  }

  // Identify unique project IDs to fetch that are NOT owned by the user
  const projectsToFetch = collabRowsRes.rows.filter(row => !projectsListMap.has(row.resourceId));
  
  if (projectsToFetch.length > 0) {
    // Optimized Batch Fetch: Details for all collaborated projects in one query
    const targetProjectIds = projectsToFetch.map(r => r.resourceId);
    
    try {
        const collaboratedProjectsRes = await tables.listRows({
            databaseId: CHAT_DATABASE_ID,
            tableId: 'projects',
            queries: [Query.equal('$id', targetProjectIds)],
        });

        for (const proj of collaboratedProjectsRes.rows) {
            const collabRow = projectsToFetch.find(r => r.resourceId === proj.$id);
            if (collabRow) {
                const isRealInvite = collabRow.status === 'pending' && collabRow.inviterId && collabRow.inviterId !== '';
                const isJoinRequest = collabRow.status === 'pending' && (!collabRow.inviterId || collabRow.inviterId === '');
                projectsListMap.set(proj.$id, {
                    ...proj,
                    collabStatus: isJoinRequest ? 'requested' : collabRow.status,
                    isPending: isRealInvite,
                    isRequested: isJoinRequest,
                    role: collabRow.permission === 'admin' ? 'admin' : (collabRow.permission === 'write' ? 'editor' : 'viewer'),
                });
            }
        }
    } catch (e) {
        console.error('[listProjectsWithCollaborationsSecure] Batch project fetch failed:', e);
    }
  }

  return Array.from(projectsListMap.values());
}

export async function createProjectSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Rigorous runtime validation
  const validated = ProjectSchema.parse(data);

  const userTier = getUserSubscriptionTier(actor);
  const tables = createSystemTablesDB();
  const existingProjects = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    queries: [
      Query.equal('ownerId', actor.$id)
    ] as any
  });
  let maxProjects = 1;
  if (userTier === 'PRO') {
    maxProjects = 10;
  } else if (userTier === 'TEAMS' || userTier === 'ORG' || userTier === 'LIFETIME') {
    maxProjects = Infinity;
  }
  if (existingProjects.rows.length >= maxProjects) {
    throw new Error(`Limit reached: ${userTier} plan is limited to ${maxProjects} project${maxProjects === 1 ? '' : 's'}. Upgrade to PRO or TEAMS to create more projects.`);
  }

  // Mathematically tie the create operation to the current user
  const projectData: any = {
    ...validated,
    ownerId: actor.$id,
  };

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['ownerId'],
    data: projectData,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const { databases, teams } = createSystemClient();
  const now = new Date().toISOString();
  const projectId = ID.unique();

  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.update(Role.user(actor.$id)),
    Permission.delete(Role.user(actor.$id)),
  ];

  const project = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      ...projectData,
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
  const existing = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
  }) as { ownerId?: string };

  const patch = { ...data };
  if (Object.prototype.hasOwnProperty.call(patch, 'isPinned') && existing.ownerId !== actor.$id) {
    delete patch.isPinned;
  }

  // Rigorous runtime validation (partial since it's an update)
  const validated = ProjectSchema.partial().parse(patch);
  const { databases } = createSystemClient();
  const now = new Date().toISOString();
  
  const project = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      ...validated,
      updatedAt: now,
    },
      permissions: permissions,
    });

  return JSON.parse(JSON.stringify(project));
}

export async function deleteProjectSecure(
  projectId: string,
  deleteMode: 'detach' | 'created_within' | 'all' = 'detach',
  jwt?: string
) {
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
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.CHAT, 'projects', projectId, deleteMode);
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

  // 1. Fetch current project
  const project = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  // Enforce 3-collaborator limit for FREE tier
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  const existingCollabsRes = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project')
    ] as any
  });

  // Fetch owner to check plan
  const { users } = createSystemClient();
  const owner = await users.get(project.ownerId);
  const ownerTier = getUserSubscriptionTier(owner);

  if (ownerTier === 'FREE') {
    throw new Error('Adding collaborators is a premium feature. Upgrade the project owner to PRO or TEAMS to add collaborators.');
  }

  const maxCollabs = ownerTier === 'PRO' ? 3 : Infinity;
  if (existingCollabsRes.rows.length >= maxCollabs) {
    throw new Error(`Limit reached: PRO tier is limited to 3 collaborators. Upgrade the project owner to TEAMS for unlimited team members.`);
  }

  // 2. Create polymorphic collaborator row with status: 'pending' and accepted: false!
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project'),
      Query.equal('userId', targetUserId)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: existingCollab.rows[0].$id,
      data: {
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        status: 'pending',
        accepted: false,
        role: 'collaborator',
        inviterId: actor.$id
      }
    });
  } else {
    await tables.createRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: ID.unique(),
      data: {
        resourceId: projectId,
        resourceType: 'project',
        userId: targetUserId,
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        invitedAt: new Date().toISOString(),
        accepted: false,
        status: 'pending',
        role: 'collaborator',
        inviterId: actor.$id
      }
    });
  }

  // 3. Dispatch structured notification email + companion Telegram alert
  try {
    await dispatchSecureNotification({
      targetUserId,
      type: 'invite',
      title: 'Project Invitation',
      body: `${actor.name || 'A Kylrix user'} has invited you to collaborate on the project "${project.title}".`,
      actorName: actor.name || 'A teammate',
      resourceId: projectId,
      resourceTitle: project.title,
      resourceType: 'project',
      permission: permissionLevel
    });
  } catch (err) {
    console.error('[addProjectCollaboratorSecure] Notification dispatch failed:', err);
  }

  return { success: true, pending: true };
}

export async function getProjectInviteDetailsSecure(projectId: string, jwt?: string) {
  const actor = jwt ? await getActor(jwt).catch(() => null) : null;

  const tables = createSystemTablesDB();
  const project = await tables.getRow<any>({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
  }).catch(() => null);

  if (!project) {
    throw new Error('Project not found');
  }

  const isPublic = project.visibility === 'public';
  const isGuestEnabled = !!project.isGuest;

  // 1. If project is private, user must be authenticated
  if (!isPublic && (!actor || !actor.$id)) {
    throw new Error('Unauthorized');
  }

  // 2. Resolve role & status if authenticated
  let status = '';
  let role = '';
  let isCollaborator = false;

  if (actor?.$id) {
    if (project.ownerId === actor.$id) {
      return {
        project: {
          $id: project.$id,
          title: project.title,
          summary: project.summary,
          status: project.status,
          ownerId: project.ownerId,
          visibility: project.visibility,
          isGuest: !!project.isGuest
        },
        isOwner: true,
        isPending: false,
        role: 'admin'
      };
    }

    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

    try {
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', projectId),
          Query.equal('resourceType', 'project'),
          Query.equal('userId', actor.$id)
        ] as any
      });
      if (collabsRes.rows.length > 0) {
        const c = collabsRes.rows[0];
        status = (c.status === 'pending' && (!c.inviterId || c.inviterId === '')) ? 'requested' : (c.status || 'pending');
        role = c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer');
        isCollaborator = true;
      }
    } catch (err) {
      console.error('[getProjectInviteDetailsSecure] Failed to query status:', err);
    }
  }

  // If authenticated and is already an active collaborator/invite accepted, or pending invite
  if (isCollaborator) {
    return {
      project: {
        $id: project.$id,
        title: project.title,
        summary: project.summary,
        status: project.status,
        ownerId: project.ownerId,
        visibility: project.visibility,
        isGuest: !!project.isGuest
      },
      isOwner: false,
      isPending: status === 'pending',
      role: role,
      status: status
    };
  }

  // If not a collaborator:
  if (isPublic) {
    // If guest access is disabled, we require authentication
    if (!isGuestEnabled && (!actor || !actor.$id)) {
      throw new Error('Unauthorized: Authentication required to view this public project.');
    }

    // Return metadata preview with option to request access
    return {
      project: {
        $id: project.$id,
        title: project.title,
        summary: project.summary,
        status: project.status,
        ownerId: project.ownerId,
        visibility: project.visibility,
        isGuest: !!project.isGuest
      },
      isOwner: false,
      isPending: false,
      isPublicPreview: true,
      requiresAuth: !isGuestEnabled && (!actor || !actor.$id)
    };
  }

  // Private project and not invited -> flatly denied
  throw new Error('You do not have permission to access this private project.');
}

export async function requestProjectAccessSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // Get project
  const project = await tables.getRow<any>({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
  }).catch(() => null);

  if (!project) throw new Error('Project not found');
  if (project.visibility !== 'public') {
    throw new Error('Forbidden: Cannot request access to a private project');
  }

  // Check if they already have an entry
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project'),
      Query.equal('userId', actor.$id)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    const col = existingCollab.rows[0];
    if (col.status === 'declined') {
      throw new Error('Forbidden: Your request to join this project was declined.');
    }
    // If already exists, return success
    return { success: true, status: col.status };
  }

  // Create a collaborator row with status: 'pending'
  await tables.createRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    rowId: ID.unique(),
    data: {
      resourceId: projectId,
      resourceType: 'project',
      userId: actor.$id,
      permission: 'read', // default request permission
      invitedAt: new Date().toISOString(),
      accepted: false,
      status: 'pending',
      role: 'collaborator',
      inviterId: ''
    }
  });

  return { success: true, status: 'requested' };
}

export async function acceptProjectInviteSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
  }).catch(() => null);

  if (!project) {
    throw new Error('Project not found');
  }

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // 1. Verify invite via polymorphic collaborators table or legacy fallback
  let permissionLevel = 'viewer';
  let isInvited = false;
  let collabId = null;

  try {
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', projectId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', actor.$id)
      ] as any
    });

    if (collabsRes.rows.length > 0) {
      const c = collabsRes.rows[0];
      permissionLevel = c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer');
      collabId = c.$id;
      isInvited = true;
    } else {
      // Legacy fallback
      let metadata: any = {};
      try {
        metadata = JSON.parse(project.metadata || '{}');
      } catch {}
      const collaborators = metadata.collaborators || {};
      if (collaborators[actor.$id]) {
        permissionLevel = collaborators[actor.$id];
        isInvited = true;
      }
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Verification failed:', err);
  }

  if (!isInvited) {
    throw new Error('You are not invited to collaborate on this project');
  }

  // 2. Update polymorphic collaborators table to 'accepted' and accepted: true
  try {
    if (collabId) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: collabId,
        data: {
          status: 'accepted',
          accepted: true
        }
      });
    } else {
      // If legacy invite accepted, create the row now to make it primary!
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: projectId,
          resourceType: 'project',
          userId: actor.$id,
          permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'collaborator'
        }
      });
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Failed to update polymorphic status:', err);
  }

  // 3. Grant physical Appwrite read permission
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${actor.$id}")`);

  const { users, databases } = createSystemClient();
  const owner = await users.get(project.ownerId);
  const isPro = hasPaidKylrixPlan(owner);

  if (isPro) {
    try {
      const { isTeamExpanded, newAcl } = await provisionHybridTeamExpansionSecure(
        databases, projectId, 'project', project.ownerId, actor.$id, permissionLevel
      );
      if (isTeamExpanded && newAcl) {
        newPermissions.add(newAcl);
      }
    } catch (teamErr: any) {
      console.warn('[acceptProjectInviteSecure] Hybrid Team expansion skipped or failed:', teamErr?.message);
    }
  }

  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}

  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(metadata)
    },
    permissions: Array.from(newPermissions)
  });

  // 3. Create object link in project_objects
  const now = new Date().toISOString();
  try {
    const existingObjects = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', actor.$id)
      ] as any,
    });

    if (existingObjects.rows.length === 0) {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        rowId: ID.unique(),
        data: {
          projectId,
          entityKind: 'collaborator',
          entityId: actor.$id,
          role: permissionLevel,
          createdAt: now,
          updatedAt: now,
        },
        permissions: [
          Permission.read(Role.user(project.ownerId)),
          Permission.read(Role.user(actor.$id))
        ]
      });
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Failed to write project_objects link:', err);
  }

  // 4. Create encrypted chat membership (if present)
  if (metadata.encryptedGroupId) {
    try {
      const existingMembers = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', metadata.encryptedGroupId),
          Query.equal('userId', actor.$id)
        ] as any
      }).catch(() => ({ rows: [] }));

      if (existingMembers.rows.length === 0) {
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
          tableId: 'conversationMembers',
          rowId: ID.unique(),
          data: {
            conversationId: metadata.encryptedGroupId,
            userId: actor.$id,
          },
          permissions: [
            Permission.read(Role.user(project.ownerId)),
            Permission.read(Role.user(actor.$id))
          ]
        });
      }
    } catch (e) {
      console.warn('[acceptProjectInviteSecure] Failed to sync to E2E project group:', e);
    }
  }

  return { success: true };
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
      const teamId = `rt_${projectId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30)}`;
      const memberships = await teams.listMemberships(teamId);
      const membership = memberships.memberships.find(m => m.userId === targetUserId);
      if (membership) {
          await teams.deleteMembership(teamId, membership.$id);
      }
  } catch (teamErr: any) {
      console.warn('[removeProjectCollaboratorSecure] Team membership removal skipped or failed:', teamErr?.message);
  }

  // 2. Fetch current project to update permissions
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

  // 3. E2E Private Chat Group Member Auto-Sync
  if (metadata && metadata.encryptedGroupId) {
    try {
      const convId = metadata.encryptedGroupId;
      const memberRows = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', convId),
          Query.equal('userId', targetUserId)
        ] as any
      }).catch(() => ({ rows: [] }));

      await Promise.all(
        memberRows.rows.map((row) =>
          tables.deleteRow({
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

  // 4. Remove polymorphic collaborators row
  try {
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', projectId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', targetUserId)
      ] as any
    });
    await Promise.all(
      collabsRes.rows.map((row) => {
        const isJoinRequest = row.status === 'pending' && (!row.inviterId || row.inviterId === '');
        if (isJoinRequest) {
          return tables.updateRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id,
            data: {
              status: 'declined',
              accepted: false,
            }
          });
        } else {
          return tables.deleteRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id
          });
        }
      })
    );
  } catch (err) {
    console.error('[removeProjectCollaboratorSecure] Polymorphic collaborators cleanup failed:', err);
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

  // Authoritative sync to polymorphic objects table
  try {
    const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';
    await tables.createRow({
      databaseId,
      tableId,
      rowId: ID.unique(),
      data: {
        parentId: projectId,
        parentKind: 'project',
        childId: entityId,
        childKind: entityKind,
        userId: actor.$id,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        createdAt: now,
        updatedAt: now,
        isPublic: !!obj.isPublic,
        isGuest: !!obj.isGuest,
        isGeneral: !!obj.isGeneral
      },
      permissions: permissions
    });
  } catch (e) {
    console.warn('[projects] Generic objects sync failed:', e);
  }

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

  if (Object.prototype.hasOwnProperty.call(data, 'isPinned') && ownerId !== actor.$id) {
    delete data.isPinned;
  }

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

  // Clear memory row cache to prevent stale ownership/permission state from blocking the delete
  const cacheKey = `${APPWRITE_CONFIG.DATABASES.FLOW}:${APPWRITE_CONFIG.TABLES.FLOW.FORMS}:${formId}`;
  rowCache.delete(cacheKey);

  // Directly retrieve the form details using system privileges to verify owner identity
  const systemTables = createSystemTablesDB();
  let formRow = null;
  try {
      formRow = await systemTables.getRow(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, formId);
  } catch (err) {
      console.warn('[deleteFormSecure] Failed to retrieve form row:', err);
  }

  // If the actor is the direct owner, bypass the regular permission check to avoid any issues
  const isOwner = formRow && String(formRow.userId || '').trim() === actor.$id;
  const isAllowed = isOwner || (await verifyFormPermission(formId, actor.$id, 'admin'));

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this form');
  }

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

  // Also remove the cache entry post-delete
  rowCache.delete(cacheKey);

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

function sanitizeEventData(data: any) {
  if (!data || typeof data !== 'object') return {};
  const allowedKeys = [
    'title',
    'description',
    'startTime',
    'endTime',
    'location',
    'meetingUrl',
    'visibility',
    'status',
    'coverImageId',
    'recurrenceRule',
    'calendarId',
    'userId',
    'isPublic',
    'isPinned',
    'isGuest',
    'keepPermission',
    'source'
  ];
  const sanitized: any = {};
  for (const key of allowedKeys) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
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

  const sanitizedData = sanitizeEventData({
    ...data,
    userId: actor.$id,
  });

  const event = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: ID.unique(),
      data: sanitizedData,
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

  const sanitizedData = sanitizeEventData(data);

  const updatedEvent = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: sanitizedData,
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
  let guestRow;
  if (guestsRes.rows.length > 0) {
    // Update role
    guestRow = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: guestsRes.rows[0].$id,
      data: {
        role: virtualRole,
      },
    });
  } else {
    // Create new
    guestRow = await tables.createRow({
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
    permissions.push(Permission.read(Role.user(actor.$id)));
  } else {
    permissions.push(Permission.read(Role.user(actor.$id)));
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
  jwt?: string;
}) {
  const actor = data.jwt ? await getActor(data.jwt) : null;
  const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const kind = data.sendObject.kind;
  
  const metadata = JSON.stringify({
    isGhost: true,
    send_object: data.sendObject,
    ghostSecret: data.ghostSecret,
    expiresAt,
    version: 'v3',
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
      isGuest: true,
      isEncrypted: data.isEncrypted ?? false,
      isPass: kind === 'password',
      isTask: kind === 'task',
      isFile: kind === 'file',
      isTotp: kind === 'totp',
      isDiscussion: kind === 'discussion',
      userId: actor?.$id || null,
      creatorId: actor?.$id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: false,
    },
    permissions: [
      Permission.read(Role.any()),
      ...(actor ? [Permission.write(Role.user(actor.$id)), Permission.delete(Role.user(actor.$id))] : [])
    ],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteForCallSecure(callId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

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
      isPublic: false,
      userId: actor.$id,
      creatorId: actor.$id,
      resourceId: callId,
      resourceType: 'call',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: [Permission.read(Role.user(actor.$id))],
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
  // Rigorous runtime validation
  const validated = CreateRowSchema.parse({ databaseId, tableId, data, permissions });
  const { databaseId: dbId, tableId: tblId, data: rowData } = validated;
  let perms = validated.permissions;

  // 1. Check if it's an anonymous-friendly form submission
  let isAnonymousFormSubmission = false;
  if (tblId === 'formSubmissions' && rowData && (rowData as any).formId) {
    try {
      const tables = createSystemTablesDB();
      const form = await tables.getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
        rowId: (rowData as any).formId,
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
  if (rowData && typeof rowData === 'object') {
    const isSpecializedTable = await getIsSpecializedTable(tblId);

    if (!isSpecializedTable) {
      if ((rowData as any).userId && (rowData as any).userId !== actor?.$id) {
        throw new Error('Forbidden: Cannot create resource for another user');
      }
      if ((rowData as any).ownerId && (rowData as any).ownerId !== actor?.$id) {
        throw new Error('Forbidden: Cannot create resource for another user');
      }
      if (!(rowData as any).userId && !(rowData as any).ownerId && actor?.$id) {
        (rowData as any).userId = actor.$id;
      }
    } else {
      // Specialized Table Policies on creation
      if (tblId === 'Collaborators' || tblId === 'collaborators') {
        const noteIdStr = String((rowData as any).noteId || '');
        if (noteIdStr.startsWith('task:')) {
          const taskId = noteIdStr.replace('task:', '');
          const isAllowed = await verifyResourcePermissionSecure({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
            rowId: taskId,
            actorId: actor?.$id,
            action: 'update',
          });
          if (!isAllowed) throw new Error('Forbidden: Insufficient permissions on parent task');
        }
      } else if (tblId === 'formSubmissions') {
        let metadata: any = {};
        try {
          metadata = typeof (rowData as any).metadata === 'string' ? JSON.parse((rowData as any).metadata) : (rowData as any).metadata || {};
        } catch (_) {}
        if (metadata.isDraft) {
          if (!actor || !actor.$id) throw new Error('Unauthorized: Drafts require authentication');
          if ((rowData as any).submitterId && (rowData as any).submitterId !== actor.$id) {
            throw new Error('Forbidden: Cannot create draft for another user');
          }
          (rowData as any).submitterId = actor.$id;
        } else {
          // It's a real submission
          if (actor && actor.$id) {
            if ((rowData as any).submitterId && (rowData as any).submitterId !== actor.$id) {
              throw new Error('Forbidden: Submitter ID must match authenticated actor');
            }
            (rowData as any).submitterId = actor.$id;
          } else {
            // Anonymous Submission
            if (!isAnonymousFormSubmission) {
              throw new Error('Unauthorized: Authentication required for this form');
            }
            (rowData as any).submitterId = null;
          }
        }
      } else if (tblId === 'wallets') {
        if ((rowData as any).ownerId && (rowData as any).ownerId !== `user:${actor?.$id}`) {
          throw new Error('Forbidden: Cannot create wallet for another user');
        }
        if (actor?.$id) {
            (rowData as any).ownerId = `user:${actor.$id}`;
        }
      } else if (tblId === 'walletMap') {
        if ((rowData as any).userId && (rowData as any).userId !== actor?.$id) {
          throw new Error('Forbidden: Cannot map wallet for another user');
        }
        if (actor?.$id) {
            (rowData as any).userId = actor.$id;
        }
      } else if (tblId === 'follows') {
        if ((rowData as any).followerId && (rowData as any).followerId !== actor?.$id) {
          throw new Error('Forbidden: Cannot follow user as someone else');
        }
        if (actor?.$id) {
            (rowData as any).followerId = actor.$id;
        }
        
        // Grant read permission to both follower and following
        if (!perms && actor?.$id) {
            perms = [
                Permission.read(Role.user((rowData as any).followerId)),
                Permission.read(Role.user((rowData as any).followingId))
            ];
        }
      } else if (tblId === 'activityLog') {
        if (!actor && !isAnonymousFormSubmission) {
          throw new Error('Unauthorized: Notification logging requires an active session');
        }
      }
    }
  }

  const tables = createSystemTablesDB();
  // Setup permissions
  if (!perms) {
    if (actor && actor.$id) {
      perms = [Permission.read(Role.user(actor.$id))];
    } else {
      let formOwnerId: string | null = null;
      if (rowData && (rowData as any).formId) {
        try {
          const form = await tables.getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            rowId: (rowData as any).formId,
          });
          formOwnerId = form?.userId || null;
        } catch (_) {}
      }
      perms = formOwnerId ? [Permission.read(Role.user(formOwnerId))] : [];
    }
  }
  
  const customRowId = (rowData && (rowData as any).$id) ? String((rowData as any).$id) : ID.unique();
  const dataCopy = rowData ? { ...rowData } : {};
  if (dataCopy.$id) {
    delete dataCopy.$id;
  }

  const result = await Registry.getDatabase().createRow<any>(
    dbId,
    tblId,
    customRowId,
    dataCopy,
    perms,
    { forceSystem: true }
  );

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
  // Rigorous runtime validation
  const validated = UpdateRowSchema.parse({ databaseId, tableId, rowId, data, permissions });
  const { databaseId: dbId, tableId: tblId, rowId: rId, data: rowData, permissions: perms } = validated;

  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  let isAllowed = false;
  const isSpecializedTable = await getIsSpecializedTable(tblId);

  if (isSpecializedTable) {
    const existingRow = await getRowCached({ databaseId: dbId, tableId: tblId, rowId: rId });

    if (tblId === 'Collaborators' || tblId === 'collaborators') {
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
    } else if (tblId === 'formSubmissions') {
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
    } else if (tblId === 'wallets') {
      isAllowed = existingRow?.ownerId === `user:${actor.$id}`;
    } else if (tblId === 'walletMap') {
      isAllowed = existingRow?.userId === actor.$id;
    } else if (tblId === 'follows') {
      isAllowed = existingRow?.followerId === actor.$id || existingRow?.followingId === actor.$id;
    } else if (tblId === 'activityLog') {
      isAllowed = existingRow?.userId === actor.$id;
    } else {
      isAllowed = true;
    }
  } else {
    isAllowed = await verifyResourcePermissionSecure({
      databaseId: dbId,
      tableId: tblId,
      rowId: rId,
      actorId: actor.$id,
      action: 'update',
      data: rowData,
    });
  }

  if (!isAllowed) throw new Error('Forbidden');

  const result = await Registry.getDatabase().updateRow<any>(
    dbId,
    tblId,
    rId,
    rowData,
    perms,
    { forceSystem: true }
  );

  return JSON.parse(JSON.stringify(result));
}

export async function deleteRowSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  jwt?: string
) {
  // Rigorous runtime validation
  const validated = CRUDParamsSchema.parse({ databaseId, tableId, rowId });
  const { databaseId: dbId, tableId: tblId, rowId: rId } = validated;

  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  let isAllowed = false;
  const isSpecializedTable = await getIsSpecializedTable(tblId);

  if (isSpecializedTable) {
    const existingRow = await getRowCached({ databaseId: dbId, tableId: tblId, rowId: rId });

    if (tblId === 'Collaborators' || tblId === 'collaborators') {
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
    } else if (tblId === 'formSubmissions') {
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
    } else if (tblId === 'wallets') {
      isAllowed = existingRow?.ownerId === `user:${actor.$id}`;
    } else if (tblId === 'walletMap') {
      isAllowed = existingRow?.userId === actor.$id;
    } else if (tblId === 'follows') {
      isAllowed = existingRow?.followerId === actor.$id || existingRow?.followingId === actor.$id;
    } else if (tblId === 'activityLog') {
      isAllowed = existingRow?.userId === actor.$id;
    } else {
      isAllowed = true;
    }
  } else {
    isAllowed = await verifyResourcePermissionSecure({
      databaseId: dbId,
      tableId: tblId,
      rowId: rId,
      actorId: actor.$id,
      action: 'delete',
    });
  }

  if (!isAllowed) throw new Error('Forbidden');

  try {
    await executeCascadeDeleteSecure(dbId, tblId, rId);
  } catch (err: any) {
    console.error('deleteRowSecure cascade cleanup failed:', err);
  }

  await Registry.getDatabase().deleteRow(dbId, tblId, rId, { forceSystem: true });
  const result = { success: true };

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
          Query.startsWith('displayName', cleaned),
          Query.startsWith('userId', cleaned)
        ]),
        Query.notEqual('isPublic', false),
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
    const res = await tables.listRows({
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
  // Rigorous runtime validation
  const validated = ListParamsSchema.parse({ databaseId, tableId, queries });
  
  try {
    const res = await Registry.getDatabase().listRows<any>(validated.databaseId, validated.tableId, validated.queries, { jwt });
    console.log('[listRowsSecure] Success via DatabasePort. Total:', res.total, 'Count:', res.rows?.length);
    // Unified response: 'rows' is now the primary key, 'documents' is legacy
    return JSON.parse(JSON.stringify({
        total: res.total,
        rows: res.rows,
        rows: res.rows
    }));
  } catch (error: any) {
    console.error('[listRowsSecure] Failed:', error?.message);
    throw error;
  }
}

export async function getRowSecure(databaseId: string, tableId: string, rowId: string, jwt?: string) {
  console.log('[getRowSecure] Request:', { databaseId, tableId, rowId });
  
  try {
    const res = await Registry.getDatabase().getRow<any>(databaseId, tableId, rowId, { jwt });
    return JSON.parse(JSON.stringify(res));
  } catch (error: any) {
    console.warn('[getRowSecure] User-scoped fetch failed, checking admin fallback for RLS bypass:', error?.message);
    
    // Attempt dynamic admin fallback for Chat Conversations or Notes
    const isChatConv = databaseId === APPWRITE_CONFIG.DATABASES.CHAT && tableId === APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
    const isNote = databaseId === APPWRITE_CONFIG.DATABASES.NOTE && tableId === APPWRITE_CONFIG.TABLES.NOTE.NOTES;
    
    if (isChatConv || isNote) {
      try {
        const actor = await getActor(jwt);
        if (actor?.$id) {
          const adminTables = createSystemTablesDB();
          const adminRes = await adminTables.getRow({
            databaseId,
            tableId,
            rowId,
          });
          
          if (adminRes) {
            let isAuthorized = false;
            
            if (isChatConv) {
              const participants = adminRes.participants || [];
              if (participants.includes(actor.$id)) {
                isAuthorized = true;
              } else {
                const memberRows = await adminTables.listRows({
                  databaseId: databaseId,
                  tableId: 'conversationMembers',
                  queries: [
                    Query.equal('conversationId', rowId),
                    Query.equal('userId', actor.$id),
                    Query.limit(1)
                  ]
                }).catch(() => ({ total: 0, rows: [] }));
                if (memberRows.total > 0) {
                  isAuthorized = true;
                }
              }
            } else if (isNote) {
              const collaborators = adminRes.collaborators || [];
              if (adminRes.userId === actor.$id || collaborators.includes(actor.$id)) {
                isAuthorized = true;
              } else {
                const collabRows = await adminTables.listRows({
                  databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
                  tableId: 'Collaborators',
                  queries: [
                    Query.equal('resourceId', rowId),
                    Query.equal('userId', actor.$id),
                    Query.limit(1)
                  ]
                }).catch(() => ({ total: 0, rows: [] }));
                if (collabRows.total > 0) {
                  isAuthorized = true;
                }
              }
            }
            
            if (isAuthorized) {
              console.log('[getRowSecure] Admin RLS bypass authorized successfully for user:', actor.$id);
              return JSON.parse(JSON.stringify(adminRes));
            }
          }
        }
      } catch (adminErr) {
        console.error('[getRowSecure] Admin fallback exception:', adminErr);
      }
    }
    
    throw error;
  }
}

export async function getFilePreviewSecure(bucketId: string, fileId: string, width = 100, height = 100) {
  const { storage } = createSystemClient();
  try {
    const url = storage.getFilePreview(bucketId, fileId, width, height);
    // Fetch preview content from the server-side context where we have full credentials
    const res = await fetch(url.toString(), {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
        'X-Appwrite-Key': process.env.APPWRITE_API || '',
      },
    });
    if (!res.ok) {
      console.warn('[getFilePreviewSecure] Failed to fetch url:', url.toString(), 'status:', res.status);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
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
  const submission = await tables.getRow({
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
  const task = await tables.createRow({
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
    const parentLinks = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('entityId', submission.formId),
        Query.equal('entityKind', 'form')
      ] as any
    });

    for (const link of parentLinks.rows) {
      await tables.createRow({
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
  
  // Fetch parent project to mirror permissions
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  }).catch(() => null);

  if (!project) {
      throw new Error('Project not found');
  }

  // Derive permissions from the parent project
  const projectPermissions = project.$permissions || [];
  // We want to extract all 'read' roles from the parent project to mirror them on the thread
  const authorizedReadRoles = projectPermissions
      .filter((p: string) => p.startsWith('read('))
      .map((p: string) => p.substring(5, p.length - 1));

  // Build strict permissions: No read("any")!
  const threadPermissions = authorizedReadRoles.map(role => `read(${role})`);

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: title || 'Project Discussion',
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: project.ownerId,
      creatorId: project.ownerId,
      resourceId: projectId,
      resourceType: 'project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: threadPermissions,
  });

  // Update parent project metadata with discussionNoteId
  let projMeta: any = {};
  try {
    projMeta = JSON.parse(project.metadata || '{}');
  } catch {}
  projMeta.discussionNoteId = result.$id;
  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(projMeta)
    }
  });

  return JSON.parse(JSON.stringify(result));
}

export async function promoteGhostThreadToStorySecure(projectId: string, noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const noteRow = await tables.getRow({
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

  const updatedNote = await tables.updateRow({
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
  await tables.createRow({
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
  const project = await tables.getRow({
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
    await tables.updateRow({
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
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // 1. Gather all current project members (owner + collaborators)
  const collaborators = await tables.listRows({
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

  const conversation = await tables.createRow({
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
    await tables.createRow({
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

  const updatedProject = await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(projMeta)
    }
  });

  return JSON.parse(JSON.stringify(updatedProject));
}

export async function initGoalDiscussionSecure(taskId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const now = new Date().toISOString();
  const discussionNoteId = ID.unique();

  // 1. Fetch goal to verify ownership/access
  const goal = await tables.getRow<any>(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    taskId
  );
  if (!goal) throw new Error('Goal not found');

  // 2. Create the persistent discussion note
  // Mark as isDiscussion and ensure it's NOT a ghost/thread to keep it hidden but persistent
  await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: discussionNoteId,
    data: {
      title: `Goal Discussion: ${goal.title}`,
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      createdAt: now,
      updatedAt: now,
      creatorId: actor.$id,
      resourceId: taskId,
      resourceType: 'goal',
      isDiscussion: true,
      isGhost: false, // Persistent
      isThread: false, // Hide from standard notes list filters
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
      Permission.update(Role.user(actor.$id)),
    ],
  });

  // 3. Update the goal with the discussion link
  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: taskId,
    data: {
      discussionId: discussionNoteId,
      updatedAt: now,
    },
  });

  return { discussionId: discussionNoteId };
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
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    });
  } catch {}

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId, // RowId matches the resourceId directly!
    data: {
      title: title || `Discussion Thread`,
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: actor.$id,
      resourceId: resourceId,
      resourceType: resourceType,
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: [Permission.read(Role.user(actor.$id))],
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
  const commentsList = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    queries: [
      Query.equal('noteId', resourceId)
    ] as any
  }).catch(() => ({ rows: [] }));

  // 2. Fetch the ghost note itself to see if it exists
  const noteRow = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId
  }).catch(() => null);

  const title = noteRow?.title || `Discussion: ${resourceType} ${resourceId.slice(-8)}`;

  // 3. Compile comments history into a clean markdown row
  let markdownContent = `# Discussion History\n\n*Resource Type: ${resourceType}*\n*Date: ${new Date().toLocaleDateString()}*\n\n`;
  if (commentsList.rows.length === 0) {
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

  const storyNote = await tables.createRow({
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
    commentsList.rows.map(c => 
      tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
        rowId: c.$id
      }).catch(() => null)
    )
  );

  // 6. Delete the original ghost note
  if (noteRow) {
    await tables.deleteRow({
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
    const existingTags = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [
        Query.equal('userId', actor.$id),
        Query.equal('nameLower', nameLower),
        Query.limit(1)
      ] as any
    });
    if (existingTags.rows.length) {
      tagRow = existingTags.rows[0];
    }
  } catch {}

  if (!tagRow) {
    try {
      tagRow = await tables.createRow({
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
      const retry = await tables.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: tagsTable,
        queries: [
          Query.equal('userId', actor.$id),
          Query.equal('nameLower', nameLower),
          Query.limit(1)
        ] as any
      });
      if (retry.rows.length) tagRow = retry.rows[0];
    }
  }

  if (!tagRow) throw new Error('Failed to resolve or create tag');

  // 2. Check if polymorphic pivot already exists
  const tagId = tagRow.$id || tagRow.id;
  const existingPivot = await tables.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.equal('tagId', tagId),
      Query.limit(1)
    ] as any
  });

  if (existingPivot.rows.length) {
    return JSON.parse(JSON.stringify(existingPivot.rows[0]));
  }

  // 3. Create polymorphic pivot record
  const result = await tables.createRow({
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
    await tables.updateRow({
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
  const existingTags = await tables.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: tagsTable,
    queries: [
      Query.equal('userId', actor.$id),
      Query.equal('nameLower', nameLower),
      Query.limit(1)
    ] as any
  });
  if (!existingTags.rows.length) return { success: true };

  const tagRow = existingTags.rows[0];
  const tagId = tagRow.$id || tagRow.id;

  // 2. Find polymorphic pivot records
  const existingPivot = await tables.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: pivotTable,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.equal('tagId', tagId),
      Query.limit(100)
    ] as any
  });

  if (!existingPivot.rows.length) return { success: true };

  // 3. Delete pivot records
  for (const pivot of existingPivot.rows as any[]) {
    try {
      await tables.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: pivotTable,
        rowId: pivot.$id
      });
    } catch {}
  }

  // 4. Decrement tag usageCount
  try {
    const current = typeof tagRow.usageCount === 'number' ? tagRow.usageCount : 0;
    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tagId,
      data: { usageCount: Math.max(0, current - existingPivot.rows.length) }
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

  const pivotRes = await tables.listRows({
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

export async function createGhostNoteChatSecure(data: {
  title: string;
  participants: string[];
  jwt?: string;
}) {
  const actor = await getActor(data.jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 100 years
  const metadata = JSON.stringify({
    isGhost: true,
    version: 'v2',
    isChat: true,
    expiresAt: expiresAt,
    linkedResourceType: 'chat',
    participants: data.participants,
  });

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: data.title,
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      creatorId: actor.$id,
      resourceType: 'chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
      isChat: true,
      collaborators: data.participants,
    },
    permissions: data.participants.map(id => Permission.read(Role.user(id))),
  });

  // Create polymorphic Collaborators rows for each participant
  for (const participantId of data.participants) {
    if (participantId === actor.$id) continue;
    try {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: 'Collaborators',
        rowId: ID.unique(),
        data: {
          resourceId: result.$id,
          resourceType: 'note',
          userId: participantId,
          permission: 'write',
          status: 'accepted',
          invitedAt: new Date().toISOString(),
          accepted: true,
        },
        permissions: data.participants.map(id => Permission.read(Role.user(id))),
      });
    } catch (e) {
      console.error('[createGhostNoteChat] Failed to add collaborator row:', e);
    }
  }

  return JSON.parse(JSON.stringify(result));
}

export async function listGhostNoteChatsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const actorId = actor.$id;

  // 1. Fetch resources the user is a collaborator for
  const collaboratorsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: 'Collaborators',
      queries: [
          Query.equal('userId', actorId),
          Query.limit(500)
      ] as any
  }).catch(() => ({ rows: [] }));

  const collabResourceIds = collaboratorsRes.rows.map(r => r.resourceId).filter(Boolean);

  // 2. Build Authorization Filter: (Owned by me) OR (Linked to resource I collaborate on)
  const authOrFilters = [
      Query.equal('creatorId', actorId),
      Query.equal('userId', actorId) // Fallback for rows before the tracking column update
  ];

  if (collabResourceIds.length > 0) {
      // Chunk into groups of 100 to respect Appwrite Query.equal array limits if needed
      // but for simplicity here we assume < 100 for now.
      authOrFilters.push(Query.equal('$id', collabResourceIds.slice(0, 100)));
  }

  // Use the system client to manually enforce our visibility logic
  const res = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    queries: [
      Query.equal('isThread', true),
      Query.or(authOrFilters),
      Query.limit(100)
    ] as any
  }).catch(() => ({ rows: [] }));

  // Sort by updatedAt descending
  const rows = [...(res.rows || [])];


  rows.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

  return JSON.parse(JSON.stringify(rows));
}

export async function deleteGhostThreadSecure(threadId: string, jwt?: string) {
    const actor = await getActor(jwt);
    if (!actor || !actor.$id) throw new Error('Unauthorized');

    const tables = createSystemTablesDB();
    const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
    const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

    // 1. Fetch thread to verify ownership or collaboration
    const thread = await getRowCached({ databaseId: dbId, tableId, rowId: threadId });
    if (!thread) throw new Error('Thread not found');

    const isCreator = thread.creatorId === actor.$id || thread.userId === actor.$id;
    
    let isAuthorized = isCreator;

    if (!isAuthorized) {
        // Check if actor is a collaborator on the thread itself OR the parent resource
        const resourceId = thread.resourceId || threadId;
        try {
            const collabsRes = await tables.listRows({
                databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
                tableId: 'Collaborators',
                queries: [
                    Query.equal('resourceId', resourceId),
                    Query.equal('userId', actor.$id)
                ] as any
            });
            if (collabsRes.rows.length > 0) {
                isAuthorized = true;
            }
        } catch {}
    }

    if (!isAuthorized) {
        throw new Error('Forbidden: Insufficient permissions to delete this thread');
    }

    // 2. Cascade delete children (comments, reactions, voice files)
    try {
        await executeCascadeDeleteSecure(dbId, tableId, threadId);
    } catch (err) {
        console.error('[deleteGhostThreadSecure] Cascade cleanup failed:', err);
    }

    // 3. Delete the thread row itself
    const result = await tables.deleteRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: threadId,
    });

    return { success: true, result: JSON.parse(JSON.stringify(result)) };
}

export async function claimSendObjectSecure(payload: {
  noteId: string;
  claimSecret: string;
  decryptedData?: any;
  jwt: string;
}) {
  const actor = await getActor(payload.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const note = await tables.getRow<any>(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    payload.noteId
  );

  const meta = (() => {
    try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
  })();

  if (meta.ghostSecret !== payload.claimSecret) {
    throw new Error('Invalid claim secret');
  }

  const kind = meta.send_object?.kind || 'note';
  const isPaid = hasPaidKylrixPlan(actor as any);

  // 1. Handle Type-Specific Conversions
  if (kind === 'note') {
    await tables.updateRow(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      note.$id,
      { 
        userId: actor.$id,
        creatorId: actor.$id,
        isGuest: false,
        isPublic: true // Default claimed notes to public for now
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.write(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id)),
        Permission.read(Role.any())
      ]
    );
  } else if (kind === 'task') {
    const data = payload.decryptedData;
    if (!data) throw new Error('Decrypted task data required for claim');
    
    await tables.createRow(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      ID.unique(),
      {
        title: data.title,
        description: data.detail || '',
        status: 'todo',
        priority: 'medium',
        dueDate: data.dueAt || null,
        userId: actor.$id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.write(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id))
      ]
    );
  } else if (kind === 'discussion') {
    await tables.updateRow(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      note.$id,
      { 
        isThread: true, 
        isGuest: false,
        userId: actor.$id,
        creatorId: actor.$id 
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.write(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id)),
        Permission.read(Role.any())
      ]
    );
  } else if (kind === 'file') {
    if (!isPaid) {
      throw new Error('PRO_REQUIRED: Kylrix Pro is required to claim files.');
    }
    
    const manifest = payload.decryptedData;
    if (!manifest?.fileId) throw new Error('File manifest required for claim');

    // Move file to general_storage
    const sourceBucket = manifest.bucketId || APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL;
    
    // Create new private note for the claimed file
    await tables.createRow(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      ID.unique(),
      {
        title: note.title,
        content: '_Imported from Send — see attachments._',
        userId: actor.$id,
        creatorId: actor.$id,
        isGhost: false,
        isFile: true,
        metadata: JSON.stringify({
          send_object: { ...meta.send_object, bucketId: sourceBucket },
          isEncrypted: note.isEncrypted
        })
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.write(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id))
      ]
    );
  }

  // 2. Cleanup the Ghost Link (Delete original row)
  await tables.deleteRow(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    payload.noteId
  );

  return { success: true, kind };
}

/**
 * Server SDK Port: Fetches the profile status row from the profiles table.
 * Bypasses client-side RLS limits using the system tables database.
 */
export async function getGlobalProfileStatusSecure(userId: string) {
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) return { exists: false, error: 'userId is required' };

  try {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      queries: [
        Query.equal('userId', targetUserId),
        Query.limit(1)
      ]
    });
    if (res.total > 0) {
      return { exists: true, profile: JSON.parse(JSON.stringify(res.rows[0])) };
    }
    return { exists: false, error: 'Not Found' };
  } catch (e: any) {
    return { exists: false, error: e.message };
  }
}

/**
 * Ruthless Sharing: Unified toggle for isPublic and isGuest flags.
 */
export async function toggleResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  mode: 'publish' | 'copy_only' | 'make_private' | 'guest_off' | 'guest_on';
  projectId?: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { resourceType, resourceId, mode, projectId } = params;
  const tables = createSystemTablesDB();

  const config = getResourceConfig(resourceType);
  if (!config) throw new Error(`Unsupported resource type: ${resourceType}`);

  const row = await tables.getRow({
    databaseId: config.databaseId,
    tableId: config.tableId,
    rowId: resourceId
  }).catch(() => null);

  if (!row) throw new Error('Resource not found');
  
  const ownerId = row.userId || row.ownerId || row.creatorId;
  if (ownerId !== actor.$id) {
     throw new Error('Only the owner can manage public sharing');
  }

  let isPublic = !!row.isPublic;
  let isGuest = !!row.isGuest;

  if (mode === 'copy_only') {
    return {
      success: true,
      isPublic,
      isGuest,
      publicUrl: buildPublicResourceUrl(resourceType, resourceId, { projectId })
    };
  }

  if (mode === 'publish') {
    isPublic = true;
    isGuest = true;
  } else if (mode === 'make_private') {
    isPublic = false;
    isGuest = false;
  } else if (mode === 'guest_off') {
    isGuest = false;
  } else if (mode === 'guest_on') {
    isGuest = true;
    isPublic = true;
  }

  // Constraint: TOTP cannot be shared
  if ((isPublic || isGuest) && resourceType === 'totp') {
    throw new Error("TOTP codes can't be shared publicly");
  }

  const updateData: Record<string, unknown> = {
    isPublic,
    isGuest,
  };

  // Only tables with a custom updatedAt column — tasks/events/forms omit it.
  if (resourceType === 'note' || resourceType === 'project' || resourceType === 'credential' || resourceType === 'totp') {
    updateData.updatedAt = new Date().toISOString();
  }

  if (resourceType === 'project') {
    updateData.visibility = isPublic ? 'public' : 'private';
  }

  if (resourceType === 'form' && mode === 'publish') {
    updateData.status = 'published';
  }

  try {
    await tables.updateRow({
      databaseId: config.databaseId,
      tableId: config.tableId,
      rowId: resourceId,
      data: updateData
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not save sharing settings';
    console.error('[toggleResourcePublicGuest]', resourceType, resourceId, error);
    throw new Error(message);
  }

  const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });

  return {
    success: true,
    isPublic,
    isGuest,
    publicUrl
  };
}

export async function getResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  jwt?: string;
}) {
  const config = getResourceConfig(params.resourceType);
  if (!config) throw new Error(`Unsupported resource type: ${params.resourceType}`);

  const tables = createSystemTablesDB();
  const row = await tables.getRow({
    databaseId: config.databaseId,
    tableId: config.tableId,
    rowId: params.resourceId
  }).catch(() => null);

  if (!row) throw new Error('Resource not found');

  return {
    isPublic: !!row.isPublic,
    isGuest: !!row.isGuest,
    isPinned: !!row.isPinned,
    userId: row.userId || row.ownerId || row.creatorId
  };
}

function getResourceConfig(type: PublicResourceType) {
  switch (type) {
    case 'note': return { databaseId: APPWRITE_CONFIG.DATABASES.NOTE, tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES };
    case 'credential': return { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS };
    case 'totp': return { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS };
    case 'task':
    case 'goal': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS };
    case 'form': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS };
    case 'event': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS };
    case 'project': return { databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: 'projects' };
    case 'moment': return { databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: APPWRITE_CONFIG.TABLES.CHAT.MOMENTS };
    default: return null;
  }
}

export async function approveProjectJoinRequestSecure(projectId: string, targetUserId: string, permissionLevel: 'admin' | 'editor' | 'viewer' = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // 1. Get project
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
  }).catch(() => null);

  if (!project) throw new Error('Project not found');

  // Verify requester is owner or admin of the project
  const isOwner = project.ownerId === actor.$id;
  let isAdmin = false;
  if (!isOwner) {
    const collabs = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', projectId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', actor.$id),
        Query.equal('status', 'accepted')
      ] as any
    });
    if (collabs.rows.length > 0 && collabs.rows[0].permission === 'admin') {
      isAdmin = true;
    }
  }

  if (!isOwner && !isAdmin) {
    throw new Error('Forbidden: Only owners and admins can approve join requests');
  }

  // 2. Find request row
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project'),
      Query.equal('userId', targetUserId)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: existingCollab.rows[0].$id,
      data: {
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        status: 'accepted',
        accepted: true,
        role: 'collaborator'
      }
    });
  } else {
    // If no request exists, just create an accepted collaborator
    await tables.createRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: ID.unique(),
      data: {
        resourceId: projectId,
        resourceType: 'project',
        userId: targetUserId,
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        invitedAt: new Date().toISOString(),
        accepted: true,
        status: 'accepted',
        role: 'collaborator'
      }
    });
  }

  // 3. Grant Appwrite read permissions
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${targetUserId}")`);

  const { databases } = createSystemClient();
  const permissionsList = Array.from(newPermissions);
  await databases.updateRow(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId,
    { $permissions: permissionsList },
    permissionsList
  );

  return { success: true };
}

export async function attachObjectSecure(params: {
  parentId: string;
  parentKind: string;
  childId: string;
  childKind: string;
  metadata?: any;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  const userTier = getUserSubscriptionTier(actor);
  const { users } = createSystemClient();

  // Get parent resource (e.g. project) to check the parent's owner tier
  let parentOwnerId = actor.$id;
  if (params.parentKind === 'project') {
    try {
      const parentProject = await tables.getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'projects',
        rowId: params.parentId
      });
      if (parentProject && parentProject.ownerId) {
        parentOwnerId = parentProject.ownerId;
      }
    } catch {}
  }

  // Get parent owner's tier
  const parentOwner = parentOwnerId === actor.$id ? actor : await users.get(parentOwnerId).catch(() => actor);
  const parentOwnerTier = getUserSubscriptionTier(parentOwner);

  // Total limit of the parent container
  let containerLimit = 3; // Free default
  if (parentOwnerTier === 'PRO') {
    containerLimit = 10;
  } else if (parentOwnerTier === 'TEAMS' || parentOwnerTier === 'ORG' || parentOwnerTier === 'LIFETIME') {
    containerLimit = Infinity;
  }

  // Count existing attachments for the container
  const containerExisting = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', params.parentId),
      Query.equal('parentKind', params.parentKind)
    ] as any
  });

  if (containerExisting.rows.length >= containerLimit) {
    throw new Error(`Attachment limit reached: This ${params.parentKind} has reached its limit of ${containerLimit} attachments on the ${parentOwnerTier} plan.`);
  }

  // Actor-specific limit: Free user can upload max 3 objects even inside a Pro project
  if (userTier === 'FREE') {
    const actorExisting = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.equal('parentId', params.parentId),
        Query.equal('parentKind', params.parentKind),
        Query.equal('userId', actor.$id)
      ] as any
    });
    if (actorExisting.rows.length >= 3) {
      throw new Error(`Attachment limit reached: Free users can attach up to 3 objects per resource. Upgrade to PRO to attach more.`);
    }
  }

  const now = new Date().toISOString();
  const obj = await tables.createRow({
    databaseId,
    tableId,
    rowId: ID.unique(),
    data: {
      parentId: params.parentId,
      parentKind: params.parentKind,
      childId: params.childId,
      childKind: params.childKind,
      userId: actor.$id,
      metadata: params.metadata ? (typeof params.metadata === 'string' ? params.metadata : JSON.stringify(params.metadata)) : null,
      createdAt: now,
      updatedAt: now,
      isPublic: false,
      isGuest: false,
      isGeneral: false
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
      Permission.write(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id))
    ]
  });

  return JSON.parse(JSON.stringify(obj));
}

export async function detachObjectSecure(objectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  await tables.deleteRow({
    databaseId,
    tableId,
    rowId: objectId
  });

  return { success: true };
}

export async function detachObjectByRelationSecure(params: {
  parentId: string;
  childId: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  const res = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', params.parentId),
      Query.equal('childId', params.childId),
      Query.limit(10)
    ] as any
  });

  await Promise.all(res.rows.map((row: any) => 
    tables.deleteRow({
      databaseId,
      tableId,
      rowId: row.$id
    })
  ));

  return { success: true, count: res.rows.length };
}

export async function getProfilePicturePreviewSecure(fileId: string): Promise<string | null> {
  const targetId = String(fileId || '').trim();
  if (!targetId) return null;

  try {
    const { storage } = createSystemClient();
    const fileBuffer = await storage.getFilePreview('profile_pictures', targetId, 160, 160);
    const base64 = Buffer.from(fileBuffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err: any) {
    console.error('[secure-ops] getProfilePicturePreviewSecure failed:', err);
    return null;
  }
}

export async function getObjectsByParentSecure(parentId: string, parentKind: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  const res = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', parentId),
      Query.equal('parentKind', parentKind),
      Query.limit(100)
    ] as any
  });

  return JSON.parse(JSON.stringify(res.rows));
}





