import { createServerClient } from '@/lib/appwrite/server';
import { ID, Permission, Role, Query } from 'node-appwrite';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createHash } from 'node:crypto';
import { withSystemTransaction } from './transaction';
import {
  CHAT_DB_ID,
  CONVERSATIONS_TABLE_ID,
  MESSAGES_TABLE_ID,
  MESSAGE_REACTIONS_TABLE_ID,
  CONVERSATION_MEMBERS_TABLE_ID,
  KEY_MAPPING_TABLE_ID,
  EPOCHS_TABLE_ID,
  uniqueIds,
  buildMessagePermissions,
  buildReactionPermissions,
  isUniqueConstraintError
} from './chat-shared';
export async function joinRequestInternal(payload: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  resourceType: string,
  resourceId: string,
  requesterId?: string,
  action?: 'accept' | 'reject',
  jwt?: string;
  actorId?: string;
}) {
  let verifiedActorId = payload.actorId;
  let isFetched = false;
  let fetchedUser: any = null;

  const getUserLazily = async () => {
    if (isFetched) return fetchedUser;
    if (verifiedActorId) {
      fetchedUser = { $id: verifiedActorId };
    } else {
      const { account } = await createServerClient(payload.jwt);
      fetchedUser = await account.get().catch(() => null);
      if (fetchedUser) verifiedActorId = fetchedUser.$id;
    }
    isFetched = true;
    return fetchedUser;
  };

  const { databases } = createSystemClient();
  const JOIN_REQUESTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS;

  if (payload.method === 'GET') {
    await getUserLazily();
    const currentRequesterId = payload.requesterId || verifiedActorId || '';
    
    let alreadyJoined = false;
    if (currentRequesterId) {
      const memberRows = await databases.listRows(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
        Query.equal('conversationId', payload.resourceId),
        Query.equal('userId', currentRequesterId),
        Query.limit(1)]).catch(() => ({ rows: [] }));
      alreadyJoined = memberRows.rows.length > 0;
    }

    let request = null;
    if (currentRequesterId) {
      const existing = await databases.listRows(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
        Query.equal('resourceType', payload.resourceType),
        Query.equal('resourceId', payload.resourceId),
        Query.equal('requesterId', currentRequesterId),
        Query.limit(1)]);
      request = existing.rows[0] || null;
    }

    return JSON.parse(JSON.stringify({
      alreadyJoined,
      request}));
  }

  const user = await getUserLazily();
  if (!user) throw new Error('Unauthorized');

  if (payload.method === 'POST') {
    const requestId = buildReactionDocumentId(verifiedActorId!, payload.resourceId);
    const conversation = await databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.resourceId);
    const managers = normalizeParticipantIds(conversation);

    const request = await databases.createRow(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      requestId,
      {
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        requesterId: verifiedActorId,
        status: 'pending',
        createdAt: new Date().toISOString()},
      [
        Permission.read(Role.user(verifiedActorId!)),
        ...managers.map((id: any) => Permission.read(Role.user(id)))]);

    return JSON.parse(JSON.stringify(request));
  }

  if (payload.method === 'PATCH') {
    if (!payload.action || !payload.requesterId) throw new Error('action and requesterId required');
    
    const conversation = await databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.resourceId);
    const managers = normalizeParticipantIds(conversation);
    if (!managers.includes(verifiedActorId!)) throw new Error('Forbidden');

    const existing = await databases.listRows(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
      Query.equal('resourceType', payload.resourceType),
      Query.equal('resourceId', payload.resourceId),
      Query.equal('requesterId', payload.requesterId),
      Query.limit(1)]);
    const request = existing.rows[0];
    if (!request) throw new Error('Not found');

    const nextStatus = payload.action === 'accept' ? 'accepted' : 'rejected';
    const updated = await databases.updateRow(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      request.$id,
      {
        status: nextStatus,
        resolvedAt: new Date().toISOString(),
        resolvedBy: verifiedActorId}
    );

    if (payload.action === 'accept') {
      const participants = uniqueIds([...normalizeParticipantIds(conversation), payload.requesterId]);
      await databases.updateRow(
        CHAT_DB_ID,
        CONVERSATIONS_TABLE_ID,
        payload.resourceId,
        {
          participants,
          participantCount: participants.length,
          updatedAt: new Date().toISOString()}
      );
      
      await databases.createRow(
        CHAT_DB_ID,
        CONVERSATION_MEMBERS_TABLE_ID,
        ID.unique(),
        {
          conversationId: payload.resourceId,
          userId: payload.requesterId}
      ).catch(() => null);
    }

    return JSON.parse(JSON.stringify(updated));
  }

  if (payload.method === 'DELETE') {
    const existing = await databases.listRows(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
      Query.equal('resourceType', payload.resourceType),
      Query.equal('resourceId', payload.resourceId),
      Query.equal('requesterId', verifiedActorId!)]);

    for (const row of existing.rows) {
      await databases.deleteRow(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, row.$id);
    }

    return { success: true };
  }

  throw new Error('Unsupported method');
}

export async function clearChatForMeInternal(payload: {
  conversationId: string;
  encryptedSettings: string;
  jwt?: string;
  actorId?: string;
}) {
  let verifiedActorId = payload.actorId;
  if (!verifiedActorId) {
    const { account } = await createServerClient(payload.jwt);
    const user = await account.get().catch(() => null);
    if (!user) throw new Error('Unauthorized');
    verifiedActorId = user.$id;
  }
  const { databases } = createSystemClient();
  const conversation = await databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.conversationId);
  const participantIds = await resolveConversationParticipants(databases as any, conversation);
  if (!participantIds.includes(verifiedActorId)) throw new Error('Forbidden: Not a participant');
  // Transactional single-row update — ensures settings flip is atomic with any concurrent deletes
  try {
    await withSystemTransaction(async (txId) => {
      const tables: any = createSystemTablesDB();
      await tables.updateRow({ databaseId: CHAT_DB_ID, tableId: CONVERSATIONS_TABLE_ID, rowId: payload.conversationId, data: { settings: payload.encryptedSettings }, transactionId: txId });
    }, { ttl: 30 });
  } catch {
    await databases.updateRow({
      databaseId: CHAT_DB_ID,
      tableId: CONVERSATIONS_TABLE_ID,
      rowId: payload.conversationId,
      data: { settings: payload.encryptedSettings },
    });
  }
  return { success: true };
}

export async function updateConversationInternal(payload: {
  conversationId: string;
  data: Record<string, unknown>;
  jwt?: string;
  actorId?: string;
}) {
  let verifiedActorId = payload.actorId;
  if (!verifiedActorId) {
    const { account } = await createServerClient(payload.jwt);
    const user = await account.get().catch(() => null);
    if (!user) throw new Error('Unauthorized');
    verifiedActorId = user.$id;
  }
  const { databases } = createSystemClient();
  const conversation = await databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.conversationId);
  const participantIds = await resolveConversationParticipants(databases as any, conversation);
  if (!participantIds.includes(verifiedActorId) && String(conversation?.creatorId) !== verifiedActorId) {
    throw new Error('Forbidden: Not a participant');
  }
  // Object-based syntax — never Position args, never Permission.update/delete
  const res = await databases.updateRow({
    databaseId: CHAT_DB_ID,
    tableId: CONVERSATIONS_TABLE_ID,
    rowId: payload.conversationId,
    data: payload.data as any,
  });
  return JSON.parse(JSON.stringify(res));
}

/**
 * Transactional conversation creation — stages conversation + members + key_mappings (+ epoch for groups) atomically.
 * Uses withSystemTransaction (system TablesDB transaction). If any stage fails or commit conflicts, entire transaction rolls back.
 * Server SDK only, invoked via Server Action with explicit JWT (Actor ID/JWT fail-safe pattern).
 */
export async function createConversationTransactionalInternal(payload: {
  actorId?: string;
  jwt?: string;
  participants: string[];
  type: 'direct' | 'group';
  name?: string | null;
  isEncrypted: boolean;
  encryptionVersion: string;
  lockboxRows?: Array<{ resourceType: string; resourceId?: string; grantee: string; wrappedKey: string; metadata?: string }>;
  isWorkspace?: boolean;
  contextType?: string;
  contextId?: string;
  isPublic?: boolean;
}) {
  let verifiedActorId = payload.actorId;
  if (!verifiedActorId) {
    const { account } = await createServerClient(payload.jwt);
    const user = await account.get().catch(() => null);
    if (!user) throw new Error('Unauthorized');
    verifiedActorId = user.$id;
  }
  const uniqueParticipants = Array.from(new Set((payload.participants || []).map((v) => String(v || '').trim()).filter(Boolean)));
  if (!uniqueParticipants.includes(verifiedActorId!)) uniqueParticipants.unshift(verifiedActorId!);

  if (payload.contextType === 'workspace' && payload.contextId) {
    const existingWorkspace = await findWorkspaceConversationInternal(payload.contextId);
    if (existingWorkspace) return existingWorkspace;
  }

  const now = new Date().toISOString();
  const convId = ID.unique();
  const convData: Record<string, unknown> = {
    participants: uniqueParticipants,
    participantCount: uniqueParticipants.length,
    type: payload.type || 'direct',
    name: payload.name || 'Direct Chat',
    creatorId: verifiedActorId,
    admins: payload.type === 'group' ? [verifiedActorId] : uniqueParticipants,
    isPinned: [],
    isMuted: [],
    isArchived: [],
    tags: [],
    isEncrypted: payload.isEncrypted,
    encryptionVersion: payload.encryptionVersion,
    createdAt: now,
    updatedAt: now,
    isWorkspace: !!payload.isWorkspace,
    contextType: payload.contextType || null,
    contextId: payload.contextId || null,
    isPublic: !!payload.isPublic,
  };
  const convPerms = [
    Permission.read(Role.user(verifiedActorId!)),
    ...uniqueParticipants.filter((id) => id !== verifiedActorId).map((id) => Permission.read(Role.user(id))),
  ];
  if (payload.isPublic) {
    convPerms.push(Permission.read(Role.any()));
  }
  // Normalize lockbox rows to target convId
  const lockbox = (payload.lockboxRows || []).map((r) => ({ ...r, resourceId: convId, resourceType: r.resourceType || 'chat' }));

  // Pre-assign epoch row ID so key_mapping rows can reference it within the same transaction
  const epochRowId = ID.unique();

  let result: any;
  try {
    result = await withSystemTransaction(async (txId) => {
    const tables: any = createSystemTablesDB();
    // Stage conversation
    await tables.createRow({ databaseId: CHAT_DB_ID, tableId: CONVERSATIONS_TABLE_ID, rowId: convId, data: convData, permissions: convPerms, transactionId: txId });
    // Stage members
    for (const pid of uniqueParticipants) {
      const memberPerms = [Permission.read(Role.user(verifiedActorId!)), ...uniqueParticipants.filter((id) => id !== verifiedActorId).map((id) => Permission.read(Role.user(id)))];
      await tables.createRow({ databaseId: CHAT_DB_ID, tableId: CONVERSATION_MEMBERS_TABLE_ID, rowId: ID.unique(), data: { conversationId: convId, userId: pid, role: pid === verifiedActorId ? 'owner' : 'member' }, permissions: memberPerms, transactionId: txId });
    }
    // Stage key_mappings (direct & group lockbox — resourceType: 'chat')
    for (const row of lockbox) {
      const perms = [Permission.read(Role.user(row.grantee))];
      await tables.createRow({ databaseId: CHAT_DB_ID, tableId: KEY_MAPPING_TABLE_ID, rowId: ID.unique(), data: { resourceId: row.resourceId, resourceType: row.resourceType, grantee: row.grantee, wrappedKey: row.wrappedKey, metadata: row.metadata || null }, permissions: perms, transactionId: txId });
    }
    // Stage initial epoch for group conversations — epochs table requires { resourceId, epochNumber, createdBy }
    if (payload.type === 'group') {
      const epochPerms = [Permission.read(Role.user(verifiedActorId!)), ...uniqueParticipants.filter((id) => id !== verifiedActorId).map((id) => Permission.read(Role.user(id)))];
      await tables.createRow({ databaseId: CHAT_DB_ID, tableId: EPOCHS_TABLE_ID, rowId: epochRowId, data: { resourceId: convId, epochNumber: 1, createdBy: verifiedActorId }, permissions: epochPerms, transactionId: txId });
      // For encrypted groups, stage per-participant key_mapping rows pointing at the epoch row (resourceType: 'epoch')
      // so fetchEpochKeyForConversation can unwrap the conversation key per user
      for (const row of lockbox) {
        const perms = [Permission.read(Role.user(row.grantee))];
        await tables.createRow({ databaseId: CHAT_DB_ID, tableId: KEY_MAPPING_TABLE_ID, rowId: ID.unique(), data: { resourceId: epochRowId, resourceType: 'epoch', grantee: row.grantee, wrappedKey: row.wrappedKey, metadata: row.metadata || null }, permissions: perms, transactionId: txId });
      }
    }
    return { $id: convId, ...convData } as any;
  }, { ttl: 60 });
  } catch (error) {
    if (payload.contextType === 'workspace' && payload.contextId && isUniqueConstraintError(error)) {
      const existingWorkspace = await findWorkspaceConversationInternal(payload.contextId);
      if (existingWorkspace) return existingWorkspace;
    }
    throw error;
  }

  // Fetch back via system to return canonical row
  const { databases } = createSystemClient();
  const fresh = await databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, convId).catch(() => result);
  return JSON.parse(JSON.stringify(fresh));
}
