import type { Metadata } from 'next';
import NoteEditorPageClient from './NoteEditorPageClient';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { parseSendGhostMetadata } from '@/lib/send/metadata';
import { createServerClient } from '@/lib/appwrite/server';
import { redirect } from 'next/navigation';

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
        title: 'Idea · Kylrix',
        description: 'View and collaborate on this idea securely.',
        openGraph: {
          title: 'Idea · Kylrix',
          description: 'View and collaborate on this idea securely.',
          images: [{ url: fallbackImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Idea · Kylrix',
          description: 'View and collaborate on this idea securely.',
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
          title: 'Protected Idea · Kylrix',
          description: 'This idea is secure and password-protected.',
          openGraph: {
            title: 'Protected Idea · Kylrix',
            description: 'This idea is secure and password-protected.',
            images: [{ url: `/app/${id}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Idea · Kylrix',
            description: 'This idea is secure and password-protected.',
            images: [`/app/${id}/opengraph-image`],
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
          title: 'Protected Idea · Kylrix',
          description: 'This idea is secure and password-protected.',
          openGraph: {
            title: 'Protected Idea · Kylrix',
            description: 'This idea is secure and password-protected.',
            images: [{ url: `/app/${id}/opengraph-image`, width: 1200, height: 630 }],
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Protected Idea · Kylrix',
            description: 'This idea is secure and password-protected.',
            images: [`/app/${id}/opengraph-image`],
          },
        };
      }
    }

    const titleText = decryptedTitle || 'Shared Idea';
    const displayTitle = `${titleText} · Kylrix`;
    const displayDesc = decryptedContent
      ? decryptedContent.substring(0, 160).trim() + '…'
      : 'View this idea shared securely via Kylrix Idea.';
    const ogImage = `/app/${id}/opengraph-image${key ? `?key=${encodeURIComponent(key)}` : ''}`;

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
    console.error('Error generating metadata for Idea:', error);
    const fallbackImage = 'https://kylrix.space/logo_social.png';
    return {
      title: 'Idea · Kylrix',
      description: 'View ideas securely.',
      openGraph: {
        title: 'Idea · Kylrix',
        description: 'View ideas securely.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Idea · Kylrix',
        description: 'View ideas securely.',
        images: [fallbackImage],
      },
    };
  }
}

export default async function IdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;

  const publicNote = await validatePublicNoteAccess(id);
  if (publicNote) {
    try {
      const { account } = await createServerClient();
      const user = await account.get();
      const isOwner = user?.$id && publicNote.userId === user.$id;
      if (!isOwner) {
        redirect(`/idea/${id}${key ? `/${key}` : ''}`);
      }
    } catch {
      redirect(`/idea/${id}${key ? `/${key}` : ''}`);
    }
  }

  return <NoteEditorPageClient />;
}
