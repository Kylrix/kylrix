import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const alt = 'Kylrix Shared Note';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

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

function isImageLikeMime(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('image/');
}

function isImageLikeFilename(value: unknown): boolean {
  return typeof value === 'string' && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(value);
}

/** Best-effort first image from body objects / attachments. Never throws. */
async function resolveOptionalPreviewImage(note: any, isEncrypted: boolean): Promise<string | null> {
  if (isEncrypted) return null;
  try {
    const content = String(note?.content || '');
    const objectBlockRegex = /\[\[kylrix-object:(\{.*?\})\]\]/g;
    let objMatch: RegExpExecArray | null;
    while ((objMatch = objectBlockRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(objMatch[1]);
        const looksLikeImage =
          payload?.childKind === 'image' ||
          payload?.type === 'image' ||
          isImageLikeMime(payload?.mimeType) ||
          isImageLikeMime(payload?.metadata?.mimeType) ||
          isImageLikeFilename(payload?.metadata?.fileName);
        if (!looksLikeImage) continue;

        const fileUrl = payload?.metadata?.fileUrl || payload?.src || payload?.url;
        if (typeof fileUrl === 'string' && fileUrl.trim()) {
          const imgRes = await fetch(fileUrl);
          if (!imgRes.ok) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get('content-type') || 'image/png';
          return `data:${ct};base64,${buf.toString('base64')}`;
        }

        const fileId = payload?.childId;
        const bucketId = payload?.bucketId;
        if (fileId && bucketId) {
          const { storage } = await import('@/lib/appwrite-admin').then((m) => m.createSystemClient());
          const fileBuffer = await storage.getFilePreview(String(bucketId), String(fileId), 1200, 630);
          return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
        }
      } catch {
        /* try next */
      }
    }

    const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
    for (const entry of attachments) {
      try {
        const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
        const mime = parsed?.mimeType || parsed?.mime;
        const name = parsed?.fileName || parsed?.name;
        if (!isImageLikeMime(mime) && !isImageLikeFilename(name)) continue;

        const fileUrl = parsed?.fileUrl || parsed?.url;
        if (typeof fileUrl === 'string' && fileUrl.trim()) {
          const imgRes = await fetch(fileUrl);
          if (!imgRes.ok) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get('content-type') || 'image/png';
          return `data:${ct};base64,${buf.toString('base64')}`;
        }

        const fileId = parsed?.fileId || parsed?.id || parsed?.$id;
        if (!fileId) continue;
        const bucketId = parsed?.bucketId || APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;
        const { storage } = await import('@/lib/appwrite-admin').then((m) => m.createSystemClient());
        const fileBuffer = await storage.getFilePreview(String(bucketId), String(fileId), 1200, 630);
        return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* card still renders without preview image */
  }
  return null;
}

export default async function SharedNoteOGImage({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let noteTitle = 'Shared Note';
  let noteDesc = 'View this secure shared note on Kylrix.';
  let isEncrypted = false;
  let dateText = '';
  let tags: string[] = [];
  let previewImageDataUrl: string | null = null;
  let ownerName = 'Kylrix';
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
      previewImageDataUrl,
      previewImageAlt: noteTitle}),
    { ...size }
  );
}
