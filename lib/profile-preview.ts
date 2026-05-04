import { Storage } from 'appwrite';
import { client } from './appwrite';

const storage = new Storage(client);
const AVATAR_BUCKET_ID = 'profile_pictures';

const previewCache = new Map<string, string | null>();
const PREVIEW_STORE_KEY = 'kylrix_accounts_avatar_cache';

// Initialize from session to persist between refreshes
if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem(PREVIEW_STORE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => previewCache.set(k, v as string | null));
    }
  } catch (_e: any) { }
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
    const url = storage.getFilePreview(AVATAR_BUCKET_ID, fileId, width, height);
    const str = url.toString();
    previewCache.set(fileId, str);
    persistCache();
    return str;
  } catch (_err: any) {
    previewCache.set(fileId, null);
    persistCache();
    return null;
  }
}

export function getCachedProfilePreview(fileId?: string | null): string | null | undefined {
  if (!fileId) return null;
  return previewCache.get(fileId);
}
