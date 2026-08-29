import { MCP_LIMIT_INPUT, MCP_SUCCESS_OUTPUT, mcpItemsOutput } from './common';

export const TRASH_KINDS = ['note', 'goal', 'form', 'event'] as const;

const TRASH_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: { type: 'string' },
    title: { type: 'string', nullable: true },
    deletedAt: { type: 'string', nullable: true },
  },
} as const;

export const MCP_TRASH_LIST_INPUT = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: [...TRASH_KINDS], description: 'Filter by entity kind' },
    limit: { type: 'number', description: 'Max items to return (default: 50)' },
  },
} as const;
export const MCP_TRASH_LIST_OUTPUT = mcpItemsOutput(TRASH_ITEM_SCHEMA);
export const MCP_TRASH_RESTORE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Trash item ID' },
    kind: { type: 'string', enum: [...TRASH_KINDS], description: 'Entity kind' },
  },
  required: ['id', 'kind'],
} as const;
export const MCP_TRASH_PURGE_INPUT = MCP_TRASH_RESTORE_INPUT;
