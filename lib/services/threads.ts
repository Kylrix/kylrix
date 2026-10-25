import { ulid } from '@/lib/utils/ulid';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  buildThreadScopeKey,
  THREAD_CHANNEL_DISCUSS,
  THREAD_CHANNEL_GENERAL,
  type ThreadParentKind,
} from '@/lib/threads/types';

export type ThreadRecord = {
  id: string;
  title: string;
  creatorId: string;
  ownerId: string;
  targetKind: string;
  targetId: string;
  isLocked: boolean;
  isPublic: boolean;
  legacyNoteId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ThreadService = {
  buildScopeKey: buildThreadScopeKey,
  CHANNEL_GENERAL: THREAD_CHANNEL_GENERAL,
  CHANNEL_DISCUSS: THREAD_CHANNEL_DISCUSS,

  async findByScopeKey(scopeKey: string): Promise<ThreadRecord | null> {
    try {
      const rows = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.targetId, scopeKey))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          title: r.title || 'Thread',
          creatorId: r.creatorId,
          ownerId: r.creatorId,
          targetKind: r.targetKind,
          targetId: r.targetId,
          isLocked: Boolean(r.isLocked),
          isPublic: true,
          legacyNoteId: null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
    } catch {}
    return null;
  },

  async getById(threadId: string): Promise<ThreadRecord | null> {
    try {
      const rows = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.id, threadId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          title: r.title || 'Thread',
          creatorId: r.creatorId,
          ownerId: r.creatorId,
          targetKind: r.targetKind,
          targetId: r.targetId,
          isLocked: Boolean(r.isLocked),
          isPublic: true,
          legacyNoteId: null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
    } catch {}
    return null;
  },

  async getOrCreate(params: {
    parentKind: ThreadParentKind | string;
    parentId: string;
    channel?: string;
    ownerId: string;
    title?: string;
    isPublic?: boolean;
    legacyNoteId?: string | null;
    participantIds?: string[];
  }): Promise<{ thread: ThreadRecord; created: boolean }> {
    const parentKind = String(params.parentKind || '').trim().toLowerCase();
    const parentId = String(params.parentId || '').trim();
    const channel = String(params.channel || THREAD_CHANNEL_GENERAL).trim().toLowerCase() || THREAD_CHANNEL_GENERAL;
    const scopeKey = buildThreadScopeKey(parentKind, parentId, channel);

    const existing = await this.findByScopeKey(scopeKey);
    if (existing) {
      return { thread: existing, created: false };
    }

    const now = new Date().toISOString();
    const id = ulid();
    const title = params.title?.trim() || `${parentKind} ${channel === THREAD_CHANNEL_DISCUSS ? 'discussion' : 'thread'}`;

    await db.insert(schema.threads).values({
      id,
      creatorId: params.ownerId,
      targetKind: parentKind,
      targetId: scopeKey,
      title: title.slice(0, 255),
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const thread: ThreadRecord = {
      id,
      title,
      creatorId: params.ownerId,
      ownerId: params.ownerId,
      targetKind: parentKind,
      targetId: scopeKey,
      isLocked: false,
      isPublic: Boolean(params.isPublic ?? true),
      legacyNoteId: params.legacyNoteId || null,
      createdAt: now,
      updatedAt: now,
    };

    return { thread, created: true };
  },

  async adoptLegacyNote(_params: any) {
    return { success: true };
  },

  async listForOwner(ownerId: string, limit = 50): Promise<ThreadRecord[]> {
    try {
      const rows = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.creatorId, ownerId))
        .orderBy(desc(schema.threads.updatedAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        title: r.title || 'Thread',
        creatorId: r.creatorId,
        ownerId: r.creatorId,
        targetKind: r.targetKind,
        targetId: r.targetId,
        isLocked: Boolean(r.isLocked),
        isPublic: true,
        legacyNoteId: null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      return [];
    }
  },

  async listForParent(parentKind: string, parentId: string, limit = 25): Promise<ThreadRecord[]> {
    try {
      const rows = await db
        .select()
        .from(schema.threads)
        .where(and(eq(schema.threads.targetKind, parentKind), eq(schema.threads.targetId, parentId)))
        .orderBy(desc(schema.threads.updatedAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        title: r.title || 'Thread',
        creatorId: r.creatorId,
        ownerId: r.creatorId,
        targetKind: r.targetKind,
        targetId: r.targetId,
        isLocked: Boolean(r.isLocked),
        isPublic: true,
        legacyNoteId: null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      return [];
    }
  },

  async listMessages(
    threadId: string,
    opts?: {
      limit?: number;
      topLevelOnly?: boolean;
      rootMessageId?: string | null;
      parentMessageId?: string | null;
      includeLegacyComments?: boolean;
    }
  ) {
    try {
      const rows = await db
        .select()
        .from(schema.threadMessages)
        .where(eq(schema.threadMessages.threadId, threadId))
        .limit(opts?.limit || 50);

      return rows.map((r) => ({
        id: r.id,
        threadId: r.threadId,
        senderId: r.senderId,
        content: r.content,
        metadata: r.metadata,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      return [];
    }
  },

  async postMessage(params: {
    threadId: string;
    userId: string;
    content: string;
    parentMessageId?: string | null;
    contentType?: string;
    isVoice?: boolean;
    isEncrypted?: boolean;
    metadata?: string | null;
    participantIds?: string[];
  }) {
    const content = String(params.content || '').trim();
    if (!content) throw new Error('content required');

    const id = ulid();
    const now = new Date().toISOString();

    await db.insert(schema.threadMessages).values({
      id,
      threadId: params.threadId,
      senderId: params.userId,
      content,
      metadata: params.metadata || null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      threadId: params.threadId,
      senderId: params.userId,
      content,
      metadata: params.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
  },

  async addReaction(params: { messageId: string; threadId: string; userId: string; emoji: string }) {
    const id = ulid();
    await db.insert(schema.reactions).values({
      id,
      resourceId: params.messageId,
      resourceType: 'thread_message',
      userId: params.userId,
      emoji: params.emoji,
      createdAt: new Date().toISOString(),
    });
    return { id, ...params, created: true };
  },

  async removeReaction(params: { messageId: string; userId: string; emoji: string }) {
    await db
      .delete(schema.reactions)
      .where(
        and(
          eq(schema.reactions.resourceId, params.messageId),
          eq(schema.reactions.userId, params.userId),
          eq(schema.reactions.emoji, params.emoji)
        )
      );
    return { removed: true };
  },

  async listReactions(messageId: string) {
    const rows = await db
      .select()
      .from(schema.reactions)
      .where(and(eq(schema.reactions.resourceId, messageId), eq(schema.reactions.resourceType, 'thread_message')));

    return rows.map((r) => ({
      id: r.id,
      messageId: r.resourceId,
      userId: r.userId,
      emoji: r.emoji,
      createdAt: r.createdAt,
    }));
  },

  async deleteThread(threadId: string) {
    await db.delete(schema.threads).where(eq(schema.threads.id, threadId));
    await db.delete(schema.threadMessages).where(eq(schema.threadMessages.threadId, threadId));
    return { success: true, threadId };
  },
};
