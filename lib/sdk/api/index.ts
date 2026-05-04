export interface ApiModulePaths {
  connect: {
    messages: string;
    reactions: string;
    joinRequests: string;
    repair: string;
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

export function createApiModulePaths(basePath = '/api'): ApiModulePaths {
  return {
    connect: {
      messages: buildApiPath(basePath, 'connect', 'messages'),
      reactions: buildApiPath(basePath, 'connect', 'message-reactions'),
      joinRequests: buildApiPath(basePath, 'connect', 'join-requests'),
      repair: buildApiPath(basePath, 'connect', 'repair'),
    },
    forward: {
      conversations: buildApiPath(basePath, 'forward', 'conversations'),
      send: buildApiPath(basePath, 'forward', 'send'),
      targets: buildApiPath(basePath, 'forward', 'targets'),
    },
  };
}

export const KYLRIX_API_PATHS = createApiModulePaths();
