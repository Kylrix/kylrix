type CachedThread = {
  moment: any | null;
  replies: any[];
  ancestors: any[];
  cachedAt: number;
};

export const THREAD_CACHE_STALE_AFTER_MS = 1000 * 60 * 5;

const STORAGE_KEY = 'kylrix_connect_thread_cache_v1';
const MAX_ENTRIES = 20;

const memoryCache = new Map<string, CachedThread>();
let hydrated = false;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function hydrate() {
  if (hydrated || !canUseStorage()) return;
  hydrated = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, CachedThread>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (value?.moment?.$id) {
        memoryCache.set(key, {
          moment: value.moment || null,
          replies: Array.isArray(value.replies) ? value.replies : [],
          ancestors: Array.isArray(value.ancestors) ? value.ancestors : [],
          cachedAt: value.cachedAt || Date.now(),
        });
      }
    });
  } catch {
    // Ignore corrupted cache.
  }
}

function persist() {
  if (!canUseStorage()) return;

  try {
    const entries = Array.from(memoryCache.entries()).slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Best effort only.
  }
}

export function seedMomentThread(rootId: string | null | undefined, thread: Partial<CachedThread> | null | undefined) {
  hydrate();
  if (!rootId || !thread?.moment?.$id) return null;

  const cached: CachedThread = {
    moment: thread.moment || null,
    replies: Array.isArray(thread.replies) ? thread.replies : [],
    ancestors: Array.isArray(thread.ancestors) ? thread.ancestors : [],
    cachedAt: Date.now(),
  };

  memoryCache.set(rootId, cached);
  persist();
  return cached;
}

export function getCachedMomentThread(rootId?: string | null) {
  if (!rootId) return null;
  hydrate();
  return memoryCache.get(rootId) || null;
}

export function isFreshMomentThread(rootId?: string | null, staleAfterMs: number = THREAD_CACHE_STALE_AFTER_MS) {
  const cached = getCachedMomentThread(rootId);
  if (!cached) return false;
  return Date.now() - cached.cachedAt < staleAfterMs;
}
