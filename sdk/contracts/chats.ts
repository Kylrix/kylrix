import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';

export function shapeChatListItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    type: r.type || null,
    name: r.name || null,
    participantCount: r.participantCount ?? (Array.isArray(r.participants) ? r.participants.length : null),
    lastMessageAt: r.lastMessageAt || null,
    isEncrypted: !!r.isEncrypted,
  };
}

export function shapeChatDetail(row: Record<string, unknown>) {
  const r = row as any;
  const parts = Array.isArray(r.participants) ? r.participants : [];
  return {
    id: String(r.$id || r.id),
    type: r.type || null,
    name: r.name || null,
    participants: parts,
    lastMessageAt: r.lastMessageAt || null,
    isEncrypted: !!r.isEncrypted,
  };
}

export function shapeChatMessage(row: Record<string, unknown>, chatIsEncrypted = false) {
  const r = row as any;
  const encrypted = r.isEncrypted !== false && chatIsEncrypted;
  const plaintext = r.content || r.body || null;
  return {
    id: String(r.$id || r.id),
    conversationId: r.conversationId || null,
    senderId: r.senderId || null,
    createdAt: r.$createdAt || r.createdAt || null,
    isEncrypted: encrypted,
    hasCiphertext: !!(r.content || r.ciphertext || r.body),
    content: encrypted ? null : plaintext,
    contentPreview: encrypted ? null : plaintext,
  };
}

const CHAT_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    participants: { type: 'array', items: { type: 'string' } },
  },
} as const;

const CHAT_MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string' },
    content: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

export const CHAT_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    participants: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const CHAT_MESSAGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    conversationId: { type: 'string' },
    content: { type: 'string' },
  },
} as const;

export const MCP_CHAT_LIST_INPUT = MCP_LIMIT_INPUT;
export const MCP_CHAT_LIST_OUTPUT = mcpItemsOutput(CHAT_LIST_ITEM_SCHEMA);
export const MCP_CHAT_GET_INPUT = MCP_ID_INPUT('Conversation ID');
export const MCP_CHAT_MESSAGES_LIST_INPUT = {
  type: 'object',
  properties: {
    conversationId: { type: 'string', description: 'Conversation ID' },
    limit: { type: 'number', description: 'Max messages to retrieve (default: 50)' },
  },
  required: ['conversationId'],
} as const;
export const MCP_CHAT_MESSAGES_LIST_OUTPUT = mcpItemsOutput(CHAT_MESSAGE_SCHEMA);
export const MCP_CHAT_SEND_INPUT = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'Message text content' },
    conversationId: { type: 'string', description: 'Existing conversation ID' },
    participantId: { type: 'string', description: 'Recipient user ID or agent ID if starting a new direct chat' },
  },
  required: ['content'],
} as const;
