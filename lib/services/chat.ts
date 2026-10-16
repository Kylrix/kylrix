import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  getConversationsAction,
  createMessageAction,
} from '@/lib/actions/chat';

export function rememberConversationRoster(_conversations: any[]) {}

export const ChatService = {
  isSelfChatConversation(conv: any, userId: string): boolean {
    if (!conv || !userId) return false;
    const parts = Array.isArray(conv.participants) ? conv.participants : [];
    return parts.length === 1 && parts[0] === userId;
  },

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

  async createConversation(participants: string[], type: 'direct' | 'group' = 'direct', name?: string, _opts?: any) {
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
    replyTo?: string,
    _arg7?: any,
    _arg8?: any,
    _metadata?: any
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

  async updateMessage(messageId: string, data: any) {
    await db
      .update(schema.messages)
      .set(data)
      .where(eq(schema.messages.id, messageId));
    return { $id: messageId, id: messageId, ...data };
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
    await db.delete(schema.messages).where(eq(schema.messages.id, conversationId));
    return { success: true, conversationId };
  },

  async _decryptConversation(conv: any, _userId: string) {
    return conv;
  },

  async getOrCreateWorkspaceConversation(workspaceId: string, workspaceTitle?: string, userId?: string) {
    const name = workspaceTitle ? `Workspace: ${workspaceTitle}` : `Workspace Chat`;
    const existing = await this.getConversationById(workspaceId);
    if (existing) return existing;
    return await this.createConversation([userId || 'user'], 'group', name);
  },

  async decryptMessageRows(rows: any[], _userId: string) {
    return rows;
  },

  async clearChatForMe(conversationId: string, _userId: string) {
    return { success: true, conversationId };
  },

  async wipeMyFootprint(conversationId: string, _userId: string) {
    return { success: true, conversationId };
  },

  async nuclearWipe(conversationId: string) {
    return { success: true, conversationId };
  },

  async reactToMessage(messageId: string, emoji: string, userId: string) {
    return { success: true, messageId, emoji, userId };
  },
};
