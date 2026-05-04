import { getCachedIdentityById, getCachedIdentityByUsername } from './identity-cache';

type IdentityLike = {
  username?: string | null;
  displayName?: string | null;
  userId?: string | null;
  $id?: string | null;
};

const normalizeUsername = (value?: string | null) => {
  if (!value) return null;
  const cleaned = value.toString().trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || null;
};

const formatFallbackHandle = (fallbackId?: string | null) => {
  const id = fallbackId?.trim();
  if (!id) return null;
  return `@${id.slice(0, 7)}`;
};

export function resolveIdentity(identity?: IdentityLike | null, fallbackId?: string | null) {
  const cachedById = fallbackId ? getCachedIdentityById(fallbackId) : null;
  const cachedByUsername = normalizeUsername(identity?.username) ? getCachedIdentityByUsername(identity?.username) : null;
  const resolved = {
    ...(cachedById || {}),
    ...(cachedByUsername || {}),
    ...(identity || {}),
  };

  const username = normalizeUsername(resolved.username) || normalizeUsername(cachedByUsername?.username) || normalizeUsername(cachedById?.username) || null;
  const fallbackHandle = formatFallbackHandle(fallbackId);
  const displayName =
    resolved.displayName?.trim() ||
    cachedById?.displayName?.trim() ||
    cachedByUsername?.displayName?.trim() ||
    username ||
    fallbackHandle ||
    'User';

  return {
    username,
    displayName,
    handle: username ? `@${username}` : fallbackHandle || '@user',
  };
}

export function resolveIdentityUsername(identity?: IdentityLike | null, fallbackId?: string | null) {
  return resolveIdentity(identity, fallbackId).username;
}
