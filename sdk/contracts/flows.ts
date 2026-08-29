import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';
import { z } from 'zod';

export const flowCreateInputZod = z.object({
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  steps: z.array(z.record(z.string(), z.unknown())).optional(),
  category: z.string().optional(),
  niche: z.string().optional(),
  id: z.string().optional(),
});

export function resolveFlowCreateFields(body: Record<string, unknown>) {
  const name = String(body.name || body.title || '').trim();
  if (!name) {
    throw new Error('name required');
  }
  return {
    id: body.id != null ? String(body.id) : `flow_${Date.now()}`,
    name,
    description: String(body.description || ''),
    niche: String(body.category || body.niche || 'workspace'),
    steps: Array.isArray(body.steps) ? body.steps : [],
  };
}

export function shapeFlowInstallListItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    flowId: r.flowId || r.workflowId || null,
    scopeKey: r.scopeKey || null,
    createdAt: r.$createdAt || r.createdAt || null,
  };
}

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
    title: { type: 'string', description: 'Title of the flow (alias: name)' },
    name: { type: 'string', description: 'Name of the flow (alias: title)' },
    description: { type: 'string', description: 'Flow description' },
    steps: { type: 'array', items: { type: 'object' }, description: 'Sequential executable steps' },
    category: { type: 'string', description: 'Category (productivity, agent, data, etc.)' },
  },
} as const;
export const MCP_FLOW_DELETE_INPUT = MCP_ID_INPUT('ID of the flow to delete');
