/**
 * Stable PAT / OAuth scope catalog.
 * Additive only — never rename or remove shipped scopes (break user keys).
 */

export const PAT_SCOPES = [
  'profile:read',
  'notes:read',
  'notes:write',
  'goals:read',
  'goals:write',
  'forms:read',
  'forms:write',
  'events:read',
  'events:write',
  'flows:read',
  'flows:write',
  'flows:install',
  'vault:read',
  'vault:write',
  'objects:read',
  'objects:write',
  'tools:execute',
  // Token self-service + minting other PATs
  'pats:read',
  'pats:write',
  // Workspaces (projects)
  'workspaces:read',
  'workspaces:write',
  // Connect / chat
  'chats:read',
  'chats:write',
  // Agentic sessions (+ harness mirrors & provisioning)
  'agents:read',
  'agents:write',
  'agents:harness',
  'agents:provision',
  'moments:read',
  'moments:write',
  'tags:read',
  'tags:write',
] as const;

export type PatScope = (typeof PAT_SCOPES)[number];

export const PAT_SCOPE_META: Record<
  PatScope,
  { label: string; danger?: boolean }
> = {
  'profile:read': { label: 'Read profile' },
  'notes:read': { label: 'Read ideas' },
  'notes:write': { label: 'Write ideas' },
  'goals:read': { label: 'Read goals' },
  'goals:write': { label: 'Write goals' },
  'forms:read': { label: 'Read forms' },
  'forms:write': { label: 'Write forms' },
  'events:read': { label: 'Read events' },
  'events:write': { label: 'Write events' },
  'flows:read': { label: 'Read flows' },
  'flows:write': { label: 'Write flows' },
  'flows:install': { label: 'Install flows' },
  'vault:read': { label: 'Read vault metadata', danger: true },
  'vault:write': { label: 'Write vault', danger: true },
  'objects:read': { label: 'Read object links' },
  'objects:write': { label: 'Write object links' },
  'tools:execute': { label: 'Run tools', danger: true },
  'pats:read': { label: 'List access tokens' },
  'pats:write': { label: 'Create or revoke access tokens', danger: true },
  'workspaces:read': { label: 'Read workspaces' },
  'workspaces:write': { label: 'Write workspaces' },
  'chats:read': { label: 'Read chats' },
  'chats:write': { label: 'Write chats', danger: true },
  'agents:read': { label: 'Read agent sessions' },
  'agents:write': { label: 'Write agent sessions' },
  'agents:harness': { label: 'Mirror CLI harness sessions', danger: true },
  'agents:provision': { label: 'Provision autonomous agents (zero user data access)' },
  'moments:read': { label: 'Read moments' },
  'moments:write': { label: 'Write moments' },
  'tags:read': { label: 'Read tags' },
  'tags:write': { label: 'Write tags' },
};

export function normalizeScopes(input: unknown): PatScope[] {
  const allowed = new Set<string>(PAT_SCOPES);
  const arr = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : String(input).split(',');
          } catch {
            return String(input).split(',');
          }
        })()
      : [];
  const out: PatScope[] = [];
  for (const raw of arr) {
    const s = String(raw || '').trim() as PatScope;
    if (allowed.has(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

export function hasScope(granted: string[] | PatScope[], needed: PatScope): boolean {
  return granted.includes(needed);
}

export function assertScope(granted: string[], needed: PatScope) {
  if (!hasScope(granted, needed)) {
    const err = new Error(`Missing scope: ${needed}`);
    (err as any).status = 403;
    (err as any).code = 'scope_denied';
    throw err;
  }
}

/** Full catalog for clients / self-refresh UIs. */
export function listScopeCatalog() {
  return PAT_SCOPES.map((id) => ({
    id,
    label: PAT_SCOPE_META[id].label,
    danger: !!PAT_SCOPE_META[id].danger,
  }));
}
