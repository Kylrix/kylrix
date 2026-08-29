/**
 * Canonical Goal contract — single source of truth for UI hydration, HTTP API,
 * MCP tools, and agent runtimes. Add or change a field here once; all surfaces follow.
 */
import { z } from 'zod';

export const GOAL_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const;
export const GOAL_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export const goalStatusZod = z.enum(GOAL_STATUSES);
export const goalPriorityZod = z.enum(GOAL_PRIORITIES);

/** Shared create/update input — used by REST bodies, MCP args, and AI SDK tools. */
export const goalCreateInputZod = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  summary: z.string().optional(),
  status: goalStatusZod.optional(),
  priority: goalPriorityZod.optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isAgentic: z.boolean().optional(),
});

export const goalUpdateInputZod = goalCreateInputZod
  .omit({ title: true })
  .extend({
    title: z.string().min(1).optional(),
  });

export const goalListQueryZod = z.object({
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  status: goalStatusZod.optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type GoalCreateInput = z.infer<typeof goalCreateInputZod>;
export type GoalUpdateInput = z.infer<typeof goalUpdateInputZod>;
export type GoalListQuery = z.infer<typeof goalListQueryZod>;

/** Wire/API/MCP payload shape returned to clients. */
export interface GoalRecord {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  isPublic: boolean;
  isGuest: boolean;
  isAgentic: boolean;
  updatedAt: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

export function shapeGoal(row: Record<string, unknown>): GoalRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled',
    description: r.description ?? null,
    status: r.status ?? 'todo',
    priority: r.priority ?? 'medium',
    dueDate: r.dueDate ?? null,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    isPinned: !!r.isPinned,
    isArchived: !!r.isArchived,
    isPublic: r.isPublic !== undefined ? Boolean(r.isPublic) : true,
    isGuest: r.isGuest !== undefined ? Boolean(r.isGuest) : true,
    isAgentic: !!r.isAgentic,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    completedAt: r.completedAt ?? null,
  };
}

export function buildGoalCreateRow(
  userId: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = goalCreateInputZod.parse(body);
  const title = parsed.title.trim().slice(0, 255);
  const isPublic = parsed.isPublic !== undefined ? parsed.isPublic : true;
  const isGuest =
    parsed.isGuest !== undefined ? parsed.isGuest : parsed.isPublic !== undefined ? parsed.isPublic : true;

  return {
    title,
    description: parsed.description ?? parsed.summary ?? '',
    status: parsed.status || 'todo',
    priority: parsed.priority || 'medium',
    dueDate: parsed.dueDate ?? null,
    tags: parsed.tags?.length ? parsed.tags : undefined,
    isPinned: parsed.isPinned ?? false,
    isAgentic: parsed.isAgentic ?? false,
    userId,
    isPublic,
    isGuest,
  };
}

export function buildGoalUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
  const parsed = goalUpdateInputZod.parse(body);
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (parsed.title !== undefined) patch.title = parsed.title.trim().slice(0, 255);
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.summary !== undefined && parsed.description === undefined) patch.description = parsed.summary;
  if (parsed.status !== undefined) {
    patch.status = parsed.status;
    if (parsed.status === 'done') patch.completedAt = new Date().toISOString();
    if (parsed.status !== 'done') patch.completedAt = null;
  }
  if (parsed.priority !== undefined) patch.priority = parsed.priority;
  if (parsed.dueDate !== undefined) patch.dueDate = parsed.dueDate;
  if (parsed.isPublic !== undefined) patch.isPublic = parsed.isPublic;
  if (parsed.isGuest !== undefined) patch.isGuest = parsed.isGuest;
  if (parsed.isPinned !== undefined) patch.isPinned = parsed.isPinned;
  if (parsed.isAgentic !== undefined) patch.isAgentic = parsed.isAgentic;
  if (parsed.tags !== undefined) patch.tags = parsed.tags;

  return patch;
}

export function resolveWorkspaceId(body: Record<string, unknown>): string | null {
  const ws = body.workspaceId || body.projectId;
  return ws ? String(ws) : null;
}

/** JSON Schema fragment for MCP tool output — mirrors GoalRecord. */
export const GOAL_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: [...GOAL_STATUSES] },
    priority: { type: 'string', enum: [...GOAL_PRIORITIES] },
    dueDate: { type: 'string', nullable: true },
    tags: { type: 'array', items: { type: 'string' } },
    isPinned: { type: 'boolean' },
    isArchived: { type: 'boolean' },
    isPublic: { type: 'boolean' },
    isGuest: { type: 'boolean' },
    isAgentic: { type: 'boolean' },
    updatedAt: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
    completedAt: { type: 'string', nullable: true },
  },
} as const;

export const MCP_GOAL_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the goal' },
    description: { type: 'string', description: 'Detailed description or acceptance criteria' },
    status: { type: 'string', enum: [...GOAL_STATUSES], description: 'Initial status' },
    priority: { type: 'string', enum: [...GOAL_PRIORITIES], description: 'Priority level' },
    dueDate: { type: 'string', description: 'Due date (ISO 8601)' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Tag labels' },
    workspaceId: { type: 'string', description: 'Optional workspace ID to bind this goal to' },
    isPinned: { type: 'boolean', description: 'Pin in goals list' },
    isAgentic: { type: 'boolean', description: 'True when an agent created this goal' },
  },
  required: ['title'],
} as const;

export const MCP_GOAL_UPDATE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the goal to update' },
    title: { type: 'string', description: 'Updated title' },
    description: { type: 'string', description: 'Updated description' },
    status: { type: 'string', enum: [...GOAL_STATUSES], description: 'Updated status' },
    priority: { type: 'string', enum: [...GOAL_PRIORITIES], description: 'Updated priority' },
    dueDate: { type: 'string', nullable: true, description: 'Updated due date (ISO 8601)' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
    isPinned: { type: 'boolean', description: 'Pin or unpin' },
  },
  required: ['id'],
} as const;

export const MCP_GOAL_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
    status: { type: 'string', enum: [...GOAL_STATUSES], description: 'Filter by status (e.g. todo for active)' },
    limit: { type: 'number', description: 'Maximum number of goals to return (default: 25)' },
  },
} as const;
