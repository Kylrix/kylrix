/**
 * Semantic UI catalog — stable targets for agent navigation.
 * Routes may change; agents resolve by `target` id or natural-language aliases.
 */

export interface UiDestination {
  /** Stable id, e.g. settings.passkeys */
  id: string;
  label: string;
  description: string;
  /** Canonical route (may include hash for in-page sections) */
  route: string;
  zone: string;
  parent?: string;
  /** Natural-language aliases the model may match */
  aliases: string[];
  /** Optional drawer/modal to open after navigation */
  drawer?: string;
  drawerPayload?: Record<string, unknown>;
}

export const UI_DESTINATIONS: UiDestination[] = [
  {
    id: 'ideas.home',
    label: 'Ideas',
    description: 'Notes and ideas list',
    route: '/app',
    zone: 'note',
    aliases: ['ideas', 'notes', 'app', 'brainstorm'],
  },
  {
    id: 'goals.home',
    label: 'Goals',
    description: 'Goals and tasks board',
    route: '/goals',
    zone: 'flow',
    aliases: ['goals', 'tasks', 'todo', 'flow goals'],
  },
  {
    id: 'events.home',
    label: 'Events',
    description: 'Calendar events',
    route: '/flow/events',
    zone: 'flow',
    aliases: ['events', 'calendar', 'schedule'],
  },
  {
    id: 'forms.home',
    label: 'Forms',
    description: 'Form builder dashboard',
    route: '/forms',
    zone: 'flow',
    aliases: ['forms', 'surveys', 'intake'],
  },
  {
    id: 'vault.home',
    label: 'Vault',
    description: 'Passwords and secrets',
    route: '/vault',
    zone: 'vault',
    aliases: ['vault', 'passwords', 'secrets', 'credentials'],
  },
  {
    id: 'vault.totp',
    label: 'TOTP Codes',
    description: 'Authenticator codes',
    route: '/vault/totp',
    zone: 'vault',
    aliases: ['totp', 'authenticator', '2fa codes'],
  },
  {
    id: 'connect.home',
    label: 'Connect',
    description: 'Social feed and messages',
    route: '/connect',
    zone: 'connect',
    aliases: ['connect', 'social', 'moments', 'feed'],
  },
  {
    id: 'projects.home',
    label: 'Projects',
    description: 'Project workspaces',
    route: '/projects',
    zone: 'projects',
    aliases: ['projects', 'workspaces'],
  },
  {
    id: 'settings.home',
    label: 'Settings',
    description: 'Account and workspace settings',
    route: '/settings',
    zone: 'settings',
    aliases: ['settings', 'preferences', 'configuration'],
  },
  {
    id: 'settings.passkeys',
    label: 'Passkeys',
    description: 'Register and manage passkeys for sign-in',
    route: '/settings#passkeys-setup',
    zone: 'settings',
    parent: 'settings.home',
    aliases: ['passkey', 'passkeys', 'webauthn', 'biometric login', 'face id', 'touch id'],
  },
  {
    id: 'settings.agents',
    label: 'Assistant Settings',
    description: 'Kylie permissions, keys, and automations',
    route: '/settings/agents',
    zone: 'agents',
    parent: 'settings.home',
    aliases: ['agent settings', 'kylie settings', 'assistant', 'smart system', 'ai settings'],
  },
  {
    id: 'settings.security',
    label: 'Security Settings',
    description: 'Vault lock, masterpass, and security toggles',
    route: '/settings',
    zone: 'settings',
    parent: 'settings.home',
    aliases: ['security', 'masterpass', 'vault lock'],
  },
  {
    id: 'agents.workspace',
    label: 'Agents Workspace',
    description: 'Manage autonomous agents',
    route: '/agents',
    zone: 'agents',
    aliases: ['agents', 'autonomous agents'],
  },
  {
    id: 'tags.home',
    label: 'Tags',
    description: 'Crosslink tags manager',
    route: '/tags',
    zone: 'workspace',
    aliases: ['tags', 'labels', 'crosslinks'],
  },
];

export function resolveUiDestination(query: string): UiDestination | null {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const byId = UI_DESTINATIONS.find((d) => d.id.toLowerCase() === q);
  if (byId) return byId;

  const byRoute = UI_DESTINATIONS.find((d) => d.route.toLowerCase() === q);
  if (byRoute) return byRoute;

  for (const dest of UI_DESTINATIONS) {
    if (dest.label.toLowerCase() === q) return dest;
    if (dest.aliases.some((a) => a.toLowerCase() === q)) return dest;
  }

  let best: UiDestination | null = null;
  let bestScore = 0;
  for (const dest of UI_DESTINATIONS) {
    const hay = [dest.label, dest.description, ...dest.aliases].join(' ').toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const score = tokens.filter((t) => hay.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = dest;
    }
  }
  return bestScore >= 1 ? best : null;
}

export function buildUiCatalogPrompt(): string {
  return UI_DESTINATIONS.map(
    (d) =>
      `- ${d.id}: "${d.label}" → ${d.route}${d.parent ? ` (under ${d.parent})` : ''}. Aliases: ${d.aliases.join(', ')}`,
  ).join('\n');
}
