import { MCP_ID_INPUT, MCP_WORKSPACE_LIMIT_INPUT, mcpItemsOutput } from './common';

export function shapeFormListItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled',
    description: r.description || null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    isPublic: !!r.isPublic,
  };
}

export function shapeFormDetail(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || 'Untitled',
    description: r.description || null,
    schema: r.schema || null,
    status: r.status || null,
    isPublic: !!r.isPublic,
    fields: Array.isArray(r.schema)
      ? r.schema
      : typeof r.schema === 'string'
        ? (() => {
            try {
              return JSON.parse(r.schema);
            } catch {
              return [];
            }
          })()
        : [],
  };
}

const FORM_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
  },
} as const;

export const FORM_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    fields: { type: 'array', items: { type: 'object' } },
  },
} as const;

export const MCP_FORM_LIST_INPUT = MCP_WORKSPACE_LIMIT_INPUT;
export const MCP_FORM_LIST_OUTPUT = mcpItemsOutput(FORM_LIST_ITEM_SCHEMA);
export const MCP_FORM_GET_INPUT = MCP_ID_INPUT('ID of the form');
export const MCP_FORM_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the form' },
    description: { type: 'string', description: 'Form description' },
    schema: { type: 'object', description: 'JSON schema defining form questions and input fields' },
    workspaceId: { type: 'string', description: 'Optional workspace ID' },
  },
  required: ['title'],
} as const;
export const MCP_FORM_DELETE_INPUT = MCP_ID_INPUT('ID of the form to delete');
