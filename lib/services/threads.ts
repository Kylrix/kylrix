/**
 * ThreadService — canonical discussion substrate.
 *
 * Uniqueness: unique index on scopeKey = parentKind:parentId:channel
 * Messages: thread_messages (parentMessageId + rootMessageId for nested branches)
 * Reactions: thread_reactions
 *
 * Legacy ghost-note threads (isThread notes + comments) remain readable via
 * legacyNoteId when a thread was linked; new writes go here only.
 */

import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { tablesDB as clientTablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  buildThreadScopeKey,
  isThreadParentKind,
  THREAD_CHANNEL_DISCUSS,
  THREAD_CHANNEL_GENERAL,
  type ThreadParentKind,
} from '@/lib/threads/types';

const DB = APPWRITE_CONFIG.DATABASES.NOTE;
const THREADS = APPWRITE_CONFIG.TABLES.NOTE.THREADS || 'threads';
const MESSAGES = APPWRITE_CONFIG.TABLES.NOTE.THREAD_MESSAGES || 'thread_messages';
const REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.THREAD_REACTIONS || 'thread_reactions';
const NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES || APPWRITE_CONFIG.TABLES.NOTES;
const COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS || 'comments';
const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS || 'tasks';

function previewOf(content: string, max = 200): string {
  const t = String(content || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function ownerPerms(userId: string, extraReadUserIds: string[] = []) {
  const perms = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
  for (const id of extraReadUserIds) {
    if (id && id !== userId) perms.push(Permission.read(Role.user(id)));
  }
  return perms;
}

function shapeThread(r: any) {
  return {
    id: r.$id,
    scopeKey: r.scopeKey,
    parentKind: r.parentKind as ThreadParentKind,
    parentId: r.parentId,
    channel: r.channel,
    ownerId: r.ownerId,
    title: r.title || null,
    status: (r.status as string) || 'active',
    messageCount: Number(r.messageCount || 0),
    lastMessageAt: r.lastMessageAt || null,
    lastMessagePreview: r.lastMessagePreview || null,
    lastMessageUserId: r.lastMessageUserId || null,
    isEncrypted: !!r.isEncrypted,
    isPublic: !!r.isPublic,
    legacyNoteId: r.legacyNoteId || null,
    createdAt: r.$createdAt || r.createdAt || null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
  };
}

function shapeMessage(r: any) {
  return {
    id: r.$id,
    threadId: r.threadId,
    userId: r.userId,
    parentMessageId: r.parentMessageId || null,
    rootMessageId: r.rootMessageId || null,
    content: r.content || '',
    contentType: r.contentType || 'text',
    isEncrypted: !!r.isEncrypted,
    isVoice: !!r.isVoice,
    isDeleted: !!r.isDeleted,
    replyCount: Number(r.replyCount || 0),
    metadata: r.metadata || null,
    createdAt: r.$createdAt || r.createdAt || null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
  };
}

async function stampPrimaryThreadId(
  tables: ReturnType<typeof createSystemTablesDB>,
  parentKind: string,
  parentId: string,
  threadId: string,
) {
  try {
    if (parentKind === 'note') {
      const note = (await tables.getRow({ databaseId: DB, tableId: NOTES, rowId: parentId }).catch(() => null)) as any;
      if (note && !note.primaryThreadId) {
        await tables.updateRow({
          databaseId: DB,
          tableId: NOTES,
          rowId: parentId,
          data: { primaryThreadId: threadId },
        });
      }
      return;
    }
    if (parentKind === 'goal') {
      const goal = (await tables.getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: parentId }).catch(() => null)) as any;
      if (goal && !goal.primaryThreadId) {
        await tables.updateRow({
          databaseId: FLOW_DB,
          tableId: TASKS,
          rowId: parentId,
          data: { primaryThreadId: threadId },
        });
      }
      return;
    }
    if (parentKind === 'workspace') {
      const project = (await tables.getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: parentId }).catch(() => null)) as any;
      if (project && !project.primaryThreadId) {
        await tables.updateRow({
          databaseId: FLOW_DB,
          tableId: 'projects',
          rowId: parentId,
          data: { primaryThreadId: threadId },
        });
      }
    }
  } catch (e) {
    console.warn('[ThreadService] stampPrimaryThreadId failed', e);
  }
}

export const ThreadService = {
  buildScopeKey: buildThreadScopeKey,
  CHANNEL_GENERAL: THREAD_CHANNEL_GENERAL,
  CHANNEL_DISCUSS: THREAD_CHANNEL_DISCUSS,

  async findByScopeKey(scopeKey: string) {
    try {
      if (typeof window === 'undefined') {
        const tables = createSystemTablesDB();
        const res = await tables.listRows({
          databaseId: DB,
          tableId: THREADS,
          queries: [Query.equal('scopeKey', scopeKey), Query.limit(1)],
        });
        if (res.rows[0]) return shapeThread(res.rows[0]);
      }
    } catch {
      /* fall through to client */
    }
    try {
      const res = await (clientTablesDB as any).listRows(DB, THREADS, [
        Query.equal('scopeKey', scopeKey),
        Query.limit(1),
      ]);
      return res.rows[0] ? shapeThread(res.rows[0]) : null;
    } catch {
      return null;
    }
  },

  async getById(threadId: string) {
    // Client-safe: try system (server) first, fall back to client tablesDB when APPWRITE_API missing
    try {
      if (typeof window === 'undefined') {
        const tables = createSystemTablesDB();
        const row = (await tables
          .getRow({ databaseId: DB, tableId: THREADS, rowId: threadId })
          .catch(() => null)) as any;
        if (row) return shapeThread(row);
      }
    } catch {
      /* system client unavailable on client — fall through to client tablesDB */
    }
    try {
      const row = (await (clientTablesDB as any)
        .getRow(DB, THREADS, threadId)
        .catch(() => null)) as any;
      return row ? shapeThread(row) : null;
    } catch {
      return null;
    }
  },

  /**
   * Idempotent: unique(scopeKey) is the SoT. Races re-fetch after create conflict.
   */
  async getOrCreate(params: {
    parentKind: ThreadParentKind | string;
    parentId: string;
    channel?: string;
    ownerId: string;
    title?: string;
    isPublic?: boolean;
    legacyNoteId?: string | null;
    participantIds?: string[];
  }) {
    const parentKind = String(params.parentKind || '').trim().toLowerCase();
    if (!isThreadParentKind(parentKind)) {
      const err = new Error(`Invalid parentKind: ${parentKind}`);
      (err as any).status = 400;
      throw err;
    }
    const parentId = String(params.parentId || '').trim();
    const channel = String(params.channel || THREAD_CHANNEL_GENERAL).trim().toLowerCase() || THREAD_CHANNEL_GENERAL;
    const scopeKey = buildThreadScopeKey(parentKind, parentId, channel);

    const existing = await this.findByScopeKey(scopeKey);
    if (existing) {
      await stampPrimaryThreadId(createSystemTablesDB(), parentKind, parentId, existing.id);
      return { thread: existing, created: false };
    }

    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const title =
      params.title?.trim() ||
      `${parentKind} ${channel === THREAD_CHANNEL_DISCUSS ? 'discussion' : 'thread'}`;

    try {
      const row = await tables.createRow({
        databaseId: DB,
        tableId: THREADS,
        rowId: ID.unique(),
        data: {
          scopeKey,
          parentKind,
          parentId,
          channel,
          ownerId: params.ownerId,
          title: title.slice(0, 255),
          status: 'active',
          messageCount: 0,
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageUserId: null,
          isEncrypted: false,
          isPublic: !!params.isPublic,
          isGuest: !!params.isPublic,
          legacyNoteId: params.legacyNoteId || null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
        permissions: ownerPerms(params.ownerId, params.participantIds),
      });
      const thread = shapeThread(row);
      await stampPrimaryThreadId(tables, parentKind, parentId, thread.id);
      return { thread, created: true };
    } catch (e: any) {
      // Unique race — another writer won
      const again = await this.findByScopeKey(scopeKey);
      if (again) return { thread: again, created: false };
      throw e;
    }
  },

  async listForOwner(ownerId: string, limit = 50) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: THREADS,
      queries: [
        Query.equal('ownerId', ownerId),
        Query.orderDesc('updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map(shapeThread);
  },

  async listForParent(parentKind: string, parentId: string, limit = 25) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: THREADS,
      queries: [
        Query.equal('parentKind', String(parentKind).toLowerCase()),
        Query.equal('parentId', parentId),
        Query.orderDesc('lastMessageAt'),
        Query.limit(Math.min(50, Math.max(1, limit))),
      ],
    });
    return res.rows.map(shapeThread);
  },

  async listMessages(
    threadId: string,
    opts?: {
      limit?: number;
      /** Top-level only (channel feed) */
      topLevelOnly?: boolean;
      /** Load one nested branch */
      rootMessageId?: string | null;
      parentMessageId?: string | null;
      includeLegacyComments?: boolean;
    },
  ) {
    const tables = createSystemTablesDB();
    const lim = Math.min(200, Math.max(1, opts?.limit ?? 50));
    const queries: any[] = [
      Query.equal('threadId', threadId),
      Query.equal('isDeleted', false),
      Query.orderAsc('createdAt'),
      Query.limit(lim),
    ];

    if (opts?.rootMessageId) {
      queries.splice(1, 0, Query.equal('rootMessageId', opts.rootMessageId));
    } else if (opts?.parentMessageId) {
      queries.splice(1, 0, Query.equal('parentMessageId', opts.parentMessageId));
    } else if (opts?.topLevelOnly) {
      // Appwrite: empty string for “no parent” — we store null/omit; use equal '' when set
      queries.splice(1, 0, Query.isNull('parentMessageId'));
    }

    let res = await tables.listRows({
      databaseId: DB,
      tableId: MESSAGES,
      queries,
    }).catch(async () => {
      // Fallback if isNull unsupported / no null index hits: fetch and filter
      const all = await tables.listRows({
        databaseId: DB,
        tableId: MESSAGES,
        queries: [
          Query.equal('threadId', threadId),
          Query.orderAsc('createdAt'),
          Query.limit(lim),
        ],
      });
      return all;
    });

    let rows = res.rows || [];
    if (opts?.topLevelOnly) {
      rows = rows.filter((r: any) => !r.parentMessageId);
    }
    if (opts?.rootMessageId) {
      rows = rows.filter(
        (r: any) => r.rootMessageId === opts.rootMessageId || r.$id === opts.rootMessageId,
      );
    }

    const messages = rows.map(shapeMessage);

    if (
      messages.length === 0 &&
      opts?.includeLegacyComments !== false
    ) {
      const thread = await this.getById(threadId);
      if (thread?.legacyNoteId) {
        const legacy = await tables
          .listRows({
            databaseId: DB,
            tableId: COMMENTS,
            queries: [
              Query.equal('noteId', thread.legacyNoteId),
              Query.orderAsc('createdAt'),
              Query.limit(lim),
            ],
          })
          .catch(() => ({ rows: [] as any[] }));
        return (legacy.rows || []).map((r: any) => ({
          id: r.$id,
          threadId,
          userId: r.userId,
          parentMessageId: r.parentCommentId || null,
          rootMessageId: null,
          content: r.content || '',
          contentType: 'legacy_comment',
          isEncrypted: !!r.isEncrypted,
          isVoice: !!r.isVoice,
          isDeleted: false,
          replyCount: 0,
          metadata: r.metadata || null,
          createdAt: r.$createdAt || r.createdAt || null,
          updatedAt: null,
          legacy: true,
        }));
      }
    }

    return messages;
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
    if (!content) {
      const err = new Error('content required');
      (err as any).status = 400;
      throw err;
    }

    const tables = createSystemTablesDB();
    const threadRow = (await tables
      .getRow({ databaseId: DB, tableId: THREADS, rowId: params.threadId })
      .catch(() => null)) as any;
    if (!threadRow) {
      const err = new Error('Thread not found');
      (err as any).status = 404;
      throw err;
    }

    let parentMessageId = params.parentMessageId || null;
    let rootMessageId: string | null = null;

    if (parentMessageId) {
      const parent = (await tables
        .getRow({ databaseId: DB, tableId: MESSAGES, rowId: parentMessageId })
        .catch(() => null)) as any;
      if (!parent || parent.threadId !== params.threadId) {
        const err = new Error('parentMessageId not in this thread');
        (err as any).status = 400;
        throw err;
      }
      rootMessageId = parent.rootMessageId || parent.$id;
    }

    const now = new Date().toISOString();
    const row = await tables.createRow({
      databaseId: DB,
      tableId: MESSAGES,
      rowId: ID.unique(),
      data: {
        threadId: params.threadId,
        userId: params.userId,
        parentMessageId,
        rootMessageId,
        content,
        contentType: params.contentType || 'text',
        isEncrypted: !!params.isEncrypted,
        isVoice: !!params.isVoice,
        isPublic: !!threadRow.isPublic,
        isGuest: !!threadRow.isGuest,
        isDeleted: false,
        replyCount: 0,
        metadata: params.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      },
      permissions: ownerPerms(params.userId, params.participantIds),
    });

    if (parentMessageId) {
      try {
        const parent = (await tables.getRow({
          databaseId: DB,
          tableId: MESSAGES,
          rowId: parentMessageId,
        })) as any;
        await tables.updateRow({
          databaseId: DB,
          tableId: MESSAGES,
          rowId: parentMessageId,
          data: { replyCount: Number(parent.replyCount || 0) + 1, updatedAt: now },
        });
      } catch {
        /* best-effort */
      }
    }

    await tables.updateRow({
      databaseId: DB,
      tableId: THREADS,
      rowId: params.threadId,
      data: {
        messageCount: Number(threadRow.messageCount || 0) + 1,
        lastMessageAt: now,
        lastMessagePreview: previewOf(content),
        lastMessageUserId: params.userId,
        updatedAt: now,
      },
    });

    return shapeMessage(row);
  },

  async addReaction(params: {
    messageId: string;
    threadId: string;
    userId: string;
    emoji: string;
  }) {
    const emoji = String(params.emoji || '').trim().slice(0, 32);
    if (!emoji) {
      const err = new Error('emoji required');
      (err as any).status = 400;
      throw err;
    }
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: DB,
      tableId: REACTIONS,
      queries: [
        Query.equal('messageId', params.messageId),
        Query.equal('userId', params.userId),
        Query.equal('emoji', emoji),
        Query.limit(1),
      ],
    });
    if (existing.rows[0]) {
      return {
        id: existing.rows[0].$id,
        messageId: params.messageId,
        threadId: params.threadId,
        userId: params.userId,
        emoji,
        created: false,
      };
    }
    const now = new Date().toISOString();
    const row = await tables.createRow({
      databaseId: DB,
      tableId: REACTIONS,
      rowId: ID.unique(),
      data: {
        messageId: params.messageId,
        threadId: params.threadId,
        userId: params.userId,
        emoji,
        createdAt: now,
      },
      permissions: ownerPerms(params.userId),
    });
    return {
      id: (row as any).$id,
      messageId: params.messageId,
      threadId: params.threadId,
      userId: params.userId,
      emoji,
      created: true,
    };
  },

  async removeReaction(params: { messageId: string; userId: string; emoji: string }) {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: DB,
      tableId: REACTIONS,
      queries: [
        Query.equal('messageId', params.messageId),
        Query.equal('userId', params.userId),
        Query.equal('emoji', String(params.emoji).trim()),
        Query.limit(1),
      ],
    });
    if (!existing.rows[0]) return { removed: false };
    await tables.deleteRow({
      databaseId: DB,
      tableId: REACTIONS,
      rowId: existing.rows[0].$id,
    });
    return { removed: true };
  },

  async listReactions(messageId: string) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: REACTIONS,
      queries: [Query.equal('messageId', messageId), Query.limit(200)],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      messageId: r.messageId,
      threadId: r.threadId,
      userId: r.userId,
      emoji: r.emoji,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  /**
   * Link a legacy ghost-note discussion into the new table without duplicating
   * if scope already exists.
   */
  async adoptLegacyNote(params: {
    parentKind: ThreadParentKind | string;
    parentId: string;
    channel?: string;
    ownerId: string;
    legacyNoteId: string;
    title?: string;
  }) {
    const { thread, created } = await this.getOrCreate({
      ...params,
      legacyNoteId: params.legacyNoteId,
    });
    if (!created && !thread.legacyNoteId) {
      const tables = createSystemTablesDB();
      await tables.updateRow({
        databaseId: DB,
        tableId: THREADS,
        rowId: thread.id,
        data: { legacyNoteId: params.legacyNoteId, updatedAt: new Date().toISOString() },
      });
      return { ...(await this.getById(thread.id))!, created: false };
    }
    return { ...thread, created };
  },
};
