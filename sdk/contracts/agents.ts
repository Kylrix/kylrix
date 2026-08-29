import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';

const AGENT_SESSION_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    harness: { type: 'string', nullable: true },
    status: { type: 'string', nullable: true },
  },
} as const;

export const AGENT_SESSION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', nullable: true },
    events: { type: 'array', items: { type: 'object' } },
  },
} as const;

export const MCP_AGENT_SESSION_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
    harness: { type: 'string', description: 'Optional harness type filter' },
    limit: { type: 'number', description: 'Max sessions to return (default: 25)' },
  },
} as const;
export const MCP_AGENT_SESSION_LIST_OUTPUT = mcpItemsOutput(AGENT_SESSION_LIST_ITEM_SCHEMA);
export const MCP_AGENT_SESSION_GET_INPUT = MCP_ID_INPUT('Agent session ID');
export const MCP_AGENT_SESSION_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Session goal or title' },
    prompt: { type: 'string', description: 'Initial instructions for the agent' },
    harness: { type: 'string', description: 'Target harness runner' },
    workspaceId: { type: 'string', description: 'Optional workspace ID' },
  },
  required: ['title'],
} as const;
