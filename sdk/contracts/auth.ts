import { MCP_EMPTY_INPUT } from './common';

export interface ProfileRecord {
  id: string;
  auth: string;
  scopes: string[];
  patId: string | null;
}

export function shapeProfile(actor: {
  userId: string;
  kind: string;
  scopes: string[];
  patId?: string | null;
}): ProfileRecord {
  return {
    id: actor.userId,
    auth: actor.kind,
    scopes: actor.scopes,
    patId: actor.patId || null,
  };
}

export function shapeTokenMe(
  actor: { kind: string; userId: string; scopes: string[]; patId?: string | null },
  opts?: { pat?: unknown; catalog?: readonly unknown[] },
) {
  if (actor.kind !== 'pat' || !actor.patId) {
    return {
      auth: actor.kind,
      userId: actor.userId,
      scopes: actor.scopes,
      patId: null,
      note: 'Session/OAuth tokens have no PAT row; use a kyl_pat_ token for self-service.',
    };
  }
  return {
    auth: 'pat' as const,
    userId: actor.userId,
    patId: actor.patId,
    scopes: actor.scopes,
    pat: opts?.pat ?? null,
    catalog: opts?.catalog ?? [],
  };
}

export function shapeTokenScopeCatalog(scopes: readonly unknown[]) {
  return { scopes };
}

export function shapeTokenRefreshResult(pat: { scopes: string[] }, hint: string) {
  return {
    pat,
    scopes: pat.scopes,
    hint,
  };
}

export const PROFILE_RECORD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User or agent account ID' },
    auth: { type: 'string', description: 'Authentication provider type (pat, oauth, session)' },
    scopes: { type: 'array', items: { type: 'string' }, description: 'Active authorized scopes' },
    patId: { type: 'string', nullable: true, description: 'Personal Access Token ID if using PAT auth' },
  },
} as const;

export const TOKEN_INFO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    auth: { type: 'string' },
    userId: { type: 'string' },
    patId: { type: 'string', nullable: true },
    scopes: { type: 'array', items: { type: 'string' } },
    catalog: { type: 'array', items: { type: 'object' } },
    note: { type: 'string', nullable: true },
    pat: { type: 'object', nullable: true },
  },
} as const;

export const SCOPE_CATALOG_JSON_SCHEMA = {
  type: 'object',
  properties: {
    scopes: { type: 'array', items: { type: 'object' } },
  },
} as const;

export const TOKEN_REFRESH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    scopes: { type: 'array', items: { type: 'string' } },
    hint: { type: 'string', nullable: true },
    pat: { type: 'object', nullable: true },
  },
} as const;

export const MCP_PROFILE_GET_INPUT = MCP_EMPTY_INPUT;
export const MCP_TOKEN_INFO_INPUT = MCP_EMPTY_INPUT;
export const MCP_SCOPE_CATALOG_INPUT = MCP_EMPTY_INPUT;

export const MCP_TOKEN_REFRESH_INPUT = {
  type: 'object',
  properties: {
    scopes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Array of permission scopes to grant or replace on this token (e.g. ["notes:read", "notes:write", "goals:read", "goals:write"])',
    },
    mode: {
      type: 'string',
      enum: ['grant', 'replace'],
      description: 'Whether to additively grant new scopes or replace current scope set (default: grant)',
    },
  },
  required: ['scopes'],
} as const;
