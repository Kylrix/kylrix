/** Canonical HTTP API base for external integrators (REST + MCP). */
export const KYLRIX_API_V1_BASE = '/api/v1';

export interface ApiModulePaths {
  me: string;
  mcp: string;
  goals: string;
  notes: string;
  workspaces: string;
  projects: string;
  flows: string;
  events: string;
  forms: string;
  tags: string;
  trash: string;
  moments: string;
  chats: string;
  agents: string;
  threads: string;
  vault: string;
  pats: string;
  connect: {
    messages: string;
    reactions: string;
    joinRequests: string;
    repair: string;
  };
  token: {
    root: string;
    scopes: string;
    scopesGrant: string;
    operations: string;
  };
  forward: {
    conversations: string;
    send: string;
    targets: string;
  };
}

export function buildApiPath(basePath: string, ...segments: string[]) {
  const cleanedBase = basePath.replace(/\/+$/, '');
  const cleanedSegments = segments
    .map((segment) => String(segment || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return [cleanedBase, ...cleanedSegments].join('/');
}

/** Build a path under `/api/v1` — use for REST clients and typed fetch wrappers. */
export function apiV1Path(...segments: string[]) {
  return buildApiPath(KYLRIX_API_V1_BASE, ...segments);
}

export function createApiModulePaths(basePath = KYLRIX_API_V1_BASE): ApiModulePaths {
  return {
    me: buildApiPath(basePath, 'me'),
    mcp: buildApiPath(basePath, 'mcp'),
    goals: buildApiPath(basePath, 'goals'),
    notes: buildApiPath(basePath, 'notes'),
    workspaces: buildApiPath(basePath, 'workspaces'),
    projects: buildApiPath(basePath, 'projects'),
    flows: buildApiPath(basePath, 'flows'),
    events: buildApiPath(basePath, 'events'),
    forms: buildApiPath(basePath, 'forms'),
    tags: buildApiPath(basePath, 'tags'),
    trash: buildApiPath(basePath, 'trash'),
    moments: buildApiPath(basePath, 'moments'),
    chats: buildApiPath(basePath, 'chats'),
    agents: buildApiPath(basePath, 'agents'),
    threads: buildApiPath(basePath, 'threads'),
    vault: buildApiPath(basePath, 'vault'),
    pats: buildApiPath(basePath, 'pats'),
    connect: {
      messages: buildApiPath(basePath, 'connect', 'messages'),
      reactions: buildApiPath(basePath, 'connect', 'message-reactions'),
      joinRequests: buildApiPath(basePath, 'connect', 'join-requests'),
      repair: buildApiPath(basePath, 'connect', 'repair'),
    },
    token: {
      root: buildApiPath(basePath, 'token'),
      scopes: buildApiPath(basePath, 'token', 'scopes'),
      scopesGrant: buildApiPath(basePath, 'token', 'scopes', 'grant'),
      operations: 'in-code-secure-op',
    },
    forward: {
      conversations: buildApiPath(basePath, 'forward', 'conversations'),
      send: buildApiPath(basePath, 'forward', 'send'),
      targets: buildApiPath(basePath, 'forward', 'targets'),
    },
  };
}
