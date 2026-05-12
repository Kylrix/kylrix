'use server';

import {
  createMessageInternal,
  toggleReactionInternal,
  repairConversationInternal,
  joinRequestInternal
} from '@/lib/chat-server';

export async function createMessageAction(payload: {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: string[];
  replyTo?: string;
}) {
  return await createMessageInternal(payload);
}

export async function toggleReactionAction(payload: {
  conversationId: string;
  messageId: string;
  emoji: string;
  action: 'POST' | 'DELETE';
}) {
  return await toggleReactionInternal(payload);
}

export async function repairConversationAction(payload: {
  userId?: string;
  conversationId?: string;
}) {
  return await repairConversationInternal(payload);
}

export async function joinRequestAction(payload: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  resourceType: string,
  resourceId: string,
  requesterId?: string,
  action?: 'accept' | 'reject',
}) {
  return await joinRequestInternal(payload);
}
