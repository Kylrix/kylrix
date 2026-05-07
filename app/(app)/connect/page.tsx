'use client';

import { Container } from '@mui/material';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Feed } from '@/components/social/Feed';

export default function Home() {
  return (
    <ConnectAppShell>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Feed view="personal" />
      </Container>
    </ConnectAppShell>
  );
}
