import { MCP_ID_INPUT, MCP_LIMIT_INPUT, MCP_SUCCESS_OUTPUT, mcpItemsOutput } from './common';

const FLOW_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    category: { type: 'string', nullable: true },
  },
} as const;

export const FLOW_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    steps: { type: 'array', items: { type: 'object' } },
  },
} as const;

export const MCP_FLOW_LIST_INPUT = MCP_LIMIT_INPUT;
export const MCP_FLOW_LIST_OUTPUT = mcpItemsOutput(FLOW_LIST_ITEM_SCHEMA);
export const MCP_FLOW_GET_INPUT = MCP_ID_INPUT('ID of the flow');
export const MCP_FLOW_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the flow' },
    description: { type: 'string', description: 'Flow description' },
    steps: { type: 'array', items: { type: 'object' }, description: 'Sequential executable steps' },
    category: { type: 'string', description: 'Category (productivity, agent, data, etc.)' },
  },
  required: ['title'],
} as const;
export const MCP_FLOW_DELETE_INPUT = MCP_ID_INPUT('ID of the flow to delete');
