import type { Metadata } from 'next';
import { Profile } from '@/components/profile/ProfileRedesign';
import { UsersService } from '@/lib/services/users';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  try {
    const { username } = await params;
    const cleanUsername = username ? username.replace(/^@/, '') : '';
    const profile = await UsersService.getProfile(cleanUsername);

    if (!profile) {
      return buildOgMetadata({
        title: `@${cleanUsername} · Kylrix`,
        description: `View @${cleanUsername}'s profile on Kylrix.`,
        imageUrl: `/u/${cleanUsername}/opengraph-image`,
      });
    }

    const displayName = profile.displayName || profile.username || cleanUsername;
    const bioText = profile.bio
      ? profile.bio.substring(0, 120).trim() + (profile.bio.length > 120 ? '…' : '')
      : `View @${cleanUsername}'s profile on Kylrix.`;
    const handle = profile.username || cleanUsername;
    const previewImage = `/u/${handle}/opengraph-image?v=${encodeURIComponent(
      profile.updatedAt || profile.avatar || handle
    )}`;

    return buildOgMetadata({
      title: `${displayName} (@${handle}) · Kylrix`,
      description: bioText,
      imageUrl: previewImage,
    });
  } catch (error) {
    console.error('Error generating profile metadata:', error);
    return {
      title: 'Kylrix User Profile',
      description: 'Connect and view profiles on Kylrix.',
    };
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const cleanUsername = username ? username.replace(/^@/, '') : '';
  const profile = await UsersService.getProfile(cleanUsername);

  return (
    <div className="w-full min-h-screen bg-[#161412] text-white pointer-events-auto">
      <Profile
        username={cleanUsername}
        initialProfile={profile ? JSON.parse(JSON.stringify(profile)) : null}
        isPage
      />
    </div>
  );
}
