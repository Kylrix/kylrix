/** Canonical HTTP API base for external integrators (REST + MCP). */
export const KYLRIX_API_V1_BASE = '/api/v1';

export interface ApiModulePaths {
  me: string;
  mcp: string;
  goals: string;
  notes: string;
  workspaces: string;
  connect: {
    messages: string;
    reactions: string;
    joinRequests: string;
    repair: string;
  };
  token: {
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
    connect: {
      messages: buildApiPath(basePath, 'connect', 'messages'),
      reactions: buildApiPath(basePath, 'connect', 'message-reactions'),
      joinRequests: buildApiPath(basePath, 'connect', 'join-requests'),
      repair: buildApiPath(basePath, 'connect', 'repair'),
    },
    token: {
      operations: 'in-code-secure-op',
    },
    forward: {
      conversations: buildApiPath(basePath, 'forward', 'conversations'),
      send: buildApiPath(basePath, 'forward', 'send'),
      targets: buildApiPath(basePath, 'forward', 'targets'),
    },
  };
}
