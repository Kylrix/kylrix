'use server';

import {
  createMessageInternal,
  clearConversationFootprintInternal,
  deleteConversationFullyInternal,
  nuclearWipeConversationInternal,
  toggleReactionInternal,
  repairConversationInternal,
  joinRequestInternal,
  clearChatForMeInternal,
  updateConversationInternal,
  createConversationTransactionalInternal
} from '@/lib/services/internal/chat';
import { Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemTablesDB } from '@/lib/appwrite-admin';

import { 
  ChatMessageSchema, 
  ReactionSchema, 
  JoinRequestSchema,
  IDSchema,
  JWTSchema
} from '@/lib/validations/schemas';

export async function createMessageAction(payload: any) {
  // Rigorous runtime validation
  const validated = ChatMessageSchema.parse(payload);
  const validatedJwt = JWTSchema.parse(payload.jwt ?? undefined);

  // Retrieve the authenticated actor securely on the server
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  // Force senderId to match the authenticated actor's ID to prevent any spoofing
  const securedPayload = {
    ...validated,
    senderId: actor.$id,
    actorId: actor.$id};

  return await createMessageInternal(securedPayload);
}

export async function toggleReactionAction(payload: any) {
  // Rigorous runtime validation
  const validated = ReactionSchema.parse(payload);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await toggleReactionInternal({
    ...validated,
    actorId: actor.$id});
}

export async function repairConversationAction(payload: {
  userId?: string;
  conversationId?: string;
  jwt?: string;
}) {
  // Rigorous runtime validation
  const validatedJwt = JWTSchema.parse(payload.jwt);
  const validatedUserId = IDSchema.optional().parse(payload.userId);
  const validatedConversationId = IDSchema.optional().parse(payload.conversationId);

  // Retrieve actor to ensure they can only repair their own profiles unless they are admin
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  const isAdmin = actor.isAdmin;
  const targetUserId = validatedUserId && isAdmin ? validatedUserId : actor.$id;

  const securedPayload = {
    userId: targetUserId,
    conversationId: validatedConversationId,
    actorId: actor.$id,
    actorLabels: isAdmin ? ['admin'] : []};

  return await repairConversationInternal(securedPayload);
}

export async function clearConversationFootprintAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  // Rigorous runtime validation
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await clearConversationFootprintInternal({
    conversationId: validatedConversationId,
    actorId: actor.$id});
}

export async function nuclearWipeConversationAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  // Rigorous runtime validation
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await nuclearWipeConversationInternal({
    conversationId: validatedConversationId,
    actorId: actor.$id});
}

export async function deleteConversationFullyAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  // Rigorous runtime validation
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await deleteConversationFullyInternal({
    conversationId: validatedConversationId,
    actorId: actor.$id});
}

export async function clearChatForMeAction(payload: { conversationId: string; encryptedSettings: string; jwt?: string; }) {
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  if (typeof payload.encryptedSettings !== 'string') throw new Error('Invalid settings');
  const validatedJwt = JWTSchema.parse(payload.jwt);
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return await clearChatForMeInternal({ conversationId: validatedConversationId, encryptedSettings: payload.encryptedSettings, actorId: actor.$id });
}

export async function updateConversationAction(payload: { conversationId: string; data: Record<string, unknown>; jwt?: string; }) {
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  const validatedJwt = JWTSchema.parse(payload.jwt);
  if (!payload.data || typeof payload.data !== 'object') throw new Error('Invalid data');
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return await updateConversationInternal({ conversationId: validatedConversationId, data: payload.data, actorId: actor.$id });
}

export async function joinRequestAction(payload: any) {
  // Rigorous runtime validation
  const validated = JoinRequestSchema.parse(payload);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  // Retrieve the authenticated actor securely on the server
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);

  const securedPayload = {
    ...validated,
    actorId: actor?.$id};

  if (validated.method === 'POST') {
    if (!actor?.$id) {
      throw new Error('Unauthorized');
    }
    // Force the requesterId to match the authenticated actor's ID
    securedPayload.requesterId = actor.$id;
  }

  return await joinRequestInternal(securedPayload);
}

export async function getConversationsAction(payload: {
  userId: string;
  jwt?: string;
}) {
  // Rigorous runtime validation
  const validatedUserId = IDSchema.parse(payload.userId);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  
  if (!actor?.$id || actor.$id !== validatedUserId) {
    // Never return an empty success — callers treat empty as "no chats" and may create duplicates.
    console.warn('[getConversationsAction] Actor mismatch or not found.');
    throw new Error('UNAUTHORIZED_CONVERSATIONS_LIST');
  }

  const combinedMap = new Map<string, any>();

  // 1. Fetch from Turso SQLite
  try {
    const { listConversationsTurso } = await import('./turso-ops');
    const tursoRes = await listConversationsTurso(validatedUserId);
    if (tursoRes.success && tursoRes.rows) {
      for (const row of tursoRes.rows) {
        let parts = [];
        try {
          parts = typeof row.participants === 'string' ? JSON.parse(row.participants) : (row.participants || []);
        } catch {
          parts = [];
        }
        let admins = [];
        try {
          admins = typeof row.admins === 'string' ? JSON.parse(row.admins) : (row.admins || []);
        } catch {
          admins = [];
        }
        combinedMap.set(row.id, {
          $id: row.id,
          id: row.id,
          creatorId: row.creatorId,
          type: row.type || 'direct',
          name: row.name,
          lastMessageId: row.lastMessageId,
          lastMessageAt: row.lastMessageAt,
          lastMessageText: row.lastMessageText,
          lastMessageSenderId: row.lastMessageSenderId,
          unreadCount: row.unreadCount || '0',
          participants: parts,
          admins,
          description: row.description,
          avatarUrl: row.avatarUrl,
          avatarFileId: row.avatarFileId,
          avatar: row.avatar,
          participantCount: row.participantCount || parts.length || 1,
          maxParticipants: row.maxParticipants || 100,
          isEncrypted: Boolean(row.isEncrypted),
          encryptionVersion: row.encryptionVersion,
          encryptionKey: row.encryptionKey,
          isPinned: row.isPinned || '',
          isMuted: row.isMuted || '',
          isArchived: row.isArchived || '',
          settings: row.settings,
          isPublic: Boolean(row.isPublic),
          inviteLink: row.inviteLink,
          category: row.category,
          tags: row.tags || '',
          contextType: row.contextType,
          contextId: row.contextId,
          isWorkspace: Boolean(row.isWorkspace),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }
    }
  } catch (tursoErr) {
    console.warn('[getConversationsAction] Turso query warning:', tursoErr);
  }

  // 2. Fetch from Appwrite (best-effort merge & mirror to Turso)
  try {
    const tables = createSystemTablesDB();
    const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
    const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
    const CONV_MEMBERS_TABLE = 'conversationMembers';

    let memberRows: any = { rows: [] };
    try {
      memberRows = await tables.listRows({
        databaseId: DB_ID,
        tableId: CONV_MEMBERS_TABLE,
        queries: [Query.equal('userId', validatedUserId), Query.limit(1000)],
      });
    } catch {}

    const conversationIds = Array.from(
      new Set((memberRows.rows || []).map((row: any) => row.conversationId).filter(Boolean))
    );

    let standardConversations: any[] = [];
    if (conversationIds.length > 0) {
      try {
        const standardRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: CONV_TABLE,
          queries: [Query.equal('$id', conversationIds), Query.limit(Math.min(100, conversationIds.length))],
        });
        standardConversations = standardRes.rows || [];
      } catch {}
    }

    let legacyConversations: any[] = [];
    try {
      const legacyRes = await tables.listRows({
        databaseId: DB_ID,
        tableId: CONV_TABLE,
        queries: [Query.contains('participants', validatedUserId), Query.limit(100)],
      });
      legacyConversations = legacyRes.rows || [];
    } catch {}

    const { upsertConversationTurso, upsertConversationMemberTurso } = await import('./turso-ops');
    for (const conv of [...standardConversations, ...legacyConversations]) {
      if (conv && conv.$id) {
        if (!combinedMap.has(conv.$id)) {
          combinedMap.set(conv.$id, conv);
          // Mirror legacy Appwrite conversation to Turso SQLite
          void upsertConversationTurso({
            id: conv.$id,
            creatorId: conv.creatorId || validatedUserId,
            type: conv.type || 'direct',
            name: conv.name,
            lastMessageId: conv.lastMessageId,
            lastMessageAt: conv.lastMessageAt,
            lastMessageText: conv.lastMessageText,
            lastMessageSenderId: conv.lastMessageSenderId,
            participants: JSON.stringify(conv.participants || []),
            participantCount: Array.isArray(conv.participants) ? conv.participants.length : 1,
            admins: JSON.stringify(conv.admins || []),
            isEncrypted: Boolean(conv.isEncrypted),
            encryptionVersion: conv.encryptionVersion,
            isWorkspace: Boolean(conv.isWorkspace),
            contextType: conv.contextType,
            contextId: conv.contextId,
            isPublic: Boolean(conv.isPublic),
            createdAt: conv.createdAt || conv.$createdAt,
            updatedAt: conv.updatedAt || conv.$updatedAt,
          });
          const parts = Array.isArray(conv.participants) ? conv.participants : [];
          for (const pid of parts) {
            void upsertConversationMemberTurso({
              id: `cm-${conv.$id}-${pid}`,
              conversationId: conv.$id,
              userId: pid,
              role: pid === conv.creatorId ? 'owner' : 'member',
            });
          }
        }
      }
    }
  } catch (appwriteErr: any) {
    console.warn('[getConversationsAction] Appwrite query warning:', appwriteErr?.message);
  }

  // 3. Sort by active timestamp descending
  const uniqueConversations = Array.from(combinedMap.values());
  uniqueConversations.sort((a: any, b: any) => {
    const timeA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return JSON.parse(
    JSON.stringify({
      total: uniqueConversations.length,
      rows: uniqueConversations,
    })
  );
}

export async function getMessagesAction(payload: {
  conversationId: string;
  limit?: number;
  jwt?: string;
}) {
  const validatedConversationId = IDSchema.parse(payload.conversationId);
  const validatedJwt = JWTSchema.parse(payload.jwt ?? undefined);
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  // 1. Fetch from Turso SQLite
  const { listMessagesTurso, upsertMessageTurso } = await import('./turso-ops');
  const tursoRes = await listMessagesTurso(validatedConversationId, payload.limit || 50);
  const rows = (tursoRes.rows || []).map((m: any) => {
    let attachments = [];
    try {
      attachments = typeof m.attachments === 'string' ? JSON.parse(m.attachments) : (m.attachments || []);
    } catch {
      attachments = [];
    }
    let readBy = [];
    try {
      readBy = typeof m.readBy === 'string' ? JSON.parse(m.readBy) : (m.readBy || []);
    } catch {
      readBy = [];
    }
    return {
      $id: m.id,
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      attachments,
      replyTo: m.replyTo,
      readBy,
      isPinned: Boolean(m.isPinned),
      isVoice: Boolean(m.isVoice),
      metadata: m.metadata,
      isBookmark: Boolean(m.isBookmark),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });

  if (rows.length > 0) {
    return { total: rows.length, rows };
  }

  // 2. Fallback to Appwrite if available
  try {
    const tables = createSystemTablesDB();
    const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
    const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
    const res = await tables.listRows({
      databaseId: DB_ID,
      tableId: MSG_TABLE,
      queries: [
        Query.equal('conversationId', validatedConversationId),
        Query.orderDesc('createdAt'),
        Query.limit(payload.limit || 50),
      ],
    });
    // Mirror to Turso SQLite
    if (res.rows?.length) {
      for (const msg of res.rows) {
        void upsertMessageTurso({
          id: msg.$id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          type: msg.type || 'text',
          content: msg.content || '',
          attachments: JSON.stringify(msg.attachments || []),
          replyTo: msg.replyTo,
          readBy: JSON.stringify(msg.readBy || []),
          isPinned: Boolean(msg.isPinned),
          isVoice: Boolean(msg.isVoice),
          metadata: msg.metadata,
          isBookmark: Boolean(msg.isBookmark),
          createdAt: msg.createdAt || msg.$createdAt,
          updatedAt: msg.updatedAt || msg.$updatedAt,
        });
      }
    }
    return { total: res.rows?.length || 0, rows: res.rows || [] };
  } catch {
    return { total: 0, rows: [] };
  }
}

export async function createConversationTransactionalAction(payload: {
  participants: string[];
  type?: 'direct' | 'group';
  name?: string | null;
  isEncrypted?: boolean;
  encryptionVersion?: string;
  lockboxRows?: Array<{ resourceType: string; grantee: string; wrappedKey: string; metadata?: string }>;
  jwt?: string;
  isWorkspace?: boolean;
  contextType?: string;
  contextId?: string;
  isPublic?: boolean;
}) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return await createConversationTransactionalInternal({
    actorId: actor.$id,
    jwt: payload.jwt,
    participants: payload.participants,
    type: payload.type || 'direct',
    name: payload.name,
    isEncrypted: !!payload.isEncrypted,
    encryptionVersion: payload.encryptionVersion || (payload.isEncrypted ? 'T4' : '1.0'),
    lockboxRows: payload.lockboxRows,
    isWorkspace: payload.isWorkspace,
    contextType: payload.contextType,
    contextId: payload.contextId,
    isPublic: payload.isPublic,
  });
}
