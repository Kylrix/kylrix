'use server';

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
  if (action === 'zap') {
    const fromUserId = String(body?.fromUserId || actor.$id || '').trim();
    if (!isSERVERSDK && fromUserId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.zapObject({
      fromUserId,
      targetKind: body?.targetKind,
      targetId: String(body?.targetId || '').trim(),
      targetOwnerId: String(body?.targetOwnerId || '').trim(),
      amountMicro: String(body?.amountMicro || '1'),
      idempotencyKey: String(body?.idempotencyKey || `zap:${Date.now()}`),
      comment: body?.comment,
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

  // 3. Security checks and payload preparation
  if (rowData && typeof rowData === 'object') {
    const isSpecializedTable = await getIsSpecializedTable(tblId);

    if (!isSpecializedTable) {
      const isWorkspaceLinked = !!(rowData as any).projectId || (rowData as any).isWorkspace === true;
      const isAuthenticatedActor = actor && actor.$id && actor.$id !== 'guest';

      const isGuestOrUnassigned =
        !(rowData as any).userId ||
        (rowData as any).userId === 'guest' ||
        (rowData as any).userId === 'thread';

      if (isGuestOrUnassigned && isAuthenticatedActor) {
        (rowData as any).userId = actor.$id;
        if ((rowData as any).ownerId) (rowData as any).ownerId = actor.$id;
        if ((rowData as any).creatorId) (rowData as any).creatorId = actor.$id;
      } else if ((rowData as any).userId && (rowData as any).userId !== actor?.$id) {
        if (isWorkspaceLinked && isAuthenticatedActor) {
          (rowData as any).userId = actor.$id;
          if ((rowData as any).ownerId) (rowData as any).ownerId = actor.$id;
          if ((rowData as any).creatorId) (rowData as any).creatorId = actor.$id;
        } else if (!isAuthenticatedActor) {
          throw new Error('Unauthorized: Session expired or invalid');
        } else {
          throw new Error('Forbidden: Cannot create resource for another user');
        }
      }
      if ((rowData as any).ownerId && (rowData as any).ownerId !== actor?.$id && (rowData as any).ownerId !== 'guest' && (rowData as any).ownerId !== 'thread') {
        if (isWorkspaceLinked && isAuthenticatedActor) {
          (rowData as any).ownerId = actor.$id;
        } else if (!isAuthenticatedActor) {
          throw new Error('Unauthorized: Session expired or invalid');
        } else {
          throw new Error('Forbidden: Cannot create resource for another user');
        }
      }
      if (!(rowData as any).userId && !(rowData as any).ownerId && isAuthenticatedActor) {
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

/**
 * Batch trash form submissions atomically with single permission verification.
 * Avoids spinning up multiple token/permission checks per operation.
 * Form creator or submitter can trash.
 */
