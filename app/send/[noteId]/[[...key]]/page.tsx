import type { Metadata } from 'next';
import { SendReceiveClient } from '@/components/send/SendReceiveClient';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { parseSendGhostMetadata } from '@/lib/send/metadata';
import { decryptGhostData } from '@/lib/encryption/ghost-crypto';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ noteId: string; key?: string[] }>;
}): Promise<Metadata> {
  try {
    const { noteId, key } = await params;
    const keyParam = key?.join('/') || undefined;

    const note = await validatePublicNoteAccess(noteId);
    if (!note) {
      return {
        title: 'Secure Sharing · Kylrix',
        description: 'View shared notes, files, passwords, and more securely.',
      };
    }

    const meta = parseSendGhostMetadata(note.metadata);
    
    let decryptedTitle = note.title || '';
    let decryptedContent = note.content || '';
    const isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;

    if (isEncrypted) {
      if (!keyParam) {
        return {
          title: 'Secure Shared Note · Kylrix',
          description: 'This is a private and secure note. Enter the key to view.',
        };
      }
      try {
        decryptedTitle = await decryptGhostData(note.title || '', keyParam);
        decryptedContent = await decryptGhostData(note.content || '', keyParam);
      } catch (err) {
        console.warn('Failed server-side decryption of send metadata preview:', err);
        return {
          title: 'Secure Shared Note · Kylrix',
          description: 'This is a private and secure note. Enter the key to view.',
        };
      }
    }

    const titleText = decryptedTitle || 'Shared Note';
    const kind = meta.send_object?.kind || 'note';

    let displayTitle = `${titleText} · Kylrix`;
    let displayDesc = decryptedContent
      ? decryptedContent.substring(0, 160).trim() + '…'
      : 'This is a secure note shared via Kylrix Send.';

    if (kind === 'file') {
      displayTitle = `Shared File: ${titleText} · Kylrix`;
      displayDesc = 'Download this file shared securely via Kylrix Send.';
    } else if (kind === 'task') {
      displayTitle = `Shared Task: ${titleText} · Kylrix`;
      displayDesc = decryptedContent
        ? decryptedContent.substring(0, 160).trim() + '…'
        : 'View this task shared securely via Kylrix Send.';
    }
    const ogImage = `https://kylrix.space/note/api/og/note/${noteId}`;

    return {
      title: displayTitle,
      description: displayDesc,
      openGraph: {
        title: displayTitle,
        description: displayDesc,
        type: 'article',
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: displayTitle,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: displayTitle,
        description: displayDesc,
        images: [ogImage],
      },
    };
  } catch (error) {
    console.error('Error generating metadata for Send:', error);
    const fallbackImage = 'https://kylrix.space/logo_social.png';
    return {
      title: 'Secure Sharing · Kylrix',
      description: 'View shared notes, files, passwords, and more securely.',
      openGraph: {
        title: 'Secure Sharing · Kylrix',
        description: 'View shared notes, files, passwords, and more securely.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Secure Sharing · Kylrix',
        description: 'View shared notes, files, passwords, and more securely.',
        images: [fallbackImage],
      },
    };
  }
}

export default async function SendReceivePage({
  params,
}: {
  params: Promise<{ noteId: string; key?: string[] }>;
}) {
  const { noteId, key } = await params;
  const keyParam = key?.join('/') || undefined;

  if (!noteId) return null;

  // Server-side pre-fetch for instant hydration
  const initialNote = await validatePublicNoteAccess(noteId);

  return (
    <SendReceiveClient 
      noteId={noteId} 
      keyParam={keyParam} 
      initialNote={initialNote ? JSON.parse(JSON.stringify(initialNote)) : null} 
    />
  );
}
