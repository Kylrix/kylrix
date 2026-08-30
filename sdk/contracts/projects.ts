/**
 * Canonical sub-project contract — nested projects under a workspace.
 */
import { z } from 'zod';
import { WORKSPACE_VISIBILITIES } from './workspaces';

export const workspaceProjectCreateInputZod = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  visibility: z.enum(WORKSPACE_VISIBILITIES).optional(),
});

export const workspaceProjectUpdateInputZod = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  visibility: z.enum(WORKSPACE_VISIBILITIES).optional(),
});

export type WorkspaceProjectCreateInput = z.infer<typeof workspaceProjectCreateInputZod>;

export interface WorkspaceProjectRecord {
  id: string;
  title: string;
  summary: string | null;
  visibility: string | null;
  kind: 'project';
  parentWorkspaceId: string;
  status: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export function shapeWorkspaceProject(
  row: Record<string, unknown>,
  parentWorkspaceId: string,
): WorkspaceProjectRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled Project',
    summary: r.summary ?? r.description ?? null,
    visibility: r.visibility ?? null,
    kind: 'project',
    parentWorkspaceId,
    status: r.status ?? null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
  };
}

export const WORKSPACE_PROJECT_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string', nullable: true },
    visibility: { type: 'string', nullable: true },
    kind: { type: 'string', enum: ['project'] },
    parentWorkspaceId: { type: 'string' },
    status: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
  },
} as const;

export const MCP_WORKSPACE_PROJECT_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Parent workspace ID' },
    limit: { type: 'number', description: 'Maximum projects to return (default 25, max 100)' },
  },
  required: ['workspaceId'],
} as const;

export const MCP_WORKSPACE_PROJECT_GET_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Parent workspace ID' },
    projectId: { type: 'string', description: 'Sub-project ID' },
  },
  required: ['workspaceId', 'projectId'],
} as const;

export const MCP_WORKSPACE_PROJECT_CREATE_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Parent workspace ID' },
    title: { type: 'string', description: 'Project title' },
    summary: { type: 'string', description: 'Optional project summary' },
    visibility: { type: 'string', enum: [...WORKSPACE_VISIBILITIES], description: 'Project visibility' },
  },
  required: ['workspaceId', 'title'],
} as const;

export const MCP_WORKSPACE_PROJECT_UPDATE_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Parent workspace ID' },
    projectId: { type: 'string', description: 'Sub-project ID' },
    title: { type: 'string', description: 'Updated title' },
    summary: { type: 'string', description: 'Updated summary' },
    visibility: { type: 'string', enum: [...WORKSPACE_VISIBILITIES], description: 'Updated visibility' },
  },
  required: ['workspaceId', 'projectId'],
} as const;

export const MCP_WORKSPACE_PROJECT_DELETE_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Parent workspace ID' },
    projectId: { type: 'string', description: 'Sub-project ID' },
  },
  required: ['workspaceId', 'projectId'],
} as const;

export const MCP_WORKSPACE_PROJECT_LIST_OUTPUT = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: WORKSPACE_PROJECT_RECORD_JSON_SCHEMA,
    },
  },
} as const;
