import { z } from 'zod';
import { MCP_ID_INPUT, MCP_WORKSPACE_LIMIT_INPUT, mcpItemsOutput } from './common';

export const eventCreateInputZod = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  location: z.string().optional(),
  workspaceId: z.string().optional(),
  calendarId: z.string().optional(),
});

export const eventUpdateInputZod = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
});

export interface EventRecord {
  id: string;
  title: string;
  description?: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  isPublic?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  updatedAt?: string | null;
}

export function shapeEventListItem(row: Record<string, unknown>): EventRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || r.name || 'Untitled',
    startTime: r.startTime || r.startsAt || r.startAt || null,
    endTime: r.endTime || r.endsAt || r.endAt || null,
    location: r.location ?? null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
  };
}

export function shapeEventDetail(row: Record<string, unknown>): EventRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    title: r.title || 'Untitled',
    description: r.description || null,
    startTime: r.startTime || null,
    endTime: r.endTime || null,
    location: r.location || null,
    isPublic: !!r.isPublic,
  };
}

const EVENT_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    startTime: { type: 'string', nullable: true },
    endTime: { type: 'string', nullable: true },
    location: { type: 'string', nullable: true },
  },
} as const;

export const EVENT_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    startTime: { type: 'string', nullable: true },
    endTime: { type: 'string', nullable: true },
    location: { type: 'string', nullable: true },
    isPublic: { type: 'boolean' },
  },
} as const;

export const MCP_EVENT_LIST_INPUT = MCP_WORKSPACE_LIMIT_INPUT;
export const MCP_EVENT_LIST_OUTPUT = mcpItemsOutput(EVENT_LIST_ITEM_SCHEMA);
export const MCP_EVENT_GET_INPUT = MCP_ID_INPUT('ID of the event');
export const MCP_EVENT_CREATE_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Title of the event' },
    description: { type: 'string', description: 'Description or agenda' },
    startTime: { type: 'string', description: 'ISO 8601 start timestamp' },
    endTime: { type: 'string', description: 'ISO 8601 end timestamp' },
    location: { type: 'string', description: 'Physical or virtual location URL' },
    workspaceId: { type: 'string', description: 'Optional workspace ID' },
  },
  required: ['title', 'startTime'],
} as const;
export const MCP_EVENT_UPDATE_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID of the event to update' },
    title: { type: 'string', description: 'Updated title' },
    description: { type: 'string', description: 'Updated description' },
    startTime: { type: 'string', description: 'Updated start time' },
    endTime: { type: 'string', description: 'Updated end time' },
    location: { type: 'string', description: 'Updated location' },
  },
  required: ['id'],
} as const;
export const MCP_EVENT_DELETE_INPUT = MCP_ID_INPUT('ID of the event to delete');
