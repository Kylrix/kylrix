import { Profile } from '@/components/profile/ProfileRedesign';
import { Box } from '@mui/material';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Box sx={{ width: '100%', pointerEvents: 'auto' }}>
      <Profile username={resolvedParams.username} />
    </Box>
  );
}
