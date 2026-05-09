import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Profile } from '@/components/profile/Profile';
import { Container } from '@mui/material';

export default function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <ConnectAppShell>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Profile username={params.username} />
      </Container>
    </ConnectAppShell>
  );
}
