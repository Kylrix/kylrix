import { getProfilePicturePreview, setKylrixPulse, getKylrixPulse } from '@/lib/appwrite';

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

async function convertUrlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function fetchProfilePreview(fileId?: string | null, width: number = 64, height: number = 64): Promise<string | null> {
  if (!fileId) return null;
  
  // 1. Memory/Session Cache
  if (previewCache.has(fileId)) return previewCache.get(fileId) ?? null;

  // 2. Pulse Cache (Instant Base64)
  const pulse = getKylrixPulse();
  if (pulse?.avatarBase64) {
      previewCache.set(fileId, pulse.avatarBase64);
      return pulse.avatarBase64;
  }

  try {
    const url = await getProfilePicturePreview(fileId, width, height);
    const str = url as unknown as string;
    
    // Background: Convert to Base64 and save to Pulse for next reload
    convertUrlToBase64(str).then(base64 => {
        const currentUser = { $id: pulse?.$id || 'unknown' };
        if (currentUser.$id !== 'unknown') {
            setKylrixPulse(currentUser, base64);
        }
    }).catch(() => {});

    previewCache.set(fileId, str);
    persistCache();
    return str;
  } catch (err) {
    previewCache.set(fileId, null);
    persistCache();
    return null;
  }
}

export function getCachedProfilePreview(fileId?: string | null): string | null | undefined {
  if (!fileId) return null;
  
  // Pulse takes precedence for instant load
  const pulse = getKylrixPulse();
  if (pulse?.avatarBase64) return pulse.avatarBase64;

  return previewCache.get(fileId);
}
