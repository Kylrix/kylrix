import { MCP_ID_INPUT, MCP_WORKSPACE_LIMIT_INPUT, mcpItemsOutput } from './common';

export interface FormRecord {
  id: string;
  userId?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  fieldCount?: number;
  schema?: any;
  settings?: any;
  fields?: any[];
  ghostFields?: any[];
  isPublic?: boolean;
  isGuest?: boolean;
  isMultiple?: boolean;
  isWorkspace?: boolean;
  projectId?: string | null;
  workspaceId?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface FormCreateInput {
  title: string;
  description?: string;
  schema?: any;
  settings?: any;
  workspaceId?: string;
  projectId?: string;
  isPublic?: boolean;
  isGuest?: boolean;
}

export function shapeFormListItem(row: Record<string, unknown>) {
  const r = row as any;
  let fieldCount = 0;
  if (Array.isArray(r.schema)) {
    fieldCount = r.schema.length;
  } else if (typeof r.schema === 'string') {
    try {
      const parsed = JSON.parse(r.schema);
      if (Array.isArray(parsed)) fieldCount = parsed.length;
    } catch {}
  }

  return {
    id: String(r.$id || r.id),
    userId: r.userId || null,
    title: r.title || r.name || 'Untitled',
    description: r.description || null,
    status: r.status || null,
    fieldCount,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    isPublic: r.isPublic !== undefined ? !!r.isPublic : true,
    isGuest: r.isGuest !== undefined ? !!r.isGuest : true,
    isMultiple: Boolean(r.isMultiple),
    isWorkspace: Boolean(r.isWorkspace),
    projectId: r.projectId || null,
  };
}

export function shapeFormDetail(row: Record<string, unknown>) {
  const r = row as any;
  let parsedSettings: any = null;
  try {
    parsedSettings = typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings;
  } catch {}

  const ghostFields = Array.isArray(parsedSettings?.ghostFields) ? parsedSettings.ghostFields : [];

  return {
    id: String(r.$id || r.id),
    userId: r.userId || null,
    title: r.title || 'Untitled',
    description: r.description || null,
    schema: r.schema || null,
    settings: r.settings || null,
    status: r.status || null,
    isPublic: r.isPublic !== undefined ? !!r.isPublic : true,
    isGuest: r.isGuest !== undefined ? !!r.isGuest : true,
    isMultiple: Boolean(r.isMultiple),
    isWorkspace: Boolean(r.isWorkspace),
    projectId: r.projectId || null,
    ghostFields,
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
