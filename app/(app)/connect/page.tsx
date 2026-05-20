'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Container } from '@mui/material';
import { Feed } from '@/components/social/Feed';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MessageSquare, Phone, Plus } from 'lucide-react';

function ConnectHomeContent() {
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
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      actions: [
        { id: 'chat', label: 'NEW CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat') },
        { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
        { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') },
      ]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, openUnified]);

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
    <Container maxWidth="md" sx={{ py: 2, pointerEvents: 'auto' }}>
      <Feed view="personal" composeIntent={composeIntent} />
    </Container>
  );
}

export default function Home() {
  return (
      <Suspense
        fallback={
          <Container maxWidth="md" sx={{ py: 2 }}>
            <Feed view="personal" composeIntent={null} />
          </Container>
        }
      >
        <ConnectHomeContent />
      </Suspense>
  );
}
