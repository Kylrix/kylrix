'use client';

import { useEffect, useMemo } from 'react';
import { Container } from '@mui/material';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Feed } from '@/components/social/Feed';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const composeIntent = useMemo(() => {
    if (searchParams.get('compose') !== '1') return null;
    const noteId = String(searchParams.get('noteId') || '').trim();
    if (!noteId) return null;
    return {
      noteId,
      noteTitle: String(searchParams.get('noteTitle') || '').trim(),
      noteLink: String(searchParams.get('noteLink') || '').trim(),
      draftText: String(searchParams.get('draftText') || '').trim(),
    };
  }, [searchParams]);

  useEffect(() => {
    if (!composeIntent) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    params.delete('noteId');
    params.delete('noteTitle');
    params.delete('noteLink');
    params.delete('draftText');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [composeIntent, pathname, router, searchParams]);

  return (
    <ConnectAppShell>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Feed view="personal" composeIntent={composeIntent} />
      </Container>
    </ConnectAppShell>
  );
}
