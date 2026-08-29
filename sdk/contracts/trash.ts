import { mcpItemsOutput } from './common';

export const TRASH_KINDS = ['note', 'goal', 'form', 'event'] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

function trashTimestamps(row: Record<string, unknown>) {
  const r = row as any;
  const ts = r.$updatedAt || r.updatedAt || null;
  return { updatedAt: ts, deletedAt: ts };
}

export function shapeTrashNoteItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    kind: 'note' as const,
    title: r.title || 'Untitled note',
    summary: r.summary || (r.content ? String(r.content).slice(0, 140) : ''),
    ...trashTimestamps(row),
  };
}

export function shapeTrashGoalItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    kind: 'goal' as const,
    title: r.title || 'Untitled goal',
    status: r.status || 'trash',
    ...trashTimestamps(row),
  };
}

export function shapeTrashVaultItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    kind: 'vault' as const,
    title: r.name || 'Untitled secret',
    itemType: r.itemType || 'login',
    username: r.username || null,
    url: r.url || null,
    ...trashTimestamps(row),
  };
}

export function shapeTrashEventItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    kind: 'event' as const,
    title: r.title || r.name || 'Untitled event',
    ...trashTimestamps(row),
  };
}

export function shapeTrashFormItem(row: Record<string, unknown>) {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    kind: 'form' as const,
    title: r.title || r.name || 'Untitled form',
    ...trashTimestamps(row),
  };
}

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
