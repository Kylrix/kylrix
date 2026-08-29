import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';

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
