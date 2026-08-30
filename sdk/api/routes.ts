/** First-path segments for `/api/v1/{segment}/...` REST dispatch. */
export const API_V1_SEGMENTS = {
  me: 'me',
  token: 'token',
  pats: 'pats',
  notes: 'notes',
  goals: 'goals',
  flows: 'flows',
  workspaces: 'workspaces',
  projects: 'projects',
  events: 'events',
  forms: 'forms',
  chats: 'chats',
  threads: 'threads',
  agents: 'agents',
  vault: 'vault',
  totp: 'totp',
  trash: 'trash',
  tags: 'tags',
  moments: 'moments',
  objects: 'objects',
  feeds: 'feeds',
} as const;

/** Nested path segments reused across REST handlers. */
export const API_V1_SUBSEGMENTS = {
  scopes: 'scopes',
  grant: 'grant',
  messages: 'messages',
  comments: 'comments',
  collaborators: 'collaborators',
  members: 'members',
  objects: 'objects',
  attach: 'attach',
  projects: 'projects',
  sessions: 'sessions',
  harness: 'harness',
  items: 'items',
  restore: 'restore',
  purge: 'purge',
  publish: 'publish',
  keys: 'keys',
  provision: 'provision',
  identity: 'identity',
  mirror: 'mirror',
  installations: 'installations',
} as const;

export function isWorkspaceSegment(segment?: string) {
  return segment === API_V1_SEGMENTS.workspaces || segment === API_V1_SEGMENTS.projects;
}

export function workspaceIdParam(params: URLSearchParams) {
  return (
    params.get('workspace_id') ||
    params.get('workspaceId') ||
    params.get('project_id') ||
    params.get('projectId')
  );
}
