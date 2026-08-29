import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';

export function shapeFlowListItem(row: Record<string, unknown>) {
  const r = row as any;
  let steps = r.steps;
  if (typeof steps === 'string') {
    try {
      steps = JSON.parse(steps);
    } catch {
      steps = [];
    }
  }
  const name = r.name || r.title || 'Untitled';
  return {
    id: String(r.workflowId || r.$id || r.id),
    name,
    title: name,
    description: r.description || null,
    category: r.category || r.niche || null,
    isPublic: !!r.isPublic,
    steps: steps ?? [],
    installCount: r.installCount ?? 0,
    reviewStatus: r.reviewStatus || null,
    version: r.version ?? 0,
    contentHash: r.contentHash || null,
  };
}

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
