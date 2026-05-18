import { Profile } from '@/components/profile/ProfileRedesign';
import { Box } from '@mui/material';

export default function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <Box sx={{ width: '100%', pointerEvents: 'auto' }}>
      <Profile username={params.username} />
    </Box>
  );
}
