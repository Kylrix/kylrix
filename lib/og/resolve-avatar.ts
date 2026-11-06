import { getProductName } from '@/lib/config/product';

const SAFE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const SAFE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB limit to prevent memory exhaustion

/**
 * SSRF Guard: Validates that an avatar URL is an external HTTPS URL and
 * does not point to internal networks, localhost, link-local, or cloud metadata.
 */
export function isSafeAvatarUrl(urlStr: string): URL | null {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
      return null;
    }
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [, o1, o2] = ipv4.map(Number);
      if (o1 === 127 || o1 === 10 || o1 === 0 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168) || (o1 === 169 && o2 === 254)) {
        return null;
      }
    }
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:') || host.startsWith('::ffff:')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function resolveProfileAvatarDataUrl(
  fileId: string | null | undefined
): Promise<string | null> {
  const id = String(fileId || '').trim();
  if (!id) return null;
  try {
    if (id.startsWith('data:')) {
      return SAFE_DATA_URL_RE.test(id) ? id : null;
    }
    const safeUrl = isSafeAvatarUrl(id);
    if (safeUrl) {
      const res = await fetch(safeUrl.href, { signal: AbortSignal.timeout(4000) });
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const cl = Number(res.headers.get('content-length') || 0);
      if (res.ok && SAFE_IMAGE_MIMES.has(ct) && cl <= MAX_AVATAR_BYTES) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength <= MAX_AVATAR_BYTES) {
          return `data:${ct};base64,${buf.toString('base64')}`;
        }
      }
      return null;
    }
    // Storage bucket-based avatars are no longer supported
    return null;
  } catch {
    return null;
  }
}

export async function resolveOwnerForOg(userId: string | null | undefined): Promise<{
  ownerName: string;
  ownerAvatarDataUrl: string | null;
}> {
  const id = String(userId || '').trim();
  const fallbackOwner = getProductName();
  if (!id) {
    return { ownerName: fallbackOwner, ownerAvatarDataUrl: null };
  }
  try {
    const { UsersService } = await import('@/lib/services/users');
    const profile = await UsersService.getProfileById(id);
    if (!profile) {
      return { ownerName: fallbackOwner, ownerAvatarDataUrl: null };
    }
    const ownerName =
      profile.displayName ||
      profile.name ||
      (profile.username ? `@${profile.username}` : null) ||
      fallbackOwner;
    const ownerAvatarDataUrl = await resolveProfileAvatarDataUrl(
      profile.avatar || profile.profilePicId || null
    );
    return { ownerName, ownerAvatarDataUrl };
  } catch {
    return { ownerName: fallbackOwner, ownerAvatarDataUrl: null };
  }
}
