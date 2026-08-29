import { MCP_ID_INPUT, MCP_LIMIT_INPUT, mcpItemsOutput } from './common';

export const MOMENT_TYPES = ['text', 'image', 'audio', 'note'] as const;

export interface MomentRecord {
  id: string;
  source: 'ecosystem';
  caption: string | null;
  content: string | null;
  type: string | null;
  momentKind: string | null;
  sourceId: string | null;
  fileId: string | null;
  userId: string | null;
  createdAt: string | null;
  isPublic: boolean;
}

export function shapeMoment(row: Record<string, unknown>): MomentRecord {
  const r = row as any;
  return {
    id: String(r.$id || r.id),
    source: 'ecosystem',
    caption: r.caption || null,
    content: r.caption || null,
    type: r.type || null,
    momentKind: r.momentKind || null,
    sourceId: r.sourceId || null,
    fileId: r.fileId || null,
    userId: r.userId || null,
    createdAt: r.$createdAt || r.createdAt || null,
    isPublic: !!r.isPublic,
  };
}

const MOMENT_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    caption: { type: 'string', nullable: true },
    type: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
  },
} as const;

export const MOMENT_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    caption: { type: 'string', nullable: true },
    type: { type: 'string', nullable: true },
  },
} as const;

export const MCP_MOMENT_LIST_INPUT = {
  type: 'object',
  properties: {
    limit: { type: 'number', description: 'Max moments to return (default: 25)' },
    mine: { type: 'boolean', description: 'Filter only moments authored by the authenticated actor' },
  },
} as const;
export const MCP_MOMENT_LIST_OUTPUT = mcpItemsOutput(MOMENT_LIST_ITEM_SCHEMA);
export const MCP_MOMENT_GET_INPUT = MCP_ID_INPUT('Moment ID');
export const MCP_MOMENT_CREATE_INPUT = {
  type: 'object',
  properties: {
    caption: { type: 'string', description: 'Text caption / body of the moment' },
    type: { type: 'string', enum: [...MOMENT_TYPES], description: 'Type of moment' },
    isPublic: { type: 'boolean', description: 'Whether the moment is publicly visible' },
  },
  required: ['caption'],
} as const;
export const MCP_MOMENT_COMMENTS_LIST_INPUT = {
  type: 'object',
  properties: {
    momentId: { type: 'string', description: 'Target moment ID' },
    limit: { type: 'number', description: 'Max comments to return (default: 50)' },
  },
  required: ['momentId'],
} as const;
export const MCP_MOMENT_COMMENT_CREATE_INPUT = {
  type: 'object',
  properties: {
    momentId: { type: 'string', description: 'Target moment ID' },
    content: { type: 'string', description: 'Comment text content' },
  },
  required: ['momentId', 'content'],
} as const;
