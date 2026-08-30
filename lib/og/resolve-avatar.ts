import { getProductName } from '@/lib/config/product';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export async function resolveProfileAvatarDataUrl(
  fileId: string | null | undefined
): Promise<string | null> {
  const id = String(fileId || '').trim();
  if (!id) return null;
  try {
    const { storage } = await import('@/lib/appwrite-admin').then((m) => m.createSystemClient());
    const fileBuffer = await storage.getFilePreview(
      APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES,
      id,
      256,
      256
    );
    return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
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
