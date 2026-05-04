'use client';

import { Container } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';
import { Feed } from '@/components/social/Feed';

export default function Home() {
  return (
    <AppShell>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Feed view="personal" />
      </Container>
    </AppShell>
  );
}
