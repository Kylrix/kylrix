import React from 'react';
import SharedNoteClient from '../SharedNoteClient';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { parseSendGhostMetadata } from '@/lib/send/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ noteid: string; key?: string[] }>;
}) {
  try {
    const { noteid } = await params;
    const note = await validatePublicNoteAccess(noteid);
    const fallbackImage = 'https://kylrix.space/logo_social.png';

    if (!note) {
      return {
        title: 'Shared Note · Kylrix',
        description: 'View this shared note securely.',
        openGraph: {
          title: 'Shared Note · Kylrix',
          description: 'View this shared note securely.',
          images: [{ url: fallbackImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Shared Note · Kylrix',
          description: 'View this shared note securely.',
          images: [fallbackImage],
        },
      };
    }

    const keyParam = key?.join('/') || undefined;
    const meta = parseSendGhostMetadata(note.metadata);
    let decryptedTitle = note.title || '';
    let decryptedContent = note.content || '';
    const isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;

    if (isEncrypted) {
      if (!keyParam) {
        return {
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          openGraph: {
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [{ url: `/note/shared/${noteid}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [`/note/shared/${noteid}/opengraph-image`],
          },
        };
      }
      try {
        const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        decryptedTitle = await decryptGhostData(note.title || '', keyParam);
        decryptedContent = await decryptGhostData(note.content || '', keyParam);
      } catch (err) {
        console.warn('Failed server-side decryption of shared note metadata preview:', err);
        return {
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          openGraph: {
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [{ url: `/note/shared/${noteid}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Note · Kylrix',
            description: 'This note is secure and password-protected.',
            images: [`/note/shared/${noteid}/opengraph-image`],
          },
        };
      }
    }

    const titleText = decryptedTitle || 'Shared Note';
    const displayTitle = `${titleText} · Kylrix`;
    const displayDesc = decryptedContent
      ? decryptedContent.substring(0, 160).trim() + '…'
      : 'View this note shared securely via Kylrix Note.';
    const ogImage = `/note/shared/${noteid}/opengraph-image${keyParam ? `?key=${encodeURIComponent(keyParam)}` : ''}`;

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
    console.error('Error generating metadata for Shared Note:', error);
    const fallbackImage = 'https://kylrix.space/logo_social.png';
    return {
      title: 'Shared Note · Kylrix',
      description: 'View shared notes securely.',
      openGraph: {
        title: 'Shared Note · Kylrix',
        description: 'View shared notes securely.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Shared Note · Kylrix',
        description: 'View shared notes securely.',
        images: [fallbackImage],
      },
    };
  }
}

export default async function SharedNotePage({ params }: { params: Promise<{ noteid: string; key?: string[] }> }) {
   const { noteid, key } = await params;
   return <SharedNoteClient noteId={noteid} initialKey={key?.join('/') || undefined} />;
}
