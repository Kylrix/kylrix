import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  getConversationsAction,
  createMessageAction,
} from '@/lib/actions/chat';

export const ChatService = {
  async getConversationKey(_convOrId: any, _userId: string) {
    return null;
  },

  async getConversationById(conversationId: string, _userId?: string) {
    try {
      const rows = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          ...r,
          $id: r.id,
          participants: r.participants ? JSON.parse(r.participants) : [],
        };
      }
    } catch {}

    return null;
  },

  async getConversations(userId: string) {
    try {
      const res = await getConversationsAction({ userId });
      return {
        total: (res.rows || []).length,
        rows: res.rows || [],
        authoritative: true,
      };
    } catch {
      return { total: 0, rows: [], authoritative: false };
    }
  },

  async createConversation(participants: string[], type: 'direct' | 'group' = 'direct', name?: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.conversations).values({
      id,
      creatorId: participants[0] || 'user',
      type,
      name: name || 'Chat',
      participants: JSON.stringify(participants),
      createdAt: now,
      updatedAt: now,
    });

    return {
      $id: id,
      id,
      creatorId: participants[0] || 'user',
      type,
      name: name || 'Chat',
      participants,
      createdAt: now,
      updatedAt: now,
    };
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'call_signal' | 'system' | 'attachment' = 'text',
    attachments: string[] = [],
    replyTo?: string
  ) {
    return await createMessageAction({
      conversationId,
      senderId,
      content,
      type,
      attachments,
      replyTo,
    });
  },

  async getMessages(conversationId: string, limit = 50) {
    try {
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit);

      const items = rows.map((r) => ({
        ...r,
        $id: r.id,
      }));

      return {
        total: items.length,
        rows: items,
      };
    } catch {
      return { total: 0, rows: [] };
    }
  },

  async deleteMessage(messageId: string) {
    await db.delete(schema.messages).where(eq(schema.messages.id, messageId));
    return { success: true };
  },

  async updateConversation(conversationId: string, data: any) {
    const now = new Date().toISOString();
    await db
      .update(schema.conversations)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.conversations.id, conversationId));

    return { $id: conversationId, id: conversationId, ...data };
  },

  async deleteConversationFully(conversationId: string) {
    await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId));
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    return { success: true, conversationId };
  },
};
