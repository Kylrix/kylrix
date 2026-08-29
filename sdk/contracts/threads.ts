import { MCP_ID_INPUT, mcpItemsOutput } from './common';

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
