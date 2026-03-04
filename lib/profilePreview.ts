import { getProfilePicturePreview } from '@/lib/appwrite';

const previewCache = new Map<string, string | null>();
const PREVIEW_STORE_KEY = 'kylrix_avatar_cache';

if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem(PREVIEW_STORE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => previewCache.set(k, v as string | null));
    }
  } catch (e) {}
}

function persistCache() {
  if (typeof window !== 'undefined') {
    const obj = Object.fromEntries(previewCache.entries());
    sessionStorage.setItem(PREVIEW_STORE_KEY, JSON.stringify(obj));
  }
}

export async function fetchProfilePreview(fileId?: string | null, width: number = 64, height: number = 64): Promise<string | null> {
  if (!fileId) return null;
  if (previewCache.has(fileId)) return previewCache.get(fileId) ?? null;
  try {
    const url = await getProfilePicturePreview(fileId, width, height);
    previewCache.set(fileId, url);
    persistCache();
    return url;
  } catch (err) {
    previewCache.set(fileId, null);
    persistCache();
    return null;
  }
}

export function getCachedProfilePreview(fileId?: string | null): string | null | undefined {
  if (!fileId) return null;
  return previewCache.get(fileId);
}
