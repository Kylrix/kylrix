import { MCP_ID_INPUT, MCP_LIMIT_INPUT, MCP_SUCCESS_OUTPUT, mcpItemsOutput } from './common';

const TAG_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    color: { type: 'string', nullable: true },
  },
} as const;

export const TAG_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    color: { type: 'string', nullable: true },
  },
} as const;

export function shapeTag(row: Record<string, unknown>) {
  const r = row as any;
  let color = r.color || null;
  let description = '';
  if (r.metadata) {
    try {
      const parsed = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      if (parsed.color) color = parsed.color;
      if (parsed.description) description = parsed.description;
    } catch {}
  }
  return {
    id: String(r.$id || r.id),
    name: r.name || r.label || String(r.$id || r.id),
    color,
    description,
    usageCount: r.usageCount || 0,
  };
}

export const MCP_TAG_LIST_INPUT = MCP_LIMIT_INPUT;
export const MCP_TAG_LIST_OUTPUT = mcpItemsOutput(TAG_LIST_ITEM_SCHEMA);
export const MCP_TAG_CREATE_INPUT = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name of the tag' },
    color: { type: 'string', description: 'Hex color string (e.g. #6366F1)' },
  },
  required: ['name'],
} as const;
export const MCP_TAG_DELETE_INPUT = MCP_ID_INPUT('ID of the tag to delete');
