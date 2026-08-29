import { MCP_ID_INPUT, mcpItemsOutput } from './common';

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
