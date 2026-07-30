import { ImageResponse } from 'next/og';
import { UsersService } from '@/lib/services/users';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveProfileAvatarDataUrl } from '@/lib/og/resolve-avatar';

export const alt = 'Kylrix User Profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function UserProfileOGImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let displayName = username;
  let bioText = 'View this profile on Kylrix.';
  let avatarDataUrl: string | null = null;
  let chips: string[] = [`@${username}`];

  try {
    const profile = await UsersService.getProfile(username);
    if (profile) {
      displayName = profile.displayName || profile.username || username;
      bioText = profile.bio || `Connect with @${username} on Kylrix.`;
      try {
        const prefs =
          typeof profile.preferences === 'string'
            ? JSON.parse(profile.preferences)
            : profile.preferences || {};
        const tags = (prefs.tags || profile.tags || []) as string[];
        const tagChips = tags.slice(0, 2).map((t) => `#${t}`);
        chips = [`@${username}`, ...tagChips];
        if (prefs.tipEnabled) chips = ['Tips on', ...chips].slice(0, 3);
      } catch {
        /* ignore */
      }
      avatarDataUrl = await resolveProfileAvatarDataUrl(
        profile.avatar || profile.profilePicId || null
      );
    }
  } catch (err) {
    console.error('[UserProfileOGImage] Failed to fetch profile:', err);
  }

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Connect',
      eyebrow: 'Profile',
      title: displayName,
      description: bioText,
      accent: 'indigo',
      ownerLabel: 'Profile',
      ownerName: `@${username}`,
      ownerAvatarDataUrl: avatarDataUrl,
      chips,
    }),
    { ...size }
  );
}
