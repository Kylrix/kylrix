import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';
import { getProductName } from '@/lib/config/product';

export const alt = 'Kylrix Shared Note';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const revalidate = 86400;

function stripPreview(content: string): string {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^[#>\-\*\+]{1}\s?/gm, '')
    .replace(/[\*\_\~\#\>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best-effort first image from body objects / attachments. Never throws. */
async function resolveOptionalPreviewImage(_note: any, _isEncrypted: boolean): Promise<string | null> {
  // File storage removed — no attachment preview images
  return null;
}

export default async function SharedNoteOGImage({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const productName = getProductName();
  let noteTitle = 'Shared Note';
  let noteDesc = `View this secure shared note on ${productName}.`;
  let isEncrypted = false;
  let dateText = '';
  let tags: string[] = [];
  let previewImageDataUrl: string | null = null;
  let ownerName = productName;
  let ownerAvatarDataUrl: string | null = null;

  try {
    const note = await validatePublicNoteAccess(id);
    if (note) {
      let meta: any = {};
      try {
        meta = JSON.parse(note.metadata || '{}');
      } catch {}
      isEncrypted = !!note.dek || meta.isEncrypted === true;
      noteTitle = note.title || 'Untitled Note';

      if (isEncrypted) {
        noteDesc = 'Protected note — unlock to read.';
      } else if (note.content) {
        const clean = stripPreview(note.content);
        noteDesc = clean.slice(0, 110) + (clean.length > 110 ? '...' : '');
        previewImageDataUrl = await resolveOptionalPreviewImage(note, false);
      }

      tags = ((note as any).tags || []) as string[];
      if (note.$createdAt) {
        dateText = new Date(note.$createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'});
      }

      const owner = await resolveOwnerForOg(note.userId);
      ownerName = owner.ownerName;
      ownerAvatarDataUrl = owner.ownerAvatarDataUrl;
    }
  } catch (err) {
    console.error('[SharedNoteOGImage] Failed to fetch note:', err);
  }

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Note',
      eyebrow: isEncrypted ? 'Protected note' : 'Shared note',
      title: noteTitle,
      description: noteDesc,
      accent: 'indigo',
      ownerName,
      ownerAvatarDataUrl,
      chips: [dateText, ...tags].filter(Boolean).slice(0, 3),
      cardType: 'object',
      objectIcon: isEncrypted ? 'vault' : 'idea',
      objectColor: isEncrypted ? '#10B981' : '#EC4899',
      mediaDataUrl: previewImageDataUrl,
      previewImageDataUrl,
      previewImageAlt: noteTitle}),
    { ...size }
  );
}
