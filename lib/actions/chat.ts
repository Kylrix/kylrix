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

export async function createMessageAction(payload: {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: string[];
  replyTo?: string;
  jwt?: string;
}) {
  // Retrieve the authenticated actor securely on the server
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  // Force senderId to match the authenticated actor's ID to prevent any spoofing
  const securedPayload = {
    ...payload,
    senderId: actor.$id,
    actorId: actor.$id,
  };

  return await createMessageInternal(securedPayload);
}

export async function toggleReactionAction(payload: {
  conversationId: string;
  messageId: string;
  emoji: string;
  action: 'POST' | 'DELETE';
  jwt?: string;
}) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await toggleReactionInternal({
    ...payload,
    actorId: actor.$id,
  });
}

export async function repairConversationAction(payload: {
  userId?: string;
  conversationId?: string;
  jwt?: string;
}) {
  // Retrieve actor to ensure they can only repair their own profiles unless they are admin
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  const isAdmin = actor.isAdmin;
  const targetUserId = payload.userId && isAdmin ? payload.userId : actor.$id;

  const securedPayload = {
    ...payload,
    userId: targetUserId,
    actorId: actor.$id,
    actorLabels: isAdmin ? ['admin'] : [],
  };

  return await repairConversationInternal(securedPayload);
}

export async function clearConversationFootprintAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await clearConversationFootprintInternal({
    ...payload,
    actorId: actor.$id,
  });
}

export async function nuclearWipeConversationAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await nuclearWipeConversationInternal({
    ...payload,
    actorId: actor.$id,
  });
}

export async function deleteConversationFullyAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return await deleteConversationFullyInternal({
    ...payload,
    actorId: actor.$id,
  });
}

export async function joinRequestAction(payload: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  resourceType: string,
  resourceId: string,
  requesterId?: string,
  action?: 'accept' | 'reject',
  jwt?: string;
}) {
  // Retrieve the authenticated actor securely on the server
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);

  const securedPayload = {
    ...payload,
    actorId: actor?.$id,
  };

  if (payload.method === 'POST') {
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
  const { getActor } = await import('./secure-ops');
  const actor = await getActor(payload.jwt);
  
  if (!actor?.$id || actor.$id !== payload.userId) {
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
      queries: [Query.equal('userId', payload.userId), Query.limit(1000)]
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
        Query.contains('participants', payload.userId),
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
