import * as shared from './shared';
import {
  ID, Permission, Query, Role, Databases, TablesDB, Account
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import {
  allowsCollaboratorSharing,
  getCollaboratorCap,
  getContainerObjectCap,
  getProjectCap
} from '@/lib/entitlements';
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
import { isMfaRequiredError } from '@/lib/mfa';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';
import { permissionsInternal } from '@/lib/services/internal/permissions';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { dispatchSecureNotification } from '@/lib/services/internal/notification-dispatcher';
import { executeCascadeDeleteSecure } from '../cascade-delete';
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

// Import interfaces / types from shared
import { PermissionChangeInput, PermissionLevel, TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  hasWriteAccess,
  serializeMomentRow,
  verifyResourcePermissionSecure,
  verifyNotePermission,
  verifyProjectPermission,
  verifyFormPermission,
  verifyEventPermission,
  sanitizeEventData,
  serializeTokenMintResult,
  rowCache,
  CACHE_TTL_MS,
  VIEWER_COOKIE,
  isViewerTokenValid,
  issueViewerToken,
  cookies
} = shared;

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

export async function createHandoffSessionSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  // Session context verification (MFA check)
  const { account: userAccount } = await createServerClient(jwt);

  try {
    await userAccount.get();
  } catch (error) {
    if (isMfaRequiredError(error)) {
      const err = new Error('user_more_factors_required');
      (err as any).code = 'MFA_REQUIRED';
      throw err;
    }
    throw error;
  }

  const { users } = createSystemClient();
  const sessionToken = await users.createToken(actor.$id);

  return {
    userId: actor.$id,
    secret: sessionToken.secret,
    expire: sessionToken.expire,
  };
}

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

export async function verifyAdminSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  
  const admin = isEnvAdminUser(actor);
  if (!admin) throw new Error('Forbidden: admin privileges required');

  return { success: true, userId: actor.$id };
}

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

export async function verifyTurnstileSecure(token: string) {
  if (!token) throw new Error('token is required');
  const result = await verifyTurnstileToken(token);
  if (!result.success) {
    throw new Error(`Turnstile verification failed: ${result.error_codes?.join(', ') || 'unknown'}`);
  }
  return { success: true };
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

export async function getUsersByIdsSecure(ids: string[]) {
  const { UsersService } = await import('@/lib/services/users');
  const profiles = await UsersService.getUsersByIds(ids);
  return JSON.parse(JSON.stringify(profiles));
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

export async function getIsSpecializedTable(tableId: string): Promise<boolean> {
  return (
    tableId === APPWRITE_CONFIG.TABLES.FLOW.GUESTS || 
    tableId === 'Collaborators' || 
    tableId === 'collaborators' ||
    tableId === 'formSubmissions' ||
    tableId === 'wallets' ||
    tableId === 'walletMap' ||
    tableId === 'follows' ||
    tableId === 'activityLog' ||
    tableId === 'conversations' ||
    tableId === 'conversationMembers'
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

  const trashSupportedTables = [
    '67ff05f3002502ef239e', 'notes',
    '67ff06280034908cf08a', 'tags',
    'tasks',
    'events',
    'forms',
    'formSubmissions',
    'credentials',
    'totpSecrets',
    'projects'
  ];

  if (trashSupportedTables.includes(tblId)) {
    await Registry.getDatabase().updateRow(dbId, tblId, rId, { isTrash: true }, undefined, { forceSystem: true });
    return JSON.parse(JSON.stringify({ success: true, softDeleted: true }));
  }

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
  const isEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);

  if (isEmailQuery) {
    try {
      const { users } = createSystemClient();
      const userList = await users.list([
        Query.equal('email', cleaned.toLowerCase()),
        Query.limit(1),
      ]).catch(() => ({ users: [] as any[] }));

      const authUser = userList.users?.[0];
      if (!authUser) return [];

      let profile: any = null;
      try {
        profile = await tables.getRow({
          databaseId,
          tableId,
          rowId: authUser.$id,
        });
      } catch {
        const profRes = await tables.listRows({
          databaseId,
          tableId,
          queries: [Query.equal('userId', authUser.$id), Query.limit(1)] as any,
        });
        profile = profRes.rows?.[0] || null;
      }

      return [JSON.parse(JSON.stringify({
        $id: authUser.$id,
        id: authUser.$id,
        userId: authUser.$id,
        username: profile?.username || null,
        displayName: profile?.displayName || authUser.name || null,
        avatar: profile?.avatar || null,
        bio: profile?.bio || null,
        publicKey: profile?.publicKey || null,
        email: authUser.email,
        $createdAt: profile?.$createdAt || null,
        last_username_edit: profile?.last_username_edit || null,
        tier: profile?.tier || null,
      }))];
    } catch (error: any) {
      console.warn('[searchGlobalUsersSecure] Email search failed:', error?.message);
      return [];
    }
  }

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
  } else if (kind === 'project') {
    const data = payload.decryptedData;
    await tables.createRow(
      APPWRITE_CONFIG.DATABASES.CHAT,
      'projects',
      ID.unique(),
      {
        title: note.title,
        summary: data?.description || '',
        status: data?.status || 'active',
        ownerId: actor.$id,
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.write(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id))
      ]
    );
  } else if (kind === 'tag') {
    const nameLower = note.title.toLowerCase();
    await tables.createRow(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.TAGS,
      ID.unique(),
      {
        name: note.title,
        nameLower,
        userId: actor.$id,
        isPublic: false,
        isGuest: false,
        usageCount: 0,
        metadata: JSON.stringify({ version: 'v2' })
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


  const updateData: Record<string, unknown> = {
    isPublic,
    isGuest,
  };

  // Only tables with a custom updatedAt column — tasks/events/forms omit it.
  if (resourceType === 'note' || resourceType === 'project' || resourceType === 'credential' || resourceType === 'totp') {
    updateData.updatedAt = new Date().toISOString();
  }

  if (resourceType === 'project') {
    updateData.visibility = isPublic || isGuest ? 'public' : 'private';
    if (!isPublic && !isGuest) {
      updateData.isGuest = false;
    }
  }

  if (resourceType === 'form' && mode === 'publish') {
    updateData.status = 'published';
  }

  try {
    await tables.updateRow({
      databaseId: config.databaseId,
      tableId: config.tableId,
      rowId: resourceId,
      data: updateData,
      permissions: row.$permissions || []
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

  // Note parent safety: only note owner or write collaborator can attach.
  if (params.parentKind === 'note') {
    const note = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: params.parentId,
    }).catch(() => null as any);

    if (!note) throw new Error('Parent note not found');

    const isOwner = note.userId === actor.$id;
    const collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];
    const hasWriteAccess = collaborators.some((entry: any) => {
      try {
        const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
        return parsed?.userId === actor.$id && String(parsed?.permission || '').toLowerCase() === 'write';
      } catch {
        return false;
      }
    });

    if (!isOwner && !hasWriteAccess) {
      throw new Error('Forbidden: You do not have write access to this note.');
    }
  }

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
  const containerLimit = getContainerObjectCap(parentOwnerTier);

  // Count existing attachments for the container
  const containerExisting = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', params.parentId),
      Query.equal('parentKind', params.parentKind)
    ] as any
  });

  const duplicate = containerExisting.rows.find((row: any) => (
    row?.childId === params.childId && row?.childKind === params.childKind
  ));
  if (duplicate) {
    return JSON.parse(JSON.stringify(duplicate));
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

export async function syncMasterpassToAccountPasswordAction(payload: {
  userId: string;
  masterpass: string;
  jwt?: string;
}) {
  const { z } = await import('zod');
  const validatedUserId = IDSchema.parse(payload.userId);
  const validatedMasterpass = z.string().parse(payload.masterpass);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id || actor.$id !== validatedUserId) {
    throw new Error('Unauthorized');
  }

  // 1. Update the Appwrite authentication password via System Users service
  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const { users, databases } = createSystemClient();
  await users.updatePassword(validatedUserId, validatedMasterpass);

  // 1b. Update user preferences to include hasPass: true without overwriting existing prefs
  try {
    const userDoc = await users.get(validatedUserId);
    const currentPrefs = userDoc.prefs || {};
    await users.updatePrefs(validatedUserId, {
      ...currentPrefs,
      hasPass: true
    });
  } catch (err) {
    console.error('[syncMasterpassToAccountPasswordAction] Failed to update user prefs:', err);
  }

  // 2. Query the keychain entry for this user and set authPass = true
  const keychainRes = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.VAULT,
    APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
    [
      Query.equal('userId', validatedUserId),
      Query.equal('type', 'password'),
      Query.limit(1)
    ]
  );

  const entry = keychainRes.rows?.[0];
  if (entry) {
    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.VAULT,
      APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
      entry.$id,
      { authPass: true }
    );
  }

  return { success: true };
}

export async function checkEmailAuthMethodAction(payload: { email: string }) {
  const { z } = await import('zod');
  const validatedEmail = z.string().email().parse(payload.email);

  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const { users } = createSystemClient();

  const userList = await users.list([
    Query.equal('email', validatedEmail),
    Query.limit(1)
  ]).catch(() => ({ total: 0, users: [] as any[] }));

  if (userList.total === 0) {
    return { exists: false, hasPass: false };
  }

  const user = userList.users[0];
  const hasPass = !!user.prefs?.hasPass;

  return { exists: true, hasPass };
}

export async function createStandaloneTagSecure(tagName: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const tagsTable = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
  const nameLower = tagName.trim().toLowerCase();

  return await tables.createRow(
    APPWRITE_DATABASE_ID,
    tagsTable,
    ID.unique(),
    {
      name: tagName.trim(),
      nameLower,
      userId: actor.$id,
      isPublic: false,
      isGuest: false,
      usageCount: 0,
      metadata: JSON.stringify({ version: 'v2' })
    },
    [
      Permission.read(Role.user(actor.$id)),
      Permission.write(Role.user(actor.$id)),
      Permission.delete(Role.user(actor.$id))
    ]
  );
}

export async function toggleTaskReminderSecure(taskId: string, enabled: boolean, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const { messaging, users } = createSystemClient();
  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const TASKS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  const task = await tables.getRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: TASKS_TABLE,
    rowId: taskId,
  }) as any;

  if (!task) throw new Error('Task not found');
  
  // Security verification
  if (task.userId !== actor.$id) {
    const collabs = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS,
      queries: [
        Query.equal('resourceId', taskId),
        Query.equal('userId', actor.$id)
      ] as any
    });
    if (collabs.total === 0) {
      throw new Error('Forbidden: Insufficient permissions');
    }
  }

  const now = new Date();

  if (enabled) {
    if (!task.dueDate) {
      throw new Error('Goal has no deadline attached to it.');
    }
    const deadline = new Date(task.dueDate);
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      throw new Error('Deadline is in the past.');
    }

    let scheduledTime: Date;
    if (diffMs > 24 * 60 * 60 * 1000) {
      scheduledTime = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
    } else if (diffMs > 60 * 60 * 1000) {
      scheduledTime = new Date(deadline.getTime() - 60 * 60 * 1000);
    } else {
      throw new Error('Deadline is less than an hour away. Cannot schedule reminder.');
    }

    if (task.recurrenceRule?.startsWith('reminder_msg_id:')) {
      const oldMsgId = task.recurrenceRule.split(':')[1];
      try {
        await messaging.delete(oldMsgId);
      } catch (err) {
        console.error('Failed to delete old reminder message:', err);
      }
    }

    const msgId = ID.unique();
    const recipientUser = await users.get(actor.$id);
    if (!recipientUser.email) {
      throw new Error('User has no email address configured.');
    }

    await messaging.createEmail({
      messageId: msgId,
      subject: `Goal Reminder: ${task.title}`,
      content: `Hi!\n\nThis is a reminder for your goal: "${task.title}".\n\nThe deadline is on ${deadline.toLocaleString()}.\n\nGood luck!`,
      users: [actor.$id],
      scheduledAt: scheduledTime.toISOString(),
    });

    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: true,
        recurrenceRule: `reminder_msg_id:${msgId}`,
      }
    });

    return JSON.parse(JSON.stringify(updated));
  } else {
    if (task.recurrenceRule?.startsWith('reminder_msg_id:')) {
      const oldMsgId = task.recurrenceRule.split(':')[1];
      try {
        await messaging.delete(oldMsgId);
      } catch (err) {
        console.error('Failed to delete reminder message:', err);
      }
    }

    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: false,
        recurrenceRule: null,
      }
    });

    return JSON.parse(JSON.stringify(updated));
  }
}

