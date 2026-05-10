'use client';

import { useParams } from 'next/navigation';
import { SendReceiveClient } from '@/components/send/SendReceiveClient';

export default function SendReceivePage() {
  const params = useParams();
  const noteId = typeof params?.noteId === 'string' ? params.noteId : '';
  const rawKey = params?.key;
  const keyParam = Array.isArray(rawKey) ? rawKey.join('/') : typeof rawKey === 'string' ? rawKey : undefined;

  if (!noteId) return null;

  return <SendReceiveClient noteId={noteId} keyParam={keyParam} />;
}
