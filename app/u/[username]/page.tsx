import type { Metadata } from 'next';
import { Profile } from '@/components/profile/ProfileRedesign';
import { UsersService } from '@/lib/services/users';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  try {
    const { username } = await params;
    const profile = await UsersService.getProfile(username);

    if (!profile) {
      return buildOgMetadata({
        title: `@${username} · Kylrix`,
        description: `View @${username}'s profile on Kylrix.`,
        imageUrl: `/u/${username}/opengraph-image`});
    }

    const displayName = profile.displayName || profile.username || username;
    const bioText = profile.bio
      ? profile.bio.substring(0, 120).trim() + (profile.bio.length > 120 ? '…' : '')
      : `View @${username}'s profile on Kylrix.`;
    const handle = profile.username || username;
    const previewImage = `/u/${handle}/opengraph-image?v=${encodeURIComponent(
      profile.$updatedAt || profile.avatar || handle
    )}`;

    return buildOgMetadata({
      title: `${displayName} (@${handle}) · Kylrix`,
      description: bioText,
      imageUrl: previewImage});
  } catch (error) {
    console.error('Error generating profile metadata:', error);
    return {
      title: 'Kylrix User Profile',
      description: 'Connect and view profiles on Kylrix.'};
  }
}

export default async function UserProfilePage({
  params}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await UsersService.getProfile(username);

  return (
    <div className="w-full pointer-events-auto">
      <Profile
        username={username}
        initialProfile={profile ? JSON.parse(JSON.stringify(profile)) : null}
      />
    </div>
  );
}
