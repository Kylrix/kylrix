/**
 * Shared Appwrite helpers.
 * Keep transport-adjacent and browser-safe utilities here.
 */

export { getUserProfilePicId } from '../identity';

export type ProfilePreviewFetcher = (fileId: string, width?: number, height?: number) => Promise<string | null>;

type ProfilePreviewManager = {
  fetchProfilePreview: ProfilePreviewFetcher;
  getCachedProfilePreview: (fileId?: string | null) => string | null | undefined;
  clearProfilePreviewCache: () => void;
};

export function createProfilePreviewManager(fetcher: ProfilePreviewFetcher, storageKey = 'kylrix_avatar_cache'): ProfilePreviewManager {
  const previewCache = new Map<string, string | null>();

  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => previewCache.set(key, value as string | null));
      }
    } catch {
      // Ignore cache hydration failures.
    }
  }

  const persist = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(previewCache.entries())));
  };

  return {
    async fetchProfilePreview(fileId: string, width = 64, height = 64) {
      if (!fileId) return null;
      if (previewCache.has(fileId)) return previewCache.get(fileId) ?? null;

      try {
        const preview = await fetcher(fileId, width, height);
        previewCache.set(fileId, preview ?? null);
        persist();
        return preview ?? null;
      } catch {
        previewCache.set(fileId, null);
        persist();
        return null;
      }
    },
    getCachedProfilePreview(fileId?: string | null) {
      if (!fileId) return null;
      return previewCache.get(fileId);
    },
    clearProfilePreviewCache() {
      previewCache.clear();
      persist();
    },
  };
}

export function toAppwriteRowId(id?: string | null) {
  return id || null;
}
