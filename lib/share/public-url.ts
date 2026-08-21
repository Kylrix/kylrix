import { PublicResourceType, PublicUrlOptions } from './resource-types';

const CANONICAL_SHARE_BASE_URL = 'https://www.kylrix.space';

/**
 * Share-link base URL.
 * - Browser: current origin for self-hosted and local installs.
 * - Server-only (email, notifications): canonical public host.
 */
function resolveShareBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return CANONICAL_SHARE_BASE_URL;
}

/**
 * Path-only public guest URL (no origin).
 * Law: {appPrefix}/{singularNoun}/{id}
 */
function buildPublicResourcePath(
  type: PublicResourceType,
  id: string,
  options: PublicUrlOptions = {}
): string {
  const { projectId } = options;

  if (projectId) {
    // Workspace prefix is singular share link — nested kind sub-routes are deprecated
    return `/workspace/${projectId}`;
  }

  switch (type) {
    case 'note':
      return `/idea/${id}`;
    case 'credential':
      return `/vault/${id}`;
    case 'totp':
      return `/vault/totp/${id}`;
    case 'goal':
    case 'task':
      return `/goal/${id}`;
    case 'form':
      return `/form/${id}`;
    case 'event':
      return `/events/${id}`;
    case 'project':
      return `/workspace/${id}`;
    case 'moment':
      return `/moment/${id}`;
    case 'agent_session':
      return `/agents/session/${id}`;
    case 'agent_conversation':
      return `/agents/chat/${id}`;
    case 'flow':
      return `/flow/${id}`;
    default:
      return `/${type}/${id}`;
  }
}

/**
 * Full public guest URL for clipboard copy and outbound links.
 */
export function buildPublicResourceUrl(
  type: PublicResourceType,
  id: string,
  options: PublicUrlOptions = {},
  baseUrl?: string
): string {
  const base = (baseUrl ?? resolveShareBaseUrl()).replace(/\/$/, '');
  return `${base}${buildPublicResourcePath(type, id, options)}`;
}


