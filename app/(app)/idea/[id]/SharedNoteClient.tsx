'use client';

/**
 * SharedNoteClient — Thin delegator to IdeaPageClient.
 *
 * This component previously contained a large monolithic UI. It now delegates
 * entirely to IdeaPageClient, which handles permission resolution and renders
 * the appropriate experience based on the viewer's access level.
 */

import IdeaPageClient from '@/app/(app)/idea/[id]/IdeaPageClient';

interface SharedNoteClientProps {
  noteId: string;
  initialKey?: string;
}

export default function SharedNoteClient({ noteId, initialKey }: SharedNoteClientProps) {
  return <IdeaPageClient noteId={noteId} decryptionKey={initialKey} />;
}
