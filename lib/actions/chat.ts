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
import { createServerClient } from '@/lib/appwrite-server-only';

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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  const isAdmin = Array.isArray(actor.labels) && actor.labels.includes('admin');
  const targetUserId = payload.userId && isAdmin ? payload.userId : actor.$id;

  const securedPayload = {
    ...payload,
    userId: targetUserId,
    actorId: actor.$id,
    actorLabels: actor.labels || [],
  };

  return await repairConversationInternal(securedPayload);
}

export async function clearConversationFootprintAction(payload: {
  conversationId: string;
  jwt?: string;
}) {
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get();
  
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
  const { account } = await createServerClient(payload.jwt);
  const actor = await account.get().catch(() => null);

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
