import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function findWorkspaceConversationInternal(workspaceId: string) {
  if (!workspaceId) return null;
  try {
    const rows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.contextId, workspaceId))
      .limit(1);

    if (rows.length > 0) return { ...rows[0], $id: rows[0].id };
  } catch {}
  return null;
}

export async function createMessageInternal(payload: {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: string[];
  replyTo?: string;
  isBookmark?: boolean;
  jwt?: string;
  actorId?: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.messages).values({
    id,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    type: payload.type || 'text',
    content: payload.content,
    attachments: payload.attachments ? JSON.stringify(payload.attachments) : null,
    replyTo: payload.replyTo || null,
    isBookmark: Boolean(payload.isBookmark),
    createdAt: now,
    updatedAt: now,
  });

  return { $id: id, id, ...payload, createdAt: now, updatedAt: now };
}

export async function clearConversationFootprintInternal(payload: {
  conversationId: string;
  jwt?: string;
  actorId?: string;
}) {
  await db.delete(schema.messages).where(eq(schema.messages.conversationId, payload.conversationId));
  return { success: true, messagesDeleted: 1, reactionsDeleted: 0 };
}

export async function deleteConversationFullyInternal(payload: {
  conversationId: string;
  jwt?: string;
  actorId?: string;
}) {
  await db.delete(schema.conversations).where(eq(schema.conversations.id, payload.conversationId));
  await db.delete(schema.messages).where(eq(schema.messages.conversationId, payload.conversationId));
  return { success: true, conversationId: payload.conversationId };
}

export async function nuclearWipeConversationInternal(payload: {
  conversationId: string;
  jwt?: string;
  actorId?: string;
}) {
  return deleteConversationFullyInternal(payload);
}

export async function toggleReactionInternal(_payload: {
  conversationId: string;
  messageId: string;
  emoji: string;
  action: 'POST' | 'DELETE';
  jwt?: string;
  actorId?: string;
}) {
  return { success: true };
}

export async function repairConversationInternal(_payload: any) {
  return { success: true };
}

export async function joinRequestInternal(_payload: any) {
  return { success: true };
}

export async function clearChatForMeInternal(_payload: any) {
  return { success: true };
}

export async function updateConversationInternal(payload: {
  conversationId: string;
  data: Record<string, unknown>;
  jwt?: string;
  actorId?: string;
}) {
  const now = new Date().toISOString();
  await db
    .update(schema.conversations)
    .set({ ...payload.data, updatedAt: now })
    .where(eq(schema.conversations.id, payload.conversationId));

  return { $id: payload.conversationId, id: payload.conversationId, ...payload.data };
}

export async function createConversationTransactionalInternal(payload: {
  actorId?: string;
  jwt?: string;
  participants: string[];
  type: 'direct' | 'group';
  name?: string | null;
  isEncrypted: boolean;
  encryptionVersion: string;
  lockboxRows?: Array<any>;
  isWorkspace?: boolean;
  contextType?: string;
  contextId?: string;
  isPublic?: boolean;
}) {
  const id = payload.contextId ? `ws-${payload.contextId}` : crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.conversations).values({
    id,
    creatorId: payload.actorId || 'user',
    type: payload.type || 'direct',
    name: payload.name || 'Chat',
    participants: JSON.stringify(payload.participants),
    isWorkspace: Boolean(payload.isWorkspace),
    contextType: payload.contextType || null,
    contextId: payload.contextId || null,
    isPublic: Boolean(payload.isPublic),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  return { $id: id, id, ...payload, createdAt: now, updatedAt: now };
}
