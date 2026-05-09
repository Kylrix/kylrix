'use client';

import { useEffect, useMemo, useState } from 'react';
import { Container } from '@mui/material';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Feed } from '@/components/social/Feed';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [composeIntent, setComposeIntent] = useState<{
    noteId: string;
    noteTitle?: string;
    noteContent?: string;
    noteLink?: string;
    draftText?: string;
  } | null>(null);

  const shouldCompose = useMemo(() => searchParams.get('compose') === '1', [searchParams]);

  useEffect(() => {
    if (!shouldCompose) return;
    const queryNoteId = String(searchParams.get('noteId') || '').trim();
    let nextIntent: {
      noteId: string;
      noteTitle?: string;
      noteContent?: string;
      noteLink?: string;
      draftText?: string;
    } | null = null;

    if (queryNoteId) {
      nextIntent = {
        noteId: queryNoteId,
        noteTitle: String(searchParams.get('noteTitle') || '').trim(),
        noteContent: '',
        noteLink: String(searchParams.get('noteLink') || '').trim(),
        draftText: String(searchParams.get('draftText') || '').trim(),
      };
    } else if (typeof window !== 'undefined') {
      const raw = window.sessionStorage.getItem('kylrix:compose-note-intent');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            noteId?: string;
            noteTitle?: string;
            noteContent?: string;
            noteLink?: string;
            draftText?: string;
          };
          const noteId = String(parsed?.noteId || '').trim();
          if (noteId) {
            nextIntent = {
              noteId,
              noteTitle: String(parsed?.noteTitle || '').trim(),
              noteContent: String(parsed?.noteContent || '').trim(),
              noteLink: String(parsed?.noteLink || '').trim(),
              draftText: String(parsed?.draftText || '').trim(),
            };
          }
        } catch {}
        window.sessionStorage.removeItem('kylrix:compose-note-intent');
      }
    }

    if (nextIntent) setComposeIntent(nextIntent);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    params.delete('noteId');
    params.delete('noteTitle');
    params.delete('noteContent');
    params.delete('noteLink');
    params.delete('draftText');
    params.delete('composeKey');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams, shouldCompose]);

  return (
    <ConnectAppShell>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Feed view="personal" composeIntent={composeIntent} />
      </Container>
    </ConnectAppShell>
  );
}
