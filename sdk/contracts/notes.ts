/**
 * Canonical Note contract — single source of truth for REST, MCP, and agent tools.
 */
import { z } from 'zod';

export const noteCreateInputZod = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const noteUpdateInputZod = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const noteListQueryZod = z.object({
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type NoteCreateInput = z.infer<typeof noteCreateInputZod>;
export type NoteUpdateInput = z.infer<typeof noteUpdateInputZod>;
export type NoteListQuery = z.infer<typeof noteListQueryZod>;

export interface NoteRecord {
  id: string;
  title: string;
  content: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  isPublic: boolean;
  isGuest: boolean;
}

export function shapeNote(row: Record<string, unknown>): NoteRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled',
    content: r.content ?? r.body ?? null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    isPublic: r.isPublic !== undefined ? Boolean(r.isPublic) : true,
    isGuest: r.isGuest !== undefined ? Boolean(r.isGuest) : true,
  };
}

export const NOTE_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
    isPublic: { type: 'boolean' },
    isGuest: { type: 'boolean' },
  },
} as const;

export const MCP_NOTE_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
    limit: { type: 'number', description: 'Maximum number of notes to return (default: 25)' },
  },
} as const;

export const MCP_NOTE_GET_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Note ID to retrieve' },
  },
  required: ['id'],
} as const;

export const MCP_NOTE_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the note' },
    content: { type: 'string', description: 'Markdown body content' },
    workspaceId: { type: 'string', description: 'Optional workspace ID to bind this note to' },
    isPublic: { type: 'boolean', description: 'Whether the note is accessible via public share link' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Optional list of tag names' },
  },
  required: ['title'],
} as const;

export const MCP_NOTE_UPDATE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the note to update' },
    title: { type: 'string', description: 'Updated note title' },
    content: { type: 'string', description: 'Updated markdown content' },
    isPublic: { type: 'boolean', description: 'Public share status' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Updated list of tag names' },
  },
  required: ['id'],
} as const;

export const MCP_NOTE_DELETE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the note to delete' },
  },
  required: ['id'],
} as const;

export const MCP_NOTE_LIST_OUTPUT = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: NOTE_RECORD_JSON_SCHEMA,
    },
  },
} as const;
