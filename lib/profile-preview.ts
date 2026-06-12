import { getProfilePicturePreview, setKylrixPulse, getKylrixPulse } from '@/lib/appwrite';

const previewCache = new Map<string, string | null>();
const PREVIEW_STORE_KEY = 'kylrix_avatar_cache_v2';

// Initialize from session to persist between refreshes
if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem(PREVIEW_STORE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          previewCache.set(k, v as string | null);
        }
      });
    }
  } catch (_e: any) { }
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

  // 2. Pulse Cache (Instant Base64 if it's the current user)
  const pulse = getKylrixPulse();
  if ((pulse?.profilePicId === fileId || pulse?.$id === fileId) && pulse?.avatarBase64) {
      previewCache.set(fileId, pulse.avatarBase64);
      return pulse.avatarBase64;
  }

  try {
    const urlObj = getProfilePicturePreview(fileId, width, height);
    if (!urlObj) throw new Error('Failed to generate preview URL');
    const str = urlObj.toString();
    
    let isAccessible = false;
    try {
      const res = await fetch(str, { method: 'HEAD' });
      if (res.ok) isAccessible = true;
    } catch {}

    if (isAccessible) {
      // Background: Save to Pulse directly if it is already a base64 data url, otherwise convert
      if (pulse?.profilePicId === fileId || pulse?.$id === fileId) {
          if (str.startsWith('data:')) {
              setKylrixPulse({ $id: pulse.$id, name: pulse.name, prefs: { profilePicId: fileId } }, str);
          } else {
              convertUrlToBase64(str).then(base64 => {
                  setKylrixPulse({ $id: pulse.$id, name: pulse.name, prefs: { profilePicId: fileId } }, base64);
              }).catch(() => {});
          }
      }

      previewCache.set(fileId, str);
      persistCache();
      return str;
    } else {
      // Fallback: Fetch securely via server action
      const { getProfilePicturePreviewSecure } = await import('@/lib/actions/secure-ops');
      const secureBase64 = await getProfilePicturePreviewSecure(fileId);
      if (secureBase64) {
        if (pulse?.profilePicId === fileId || pulse?.$id === fileId) {
          setKylrixPulse({ $id: pulse.$id, name: pulse.name, prefs: { profilePicId: fileId } }, secureBase64);
        }
        previewCache.set(fileId, secureBase64);
        persistCache();
        return secureBase64;
      }
      return null;
    }
  } catch (err) {
    return null;
  }
}

export function getCachedProfilePreview(fileId?: string | null): string | null | undefined {
  if (!fileId) return null;
  
  // Pulse takes precedence for current user for instant load
  const pulse = getKylrixPulse();
  if ((pulse?.profilePicId === fileId || pulse?.$id === fileId) && pulse?.avatarBase64) return pulse.avatarBase64;

  return previewCache.get(fileId);
}
