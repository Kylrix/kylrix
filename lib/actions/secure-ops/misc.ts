import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';


import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { withSystemTransaction } from '@/lib/services/internal/transaction';
import { Registry } from '@/lib/core/di/registry';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import {
  IDSchema,
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema
} from '@/lib/validations/schemas';

// Import interfaces / types from shared
import { TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  verifyResourcePermissionSecure
} = shared;



async function getIsSpecializedTable(tableId: string): Promise<boolean> {
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
        sourceId: dateKey});
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
      metadata: body?.metadata || undefined});
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
      metadata: body?.metadata || undefined});
  }
  if (action === 'lock_claim') {
      return InternalKylrixTokenService.lockClaim({
          userId: actor.$id,
          amountMicro: String(body?.amountMicro || ''),
          destinationWallet: String(body?.destinationWallet || ''),
          chain: String(body?.chain || 'solana'),
          idempotencyKey: String(body?.idempotencyKey || '')});
  }
  if (action === 'settle_claim') {
      if (!isSERVERSDK) throw new Error('Forbidden');
      return InternalKylrixTokenService.settleClaim({
          userId: String(body?.userId || ''),
          amountMicro: String(body?.amountMicro || ''),
          destinationWallet: String(body?.destinationWallet || ''),
          chain: String(body?.chain || 'solana'),
          onchainTxHash: String(body?.onchainTxHash || ''),
          idempotencyKey: String(body?.idempotencyKey || '')});
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
          metadata: body?.metadata});
  }

  throw new Error('Unknown token action');
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
    actorName: actor.name || actor.email || payload.actorName});
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

  const publicProfiles = res.rows.map((doc: any) => ({
    $id: doc.$id,
    name: doc.displayName || doc.username,
    displayName: doc.displayName || null,
    username: doc.username,
    avatar: doc.avatar || null,
    bio: doc.bio || null,
    walletAddress: doc.walletAddress || null,
    publicKey: doc.publicKey || null}));

  return { rows: publicProfiles };
}

export async function executeMasterPurgeSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const userId = actor.$id;
  const { databases, users, storage } = createSystemClient() as any;

  // Single-database: passwordManagerDb holds all tables; also support legacy CHAT/VAULT ids via fallback
  const mainDb = (APPWRITE_CONFIG as any).DATABASES?.PASSWORD_MANAGER || (APPWRITE_CONFIG as any).DATABASES?.VAULT || 'passwordManagerDb';
  const tryList = async (db: string, table: string, queries: any[]) => {
    try { const r: any = await databases.listRows(db, table, queries); return r; } catch { try { const r: any = await databases.listRows(mainDb, table, queries); return r; } catch { return { rows: [], total: 0 }; } }
  };
  const tryDeleteRow = async (db: string, table: string, rowId: string) => {
    try { await databases.deleteRow(db, table, rowId); } catch { try { await databases.deleteRow(mainDb, table, rowId); } catch {} }
  };
  const tryUpdateRow = async (db: string, table: string, rowId: string, data: any) => {
    try { await databases.updateRow(db, table, rowId, data); } catch { try { await databases.updateRow(mainDb, table, rowId, data); } catch {} }
  };

  // Helper: batched delete for infinite data (limit 100 per page, loop until empty)
  const purgeByQuery = async (db: string, table: string, queries: any[]) => {
    for (;;) {
      const res: any = await tryList(db, table, [...queries, (await import('node-appwrite')).Query.limit(100)]);
      if (!res.rows?.length) break;
      await Promise.all(res.rows.map((r: any) => tryDeleteRow(db, table, r.$id).catch(() => null)));
      if (res.rows.length < 100) break;
    }
  };

  // Parallel discovery across infinite domains (no password/email needed — JWT only)
  const [
    keychainRows,
    totpRows,
    identitiesRows,
    mappingsRows,
    profilesRows,
    notesRows,
    tasksRows,
    projectsRows,
    eventsRows,
    formsRows,
    commentsRows,
    reactionsRows,
  ] = await Promise.all([
    tryList(mainDb, 'keychain', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'totpSecrets', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'identities', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'keyMapping', [ (await import('node-appwrite')).Query.or([(await import('node-appwrite')).Query.equal('grantee', userId), (await import('node-appwrite')).Query.contains('metadata', userId)]), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'profiles', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(10) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'notes', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'tasks', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'projects', [ (await import('node-appwrite')).Query.equal('creatorId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'events', [ (await import('node-appwrite')).Query.equal('creatorId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'forms', [ (await import('node-appwrite')).Query.equal('creatorId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'comments', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
    tryList(mainDb, 'reactions', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(100) ]).catch(() => ({ rows: [] })),
  ]);

  // Immediate parallel cascade: delete all discovered rows (storage files next, auth last)
  const actions: Promise<any>[] = [];
  const pushRows = (rows: any[], db: string, table: string) => rows.forEach((r: any) => actions.push(tryDeleteRow(db, table, r.$id)));
  pushRows(keychainRows.rows || [], mainDb, 'keychain');
  pushRows(totpRows.rows || [], mainDb, 'totpSecrets');
  pushRows(identitiesRows.rows || [], mainDb, 'identities');
  pushRows(mappingsRows.rows || [], mainDb, 'keyMapping');
  pushRows(notesRows.rows || [], mainDb, 'notes');
  pushRows(tasksRows.rows || [], mainDb, 'tasks');
  pushRows(eventsRows.rows || [], mainDb, 'events');
  pushRows(formsRows.rows || [], mainDb, 'forms');
  pushRows(commentsRows.rows || [], mainDb, 'comments');
  pushRows(reactionsRows.rows || [], mainDb, 'reactions');
  // Projects: cascade delete via internal helper if available
  for (const p of (projectsRows.rows || [])) {
    actions.push((async () => {
      try { const { deleteProjectSecure } = await import('./projects'); await (deleteProjectSecure as any)(p.$id, 'all' as any, jwt).catch(() => tryDeleteRow(mainDb, 'projects', p.$id)); } catch { await tryDeleteRow(mainDb, 'projects', p.$id); }
    })());
  }
  // Conversations/members/messages: sweep via conversationMembers → conversations
  actions.push((async () => {
    const memRes: any = await tryList(mainDb, 'conversationMembers', [ (await import('node-appwrite')).Query.equal('userId', userId), (await import('node-appwrite')).Query.limit(1000) ]);
    const cids = Array.from(new Set((memRes.rows || []).map((r: any) => r.conversationId).filter(Boolean)));
    for (const cid of cids) {
      await purgeByQuery(mainDb, 'messages', [ (await import('node-appwrite')).Query.equal('conversationId', cid as string), (await import('node-appwrite')).Query.equal('senderId', userId) ]);
      await purgeByQuery(mainDb, 'messageReactions', [ (await import('node-appwrite')).Query.equal('conversationId', cid as string) ]);
      // remove membership
      for (const m of (memRes.rows || []).filter((r: any) => r.conversationId === cid)) await tryDeleteRow(mainDb, 'conversationMembers', m.$id);
      // if self-chat, delete conversation row itself
      try { const conv: any = await databases.getRow(mainDb, 'conversations', cid as string).catch(() => null); if (conv && Array.isArray(conv.participants) && conv.participants.every((p: string) => p === userId)) await tryDeleteRow(mainDb, 'conversations', cid as string); } catch {}
    }
    // epochs
    await purgeByQuery(mainDb, 'epochs', [ (await import('node-appwrite')).Query.equal('grantee', userId) ]).catch(() => null);
  })());
  // Profiles: null out publicKey rather than delete (keep row for audit)
  for (const pr of (profilesRows.rows || [])) actions.push(tryUpdateRow(mainDb, 'profiles', pr.$id, { publicKey: null, updatedAt: new Date().toISOString() }));

  // Storage buckets: purge files owned by user (best-effort, no retention)
  actions.push((async () => {
    const bucketIds = ['notes_attachments', 'voice', 'profile_pictures', 'form_attachments', 'project_files'];
    for (const bid of bucketIds) {
      try {
        const { Query } = await import('node-appwrite');
        for (;;) {
          const files: any = await (storage as any).listFiles(bid, [Query.limit(100)]).catch(() => ({ files: [] }));
          const owned = (files.files || []).filter((f: any) => String(f.name || '').includes(userId) || String((f as any).userId || '') === userId);
          if (!owned.length) break;
          await Promise.all(owned.map((f: any) => (storage as any).deleteFile(bid, f.$id).catch(() => null)));
          if (owned.length < 100) break;
        }
      } catch {}
    }
  })());

  await Promise.all(actions);

  // Fire Appwrite function for deep residual sweep (async, no await for UX — instant)
  try {
    const { functions } = createSystemClient() as any;
    if (functions?.createExecution) await functions.createExecution('account-cleanup', JSON.stringify({ userId }), false).catch(() => null);
  } catch {}

  // Auth account LAST — ensures half-done not bricked; no retention
  try { await users.delete(userId); } catch (e: any) {
    // If admin delete fails (e.g., already deleted), ensure session cleared client will handle redirect
    if (!String(e?.message || '').includes('not found')) throw e;
  }
  return { success: true };
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
          reviewState: 'unverified'}})};

    const row = await databases.createRow(dbId, tableId, ID.unique(), payload, [Permission.read(Role.user(actor.$id))]);
    created.push(row);
  }

  return { success: true, count: created.length, reports: created };
}

export async function getUsersByIdsSecure(ids: string[]) {
  const { UsersService } = await import('@/lib/services/users');
  const profiles = await UsersService.getUsersByIds(ids);
  return JSON.parse(JSON.stringify(profiles));
}

export async function createSendthreadObjectSecure(data: {
  title: string;
  content: string;
  format?: string;
  threadSecret: string;
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
    isthread: true,
    send_object: data.sendObject,
    threadSecret: data.threadSecret,
    expiresAt,
    version: 'v3',
    isEncrypted: data.isEncrypted ?? false,
    ...(data.creatorDeletionProofHash ? { creatorDeletionProofHash: data.creatorDeletionProofHash } : {})});

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
      isthread: true,
      isThread: false},
    permissions: [
      Permission.read(Role.any()),
      ...(actor ? [Permission.read(Role.user(actor.$id))] : [])
    ]});

  return JSON.parse(JSON.stringify(result));
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
        rowId: (rowData as any).formId});
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
  try {
    actor = await getActor(jwt);
  } catch (_) {}

  if (!actor || !actor.$id) {
    actor = { $id: 'guest', email: 'guest@kylrix.space' };
  }

  // 3. Security checks and payload preparation
  if (rowData && typeof rowData === 'object') {
    const isSpecializedTable = await getIsSpecializedTable(tblId);

    if (!isSpecializedTable) {
      // Workspace/project escape hatch: project-linked rows use isGuest/isGeneral + project_objects membership, not strict userId equality.
      // If actor is guest due to stale JWT but cookies still resolve, getActor would have returned real actor; guest fallback only for anonymous.
      // For workspace-linked payloads we auto-restamp to actor instead of throwing, to clear amber on stale-JWT Forbidden.
      const isWorkspaceLinked = !!(rowData as any).projectId || (rowData as any).isWorkspace === true;
      const actorIsGuest = !actor?.$id || actor.$id === 'guest';
      if ((rowData as any).userId && (rowData as any).userId !== actor?.$id) {
        if (isWorkspaceLinked && actor?.$id && !actorIsGuest) {
          // Restamp workspace object to current actor (privileged adapter pattern: Actor ID is source of truth)
          (rowData as any).userId = actor.$id;
          if ((rowData as any).ownerId) (rowData as any).ownerId = actor.$id;
          if ((rowData as any).creatorId) (rowData as any).creatorId = actor.$id;
        } else if (actorIsGuest) {
          throw new Error('Unauthorized: Session expired or invalid');
        } else {
          throw new Error('Forbidden: Cannot create resource for another user');
        }
      }
      if ((rowData as any).ownerId && (rowData as any).ownerId !== actor?.$id) {
        if (isWorkspaceLinked && actor?.$id && !actorIsGuest) {
          (rowData as any).ownerId = actor.$id;
        } else if (actorIsGuest) {
          throw new Error('Unauthorized: Session expired or invalid');
        } else {
          throw new Error('Forbidden: Cannot create resource for another user');
        }
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
            action: 'update'});
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
            rowId: (rowData as any).formId});
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

  try {
    const result = await Registry.getDatabase().createRow<any>(
      dbId,
      tblId,
      customRowId,
      dataCopy,
      perms,
      { forceSystem: true }
    );
    return JSON.parse(JSON.stringify(result));
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const isDuplicate = message.includes('already exists') || message.includes('duplicate') || error?.code === 409 || error?.status === 409;
    if (customRowId && isDuplicate) {
      return updateRowSecure(dbId, tblId, customRowId, dataCopy, perms, jwt);
    }
    throw error;
  }
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
          action: 'update'});
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
            action: 'update'});
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
      data: rowData});
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
          action: 'update'});
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
            action: 'delete'});
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
      action: 'delete'});
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

  // Transactional parent delete (same DB as cascade children for notes/objects in NOTE/CHAT/FLOW where possible)
  try {
    await withSystemTransaction(async (txId) => {
      const t: any = createSystemTablesDB();
      await t.deleteRow({ databaseId: dbId, tableId: tblId, rowId: rId, transactionId: txId });
    }, { ttl: 60 });
  } catch {
    await Registry.getDatabase().deleteRow(dbId, tblId, rId, { forceSystem: true });
  }
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
          rowId: authUser.$id});
      } catch {
        const profRes = await tables.listRows({
          databaseId,
          tableId,
          queries: [Query.equal('userId', authUser.$id), Query.limit(1)] as any});
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
        tier: profile?.tier || null}))];
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
      ] as any});

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
      ] as any});

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
        rows: res.rows}));
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
            rowId});
          
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

    if (error?.code === 404 || error?.status === 404 || error?.message?.includes('could not be found')) {
      return null;
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
        'X-Appwrite-Key': process.env.APPWRITE_API || ''}});
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

export async function promotethreadResourceThreadToStorySecure(
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

  // 2. Fetch the thread note itself to see if it exists
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
    isthread: false,
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
    ]
  });

  // 5. Cleanup the original thread note comments
  await Promise.all(
    commentsList.rows.map(c => 
      tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
        rowId: c.$id
      }).catch(() => null)
    )
  );

  // 6. Delete the original thread note
  if (noteRow) {
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    }).catch(() => null);
  }

  return JSON.parse(JSON.stringify(storyNote));
}

export async function deletethreadThreadSecure(threadId: string, jwt?: string) {
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

    // 2. Cascade delete children (comments, reactions, voice files, linked objects, key mappings)
    try {
        await executeCascadeDeleteSecure(dbId, tableId, threadId);
    } catch (err) {
        console.error('[deletethreadThreadSecure] Cascade cleanup failed:', err);
    }

    // 2b. Wipe project_objects and key_mapping for discussion thread thread
    try {
        const polyCollabs = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: 'Collaborators',
            queries: [Query.equal('resourceId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((polyCollabs.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: 'Collaborators',
            rowId: row.$id
        }).catch(() => null)));

        const keyMappings = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: 'key_mapping',
            queries: [Query.equal('resourceId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((keyMappings.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: 'key_mapping',
            rowId: row.$id
        }).catch(() => null)));

        const projObjects = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'project_objects',
            queries: [Query.equal('entityId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((projObjects.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'project_objects',
            rowId: row.$id
        }).catch(() => null)));
    } catch (cleanErr) {
        console.warn('[deletethreadThreadSecure] Secondary cleanup non-fatal warning:', cleanErr);
    }

    // 3. Delete the thread row itself
    const result = await tables.deleteRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: threadId});

    return { success: true, result: JSON.parse(JSON.stringify(result)) };
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
    isGuest};

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

  // Transactional for encrypted vault objects (credential/totp) where share toggle implies key/collab fan-out; single-row but kept atomic with RLS bypass
  try {
    try {
      await withSystemTransaction(async (txId) => {
        await (createSystemTablesDB() as any).updateRow({ databaseId: config.databaseId, tableId: config.tableId, rowId: resourceId, data: updateData, permissions: row.$permissions || [], transactionId: txId });
      }, { ttl: 30 });
    } catch {
      await tables.updateRow({
        databaseId: config.databaseId,
        tableId: config.tableId,
        rowId: resourceId,
        data: updateData,
        permissions: row.$permissions || []
      });
    }
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
    case 'agent_session':
    case 'agent_conversation':
      return { databaseId: APPWRITE_CONFIG.DATABASES.NOTE, tableId: 'agentic_sessions' };
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
      rowId: params.parentId}).catch(() => null as any);

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
    ]
  });

  return JSON.parse(JSON.stringify(obj));
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
    [Permission.read(Role.user(actor.$id))]
  );
}

export async function toggleTaskReminderSecure(taskId: string, enabled: boolean, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const TASKS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  const task = await tables.getRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: TASKS_TABLE,
    rowId: taskId}) as any;

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

    const { Functions } = await import('node-appwrite');
    const { client } = createSystemClient();
    const functions = new Functions(client);
    const functionId = 'goal-reminder-dispatch';

    // Trigger/schedule execution of goal-reminder-dispatch function
    try {
      await functions.createExecution(
        functionId,
        JSON.stringify({ taskId, userId: actor.$id }),
        false, // async execution
        '/',
        'POST' as any
      );
    } catch (fnErr: any) {
      console.warn('[toggleTaskReminderSecure] Direct function execution error, registering scheduled state:', fnErr?.message);
    }

    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: true,
        recurrenceRule: `reminder_fn_id:${functionId}`}
    });

    return JSON.parse(JSON.stringify(updated));
  } else {
    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: false,
        recurrenceRule: null}
    });

    return JSON.parse(JSON.stringify(updated));
  }
}

