import React from 'react';
import SharedNoteClient from '../SharedNoteClient';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}) {
  try {
    const { id, key } = await params;
    const note = await validatePublicNoteAccess(id);
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
    let meta: any = {};
    try {
      meta = JSON.parse(note.metadata || '{}');
    } catch {}
    let decryptedTitle = note.title || '';
    let decryptedContent = note.content || '';
    const isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URI || 'https://kylrix.space';

    if (isEncrypted) {
      if (!keyParam) {
        const encryptedOgUrl = `${baseUrl}/idea/${id}/opengraph-image`;
        return buildOgMetadata({
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          imageUrl: encryptedOgUrl,
        });
      }
      try {
        const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        decryptedTitle = await decryptGhostData(note.title || '', keyParam);
        decryptedContent = await decryptGhostData(note.content || '', keyParam);
      } catch (err) {
        console.warn('Failed server-side decryption of shared note metadata preview:', err);
        const encryptedOgUrl = `${baseUrl}/idea/${id}/opengraph-image`;
        return buildOgMetadata({
          title: 'Protected Note · Kylrix',
          description: 'This note is secure and password-protected.',
          imageUrl: encryptedOgUrl,
        });
      }
    }

    const titleText = decryptedTitle || 'Shared Note';
    const displayTitle = `${titleText} · Kylrix`;
    const displayDesc = decryptedContent
      ? decryptedContent.substring(0, 160).trim() + '…'
      : 'View this note shared securely via Kylrix Note.';
    const ogQuery = new URLSearchParams();
    if (keyParam) ogQuery.set('key', keyParam);
    ogQuery.set('v', note.updatedAt || note.$updatedAt || note.$id || id);
    const ogImage = `${baseUrl}/idea/${id}/opengraph-image?${ogQuery.toString()}`;

    return buildOgMetadata({ title: displayTitle, description: displayDesc, imageUrl: ogImage });
  } catch (error) {
    console.error('Error generating metadata for Shared Note:', error);
    return buildOgMetadata({
      title: 'Shared Note · Kylrix',
      description: 'View shared notes securely.',
      imageUrl: 'https://kylrix.space/opengraph-image',
    });
  }
}

export default async function SharedNotePage({ params }: { params: Promise<{ id: string; key?: string[] }> }) {
  const { id, key } = await params;
  return <SharedNoteClient noteId={id} initialKey={key?.join('/') || undefined} />;
}
