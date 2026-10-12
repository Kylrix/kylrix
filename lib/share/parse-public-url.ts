import type { PublicResourceType } from './resource-types';

export type ParsedPublicResource = {
  resourceType: PublicResourceType | 'profile' | 'connect';
  id: string;
  /** Path without origin, e.g. /idea/abc */
  pathname: string;
  href: string;
  label: string;
  color: string;
  appKey: string;
};

const KYLRIX_HOST_RE =
  /(^|\.)kylrix\.(space|com|app)$/i;

function isKylrixHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (KYLRIX_HOST_RE.test(h) || h === 'localhost' || h === '127.0.0.1') return true;
  if (typeof window !== 'undefined' && window.location?.hostname?.toLowerCase() === h) return true;
  return false;
}

/**
 * Detect Kylrix native share / in-app URLs and map them to known object kinds.
 * Used for engineered link cards (not external OG scrapes).
 */
export function parseKylrixPublicUrl(raw: string): ParsedPublicResource | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href) && href.startsWith('/')) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://www.kylrix.space';
    href = `${origin}${href}`;
  } else if (!/^https?:\/\//i.test(href) && /kylrix\.(space|com|app)/i.test(href)) {
    href = `https://${href}`;
  }

  let hostname = '';
  let pathname = '';
  try {
    const u = new URL(href);
    hostname = u.hostname;
    pathname = u.pathname || '/';
  } catch {
    return null;
  }

  if (!isKylrixHost(hostname) && !trimmed.startsWith('/')) return null;

  const parts = pathname.split('/').filter(Boolean);
  const head = (parts[0] || '').toLowerCase();
  const id = parts[1] || '';

  const pack = (
    resourceType: ParsedPublicResource['resourceType'],
    resourceId: string,
    label: string,
    color: string,
    appKey: string,
  ): ParsedPublicResource => ({
    resourceType,
    id: resourceId,
    pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
    href,
    label,
    color,
    appKey,
  });

  if (head === 'u' || head === 'user' || head === 'profile') {
    return pack('profile', id || parts[0], id ? `@${id}` : 'Profile', '#3B82F6', 'accounts');
  }
  if (head === 'idea' || head === 'note' || head === 'notes') {
    if (!id) return pack('note', '', 'Idea', '#EC4899', 'note');
    return pack('note', id, 'Idea', '#EC4899', 'note');
  }
  if (head === 'goal' || head === 'goals' || head === 'task' || head === 'tasks') {
    if (!id) return pack('goal', '', 'Goal', '#A855F7', 'flow');
    return pack('goal', id, 'Goal', '#A855F7', 'flow');
  }
  if (head === 'form' || head === 'forms') {
    if (!id) return pack('form', '', 'Form', '#A855F7', 'flow');
    return pack('form', id, 'Form', '#A855F7', 'flow');
  }
  if (head === 'events' || head === 'event') {
    if (!id) return pack('event', '', 'Event', '#A855F7', 'flow');
    return pack('event', id, 'Event', '#A855F7', 'flow');
  }
  if (head === 'flow' || head === 'flows' || head === 'workflows') {
    if (!id) return pack('flow', '', 'Flow', '#A855F7', 'flow');
    return pack('flow', id, 'Flow', '#A855F7', 'flow');
  }
  if (head === 'workspace' || head === 'workspaces' || head === 'project' || head === 'projects') {
    if (!id) return pack('project', '', 'Workspace', '#6366F1', 'root');
    return pack('project', id, 'Workspace', '#6366F1', 'root');
  }
  if (head === 'moment') {
    if (!id) return pack('moment', '', 'Moment', '#F59E0B', 'connect');
    return pack('moment', id, 'Moment', '#F59E0B', 'connect');
  }
  if (head === 'vault') {
    if (parts[1]?.toLowerCase() === 'totp') {
      const totpId = parts[2] || '';
      return pack('totp', totpId, 'Code', '#10B981', 'vault');
    }
    return pack('credential', id, 'Vault', '#10B981', 'vault');
  }
  if (head === 'agents') {
    if (parts[1]?.toLowerCase() === 'session' && parts[2]) {
      return pack('agent_session', parts[2], 'Session', '#6366F1', 'root');
    }
    if (parts[1]?.toLowerCase() === 'chat' && parts[2]) {
      return pack('agent_conversation', parts[2], 'Chat', '#6366F1', 'root');
    }
  }
  if (head === 'connect' || head === 'chats' || head === 'hangouts') {
    return pack('connect', id || 'connect', 'Connect', '#F59E0B', 'connect');
  }
  if (head === 'app') {
    return pack('note', id || '', 'Ideas', '#EC4899', 'note');
  }

  // Bare kylrix host / unknown path — still mark as ecosystem
  return pack('connect', '', 'Kylrix', '#6366F1', 'root');
}

const URL_IN_TEXT_RE =
  /((?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-zA-Z0-9-]+\.)+(?:kylrix\.(?:space|com|app))[^\s<>"']*|\/(?:idea|goal|form|events|event|moment|workspace|vault|flow|flows|agents|u)\/[^\s<>"']+)/gi;

export function extractUrlsFromText(text: string): string[] {
  const hits: string[] = [];
  const re = new RegExp(URL_IN_TEXT_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ''))) {
    if (m[0]) hits.push(m[0].replace(/[),.;!?]+$/, ''));
  }
  return hits;
}

/** Split body into prose (kylrix URLs removed) + parsed ecosystem link cards. */
export function splitEcosystemLinks(text: string): {
  prose: string;
  links: ParsedPublicResource[];
} {
  const links: ParsedPublicResource[] = [];
  const seen = new Set<string>();
  let prose = text || '';

  for (const raw of extractUrlsFromText(prose)) {
    const parsed = parseKylrixPublicUrl(raw);
    if (!parsed) continue;
    // Skip bare host with no object path
    if (!parsed.id && (parsed.pathname === '/' || parsed.pathname === '')) continue;

    const key = `${parsed.resourceType}:${parsed.id || parsed.pathname}`;
    if (seen.has(key)) {
      prose = prose.split(raw).join(' ');
      continue;
    }
    seen.add(key);
    links.push(parsed);
    prose = prose.split(raw).join(' ');
  }

  prose = prose.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { prose, links };
}
