type CachedThread = {
  moment: any | null;
  replies: any[];
  ancestors: any[];
  cachedAt: number;
};


const STORAGE_KEY = 'kylrix_connect_thread_cache_v1';

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
          cachedAt: value.cachedAt || Date.now()});
      }
    });
  } catch {
    // Ignore corrupted cache.
  }
}



export function getCachedMomentThread(rootId?: string | null) {
  if (!rootId) return null;
  hydrate();
  return memoryCache.get(rootId) || null;
}

