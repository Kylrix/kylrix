export type CachedIdentity = {
  $id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  publicKey: string | null;
  preferences: any | null;
  bio: string | null;
  walletAddress: string | null;
  cachedAt: number;
  source?: string;
};

type IdentityInput = Partial<CachedIdentity> & {
  $id?: string | null;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  avatarFileId?: string | null;
  profilePicId?: string | null;
  publicKey?: string | null;
  preferences?: any | null;
  bio?: string | null;
  walletAddress?: string | null;
};

const STORAGE_KEY = 'kylrix_connect_identity_cache_v1';
const IDENTITY_UPDATED_EVENT = 'kylrix:identity-cache-updated';
const DEFAULT_STALE_AFTER_MS = 30_000;

const memoryCache = new Map<string, CachedIdentity>();
const inFlight = new Map<string, Promise<CachedIdentity | null>>();
let storageHydrated = false;

function normalizeUsername(value?: string | null) {
  if (!value) return null;
  const cleaned = value.toString().trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || null;
}

function canUseStorage() {
  return typeof window !== 'undefined';
}

function hydrateStorage() {
  if (storageHydrated || !canUseStorage()) return;
  storageHydrated = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, CachedIdentity>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (value && value.userId) {
        memoryCache.set(key, value);
      }
    });
  } catch {
    // Ignore corrupted cache entries.
  }
}

function persistStorage() {
  if (!canUseStorage()) return;

  try {
    const serialized = JSON.stringify(Object.fromEntries(memoryCache.entries()));
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Best-effort only.
  }
}

function emitUpdate(identity: CachedIdentity) {
  if (!canUseStorage()) return;
  window.dispatchEvent(new CustomEvent(IDENTITY_UPDATED_EVENT, { detail: identity }));
}

function storeIdentity(identity: CachedIdentity) {
  memoryCache.set(`id:${identity.userId}`, identity);
  memoryCache.set(`id:${identity.$id}`, identity);
  if (identity.username) {
    memoryCache.set(`username:${identity.username}`, identity);
  }
  persistStorage();
  emitUpdate(identity);
}

export function normalizeIdentity(input: IdentityInput | null | undefined): CachedIdentity | null {
  if (!input) return null;

  const userId = input.userId || input.$id;
  if (!userId) return null;

  const username = normalizeUsername(input.username);
  const displayName = input.displayName?.trim() || null;
  const avatar = input.avatarUrl || input.avatarFileId || input.avatar || input.profilePicId || null;
  const publicKey = input.publicKey || null;
  const preferences = input.preferences || null;
  const bio = input.bio || null;
  const walletAddress = input.walletAddress || null;

  return {
    $id: input.$id || userId,
    userId,
    username,
    displayName,
    avatar,
    publicKey,
    preferences,
    bio,
    walletAddress,
    cachedAt: input.cachedAt || Date.now(),
    source: input.source,
  };
}

export function seedIdentityCache(input: IdentityInput | null | undefined) {
  hydrateStorage();
  const identity = normalizeIdentity(input);
  if (!identity) return null;
  storeIdentity(identity);
  return identity;
}

export function getCachedIdentityById(userId?: string | null) {
  if (!userId) return null;
  hydrateStorage();
  return memoryCache.get(`id:${userId}`) || null;
}

export function getCachedIdentityByUsername(username?: string | null) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  hydrateStorage();
  return memoryCache.get(`username:${normalized}`) || null;
}

export function getCachedIdentity(key?: string | null) {
  if (!key) return null;
  return getCachedIdentityById(key) || getCachedIdentityByUsername(key);
}

async function refreshIdentity(
  cacheKey: string,
  fetcher: () => Promise<IdentityInput | null | undefined>
) {
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const fresh = await fetcher();
      return seedIdentityCache(fresh);
    } catch {
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);
  return request;
}

function shouldRefresh(identity: CachedIdentity, staleAfterMs: number) {
  return Date.now() - identity.cachedAt > staleAfterMs;
}

export async function resolveIdentityById(
  userId: string,
  fetcher: () => Promise<IdentityInput | null | undefined>,
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS
) {
  const cached = getCachedIdentityById(userId);
  if (cached) {
    if (shouldRefresh(cached, staleAfterMs)) {
      void refreshIdentity(`id:${userId}`, fetcher);
    }
    return cached;
  }

  return refreshIdentity(`id:${userId}`, fetcher);
}

export async function resolveIdentityByUsername(
  username: string,
  fetcher: () => Promise<IdentityInput | null | undefined>,
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS
) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const cached = getCachedIdentityByUsername(normalized);
  if (cached) {
    if (shouldRefresh(cached, staleAfterMs)) {
      void refreshIdentity(`username:${normalized}`, fetcher);
    }
    return cached;
  }

  return refreshIdentity(`username:${normalized}`, fetcher);
}

export function primeIdentityCache(entries: Array<IdentityInput | null | undefined>) {
  entries.forEach((entry) => seedIdentityCache(entry));
}

export function subscribeIdentityCache(listener: (identity: CachedIdentity) => void) {
  if (!canUseStorage()) return () => {};

  const handler = (event: Event) => {
    const custom = event as CustomEvent<CachedIdentity>;
    if (custom.detail) listener(custom.detail);
  };

  window.addEventListener(IDENTITY_UPDATED_EVENT, handler);
  return () => window.removeEventListener(IDENTITY_UPDATED_EVENT, handler);
}
