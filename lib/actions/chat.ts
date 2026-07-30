'use server';

import {
  createMessageInternal,
  clearConversationFootprintInternal,
  deleteConversationFullyInternal,
  nuclearWipeConversationInternal,
  toggleReactionInternal,
  repairConversationInternal,
  joinRequestInternal
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
  const validatedJwt = JWTSchema.parse(payload.jwt);

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
    console.warn('[getConversationsAction] Actor mismatch or not found. Returning empty list.');
    return { total: 0, rows: [] };
  }

  const tables = createSystemTablesDB();
  const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
  const CONV_MEMBERS_TABLE = 'conversationMembers';

  try {
    // 1. Fetch conversations from standard conversationMembers table
    const memberRows = await tables.listRows({
      databaseId: DB_ID,
      tableId: CONV_MEMBERS_TABLE,
      queries: [Query.equal('userId', validatedUserId), Query.limit(1000)]
    }).catch(() => ({ total: 0, rows: [] }));

    const conversationIds = Array.from(new Set(
      (memberRows.rows || [])
          .map((row: any) => row.conversationId)
          .filter(Boolean)
    ));

    let standardConversations: any[] = [];
    if (conversationIds.length > 0) {
      const standardRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: CONV_TABLE,
          queries: [Query.equal('$id', conversationIds), Query.limit(Math.min(100, conversationIds.length))]
      }).catch(() => ({ total: 0, rows: [] }));
      standardConversations = standardRes.rows || [];
    }

    // 2. Fetch legacy conversations directly where participants list contains user ID
    const legacyRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: CONV_TABLE,
      queries: [
        Query.equal('participants', validatedUserId),
        Query.limit(100)
      ]
    }).catch(() => ({ total: 0, rows: [] }));
    const legacyConversations = legacyRes.rows || [];

    // 3. Combine and deduplicate
    const combinedMap = new Map<string, any>();
    for (const conv of [...standardConversations, ...legacyConversations]) {
      if (conv && conv.$id) {
        combinedMap.set(conv.$id, conv);
      }
    }

    const uniqueConversations = Array.from(combinedMap.values());

    // 4. Sort by active timestamp descending
    uniqueConversations.sort((a: any, b: any) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return JSON.parse(JSON.stringify({
        total: uniqueConversations.length,
        rows: uniqueConversations
    }));
  } catch (error: any) {
    console.error('[getConversationsAction] Failed:', error?.message);
    throw error;
  }
}
