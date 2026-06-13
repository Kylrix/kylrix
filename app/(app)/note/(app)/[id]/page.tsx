import type { Metadata } from 'next';
import NoteEditorPageClient from './NoteEditorPageClient';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { parseSendGhostMetadata } from '@/lib/send/metadata';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const { key } = await searchParams;

    const note = await validatePublicNoteAccess(id);
    const fallbackImage = 'https://kylrix.space/logo_social.png';

    if (!note) {
      return {
        title: 'Note · Kylrix',
        description: 'View and collaborate on this note securely.',
        openGraph: {
          title: 'Note · Kylrix',
          description: 'View and collaborate on this note securely.',
          images: [{ url: fallbackImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Note · Kylrix',
          description: 'View and collaborate on this note securely.',
          images: [fallbackImage],
        },
      };
    }

    const meta = parseSendGhostMetadata(note.metadata);
    let decryptedTitle = note.title || '';
    let decryptedContent = note.content || '';
    const isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;

    if (isEncrypted) {
      if (!key) {
        return {
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          openGraph: {
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [{ url: `/note/${id}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [`/note/${id}/opengraph-image`],
          },
        };
      }
      try {
        const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        decryptedTitle = await decryptGhostData(note.title || '', key);
        decryptedContent = await decryptGhostData(note.content || '', key);
      } catch (err) {
        console.warn('Failed server-side decryption of note metadata preview:', err);
        return {
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          openGraph: {
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [{ url: `/note/${id}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [`/note/${id}/opengraph-image`],
          },
        };
      }
    }

    const titleText = decryptedTitle || 'Shared Note';
    const displayTitle = `${titleText} · Kylrix`;
    const displayDesc = decryptedContent
      ? decryptedContent.substring(0, 160).trim() + '…'
      : 'View this note shared securely via Kylrix Note.';
    const ogImage = `/note/${id}/opengraph-image${key ? `?key=${encodeURIComponent(key)}` : ''}`;

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
    console.error('Error generating metadata for Note:', error);
    const fallbackImage = 'https://kylrix.space/logo_social.png';
    return {
      title: 'Note · Kylrix',
      description: 'View notes securely.',
      openGraph: {
        title: 'Note · Kylrix',
        description: 'View notes securely.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Note · Kylrix',
        description: 'View notes securely.',
        images: [fallbackImage],
      },
    };
  }
}

export default function NotePage() {
  return <NoteEditorPageClient />;
}
