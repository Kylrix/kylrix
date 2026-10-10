import { getProductName } from '@/lib/config/product';

export async function resolveProfileAvatarDataUrl(
  fileId: string | null | undefined
): Promise<string | null> {
  const id = String(fileId || '').trim();
  if (!id) return null;
  try {
    if (id.startsWith('data:')) return id;
    if (id.startsWith('http://') || id.startsWith('https://')) {
      const res = await fetch(id);
      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/png';
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:${ct};base64,${buf.toString('base64')}`;
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
