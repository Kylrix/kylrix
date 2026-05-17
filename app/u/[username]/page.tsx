import { Profile } from '@/components/profile/Profile';
import { Container } from '@mui/material';

export default function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <Container maxWidth="lg" sx={{ py: 3, pointerEvents: 'auto' }}>
      <Profile username={params.username} />
    </Container>
  );
}
