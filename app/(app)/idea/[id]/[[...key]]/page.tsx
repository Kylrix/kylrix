import React from 'react';
import { notFound } from 'next/navigation';
import SharedNoteClient from '../SharedNoteClient';

/**
 * Metadata / OG live on `idea/[id]/layout.tsx` + `opengraph-image.tsx`.
 * Do not regenerate OG here — absolute `/opengraph-image` URLs get swallowed
 * by this catch-all and break link previews (goals work because they have no catch-all).
 */
export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}) {
  const { id, key } = await params;
  const first = key?.[0] || '';
  // Defensive: never treat Next metadata image paths as decryption keys.
  if (first.startsWith('opengraph-image') || first.startsWith('twitter-image')) {
    notFound();
  }
  return <SharedNoteClient noteId={id} initialKey={key?.join('/') || undefined} />;
}
