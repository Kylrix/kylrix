import { MCP_ID_INPUT, mcpItemsOutput } from './common';

export interface ThreadRecord {
  id: string;
  scopeKey: string;
  parentKind: string;
  parentId: string;
  channel: string;
  ownerId: string;
  title: string | null;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageUserId: string | null;
  isEncrypted: boolean;
  isPublic: boolean;
  legacyNoteId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function shapeThread(row: Record<string, unknown>): ThreadRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    scopeKey: r.scopeKey,
    parentKind: r.parentKind,
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

export interface ThreadMessageRecord {
  id: string;
  threadId: string;
  userId: string;
  parentMessageId: string | null;
  rootMessageId: string | null;
  content: string;
  contentType: string;
  isEncrypted: boolean;
  isVoice: boolean;
  isDeleted: boolean;
  replyCount: number;
  metadata: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  legacy?: boolean;
}

export function shapeThreadMessage(row: Record<string, unknown>): ThreadMessageRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
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

export function shapeLegacyThreadComment(
  row: Record<string, unknown>,
  threadId: string,
): ThreadMessageRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
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
  };
}

const THREAD_MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
    userId: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

export const MCP_THREAD_LIST_INPUT = {
  type: 'object',
  properties: {
    parent_kind: {
      type: 'string',
      description: 'Parent object type: workspace, note, goal, …',
    },
    parent_id: { type: 'string', description: 'Parent object ID' },
    limit: { type: 'number', description: 'Max threads to return (default: 25)' },
  },
} as const;
export const MCP_THREAD_LIST_OUTPUT = mcpItemsOutput({
  type: 'object',
  properties: {
    id: { type: 'string' },
    parentKind: { type: 'string' },
    parentId: { type: 'string' },
    title: { type: 'string' },
  },
});
export const MCP_THREAD_ENSURE_INPUT = {
  type: 'object',
  properties: {
    parent_kind: { type: 'string', description: 'Parent object type' },
    parent_id: { type: 'string', description: 'Parent object ID' },
    channel: { type: 'string', description: 'Thread channel (default: discuss)' },
    title: { type: 'string', description: 'Optional thread title' },
  },
  required: ['parent_kind', 'parent_id'],
} as const;
export const THREAD_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    parentKind: { type: 'string' },
    parentId: { type: 'string' },
  },
} as const;

export const MCP_THREAD_MESSAGES_LIST_INPUT = {
  type: 'object',
  properties: {
    threadId: { type: 'string', description: 'Thread ID' },
    limit: { type: 'number', description: 'Max messages to return (default: 50)' },
  },
  required: ['threadId'],
} as const;
export const MCP_THREAD_MESSAGES_LIST_OUTPUT = mcpItemsOutput(THREAD_MESSAGE_SCHEMA);
export const MCP_THREAD_MESSAGE_CREATE_INPUT = {
  type: 'object',
  properties: {
    threadId: { type: 'string', description: 'Thread ID' },
    content: { type: 'string', description: 'Message content' },
  },
  required: ['threadId', 'content'],
} as const;
export const THREAD_MESSAGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
  },
} as const;
