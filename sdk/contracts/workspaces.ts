/**
 * Canonical Workspace contract — REST, MCP, and agent tools.
 */
import { z } from 'zod';

export const WORKSPACE_VISIBILITIES = ['private', 'public', 'team'] as const;
export type WorkspaceVisibility = (typeof WORKSPACE_VISIBILITIES)[number];

export const WORKSPACE_COLLABORATOR_ROLES = ['read', 'write', 'admin', 'editor', 'viewer'] as const;

export const workspaceCreateInputZod = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  visibility: z.enum(WORKSPACE_VISIBILITIES).optional(),
  isAgentic: z.boolean().optional(),
});

export const workspaceUpdateInputZod = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  visibility: z.enum(WORKSPACE_VISIBILITIES).optional(),
});

export const workspaceListQueryZod = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

export const workspaceCollaboratorInputZod = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['editor', 'viewer', 'admin']).optional(),
  permission: z.enum(['read', 'write', 'admin']).optional(),
});

export const linkToProjectInputZod = z.object({
  objectType: z.enum(['note', 'goal']),
  objectId: z.string().min(1),
  projectId: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const switchWorkspaceInputZod = z.object({
  workspaceId: z.string().min(1),
  workspaceTitle: z.string().optional(),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateInputZod>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateInputZod>;

export interface WorkspaceRecord {
  id: string;
  title: string;
  summary: string | null;
  visibility: string | null;
  isAgentic: boolean;
  isShared?: boolean;
  role?: string;
  updatedAt: string | null;
  createdAt: string | null;
}

export function shapeWorkspace(
  row: Record<string, unknown>,
  extras?: Pick<WorkspaceRecord, 'isShared' | 'role'>,
): WorkspaceRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled',
    summary: r.summary ?? r.description ?? null,
    visibility: r.visibility ?? null,
    isAgentic: Boolean(r.isAgentic),
    ...(extras?.isShared !== undefined ? { isShared: extras.isShared } : {}),
    ...(extras?.role ? { role: extras.role } : {}),
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
  };
}

export const WORKSPACE_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string', nullable: true },
    visibility: { type: 'string', nullable: true },
    isAgentic: { type: 'boolean' },
    isShared: { type: 'boolean' },
    role: { type: 'string' },
    updatedAt: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
  },
} as const;

export const MCP_WORKSPACE_LIST_INPUT = {
  type: 'object',
  properties: {
    limit: { type: 'number', description: 'Maximum number of workspaces to return (default: 25, max: 100)' },
  },
} as const;

export const MCP_WORKSPACE_GET_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique workspace ID' },
  },
  required: ['id'],
} as const;

export const MCP_WORKSPACE_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title or name of the workspace' },
    summary: { type: 'string', description: 'Optional description or summary of workspace objectives' },
    visibility: { type: 'string', enum: [...WORKSPACE_VISIBILITIES], description: 'Workspace visibility level' },
    isAgentic: { type: 'boolean', description: 'Set to true for autonomous agentic workspaces' },
  },
  required: ['title'],
} as const;

export const MCP_WORKSPACE_UPDATE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the workspace to modify' },
    title: { type: 'string', description: 'New workspace title' },
    summary: { type: 'string', description: 'Updated workspace description' },
    visibility: { type: 'string', enum: [...WORKSPACE_VISIBILITIES], description: 'Updated visibility' },
  },
  required: ['id'],
} as const;

export const MCP_WORKSPACE_DELETE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the workspace to delete' },
  },
  required: ['id'],
} as const;

export const MCP_WORKSPACE_LIST_OUTPUT = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: WORKSPACE_RECORD_JSON_SCHEMA,
    },
  },
} as const;

export const MCP_WORKSPACE_COLLABORATORS_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Target workspace ID' },
  },
  required: ['workspaceId'],
} as const;

export const MCP_WORKSPACE_COLLABORATORS_LIST_OUTPUT = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          role: { type: 'string' },
        },
      },
    },
  },
} as const;

export const MCP_WORKSPACE_COLLABORATOR_ADD_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Target workspace ID' },
    userId: { type: 'string', description: 'User ID or agent account ID to add' },
    role: { type: 'string', enum: ['editor', 'viewer', 'admin'], description: 'Assigned collaborator role' },
  },
  required: ['workspaceId', 'userId'],
} as const;
