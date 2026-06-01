import type { Metadata } from 'next';
import { Profile } from '@/components/profile/ProfileRedesign';
import { Box } from '@mui/material';
import { UsersService } from '@/lib/services/users';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  try {
    const { username } = await params;
    const profile = await UsersService.getProfile(username);
    const fallbackImage = 'https://kylrix.space/logo_social.png';

    if (!profile) {
      return {
        title: `@${username} · Kylrix User`,
        description: `View @${username}'s profile on Kylrix.`,
        openGraph: {
          title: `@${username} · Kylrix User`,
          description: `View @${username}'s profile on Kylrix.`,
          images: [{ url: fallbackImage, width: 320, height: 320 }],
        },
        twitter: {
          card: 'summary',
          title: `@${username} · Kylrix User`,
          description: `View @${username}'s profile on Kylrix.`,
          images: [fallbackImage],
        },
      };
    }

    const displayName = profile.displayName || profile.username || username;
    const bioText = profile.bio ? profile.bio.substring(0, 160).trim() + '…' : `View @${username}'s profile on Kylrix.`;
    const avatarFileId = profile.avatar || profile.avatarFileId || null;
    let avatarUrl = fallbackImage;

    if (avatarFileId) {
      avatarUrl = `https://api.kylrix.space/v1/storage/buckets/profile_pictures/files/${avatarFileId}/view?project=67fe9627001d97e37ef3`;
    }

    return {
      title: `${displayName} (@${profile.username || username}) · Kylrix`,
      description: bioText,
      openGraph: {
        title: `${displayName} (@${profile.username || username}) · Kylrix`,
        description: bioText,
        type: 'profile',
        username: profile.username || username,
        images: [
          {
            url: avatarUrl,
            width: 320,
            height: 320,
            alt: `${displayName}'s avatar`,
          },
        ],
      },
      twitter: {
        card: 'summary',
        title: `${displayName} (@${profile.username || username}) · Kylrix`,
        description: bioText,
        images: [avatarUrl],
      },
    };
  } catch (error) {
    console.error('Error generating profile metadata:', error);
    return {
      title: 'Kylrix User Profile',
      description: 'Connect and view user profile on the sovereign agentic OS.',
    };
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  
  // Parallel Fetch: Profile data + Server-side session check (if needed)
  // For now, we fetch the profile to pre-hydrate the client component
  const profile = await UsersService.getProfile(username);
  
  return (
    <Box sx={{ width: '100%', pointerEvents: 'auto' }}>
      <Profile 
        username={username} 
        initialProfile={profile ? JSON.parse(JSON.stringify(profile)) : null} 
      />
    </Box>
  );
}
