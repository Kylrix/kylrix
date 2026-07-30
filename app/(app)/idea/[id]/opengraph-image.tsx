import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { UsersService } from '@/lib/services/users';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const alt = 'Kylrix Shared Note';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

type ImageSourceCandidate =
  | { kind: 'remote-url'; url: string }
  | { kind: 'storage-file'; bucketId: string; fileId: string };

function isImageLikeMime(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('image/');
}

function isImageLikeFilename(value: unknown): boolean {
  return typeof value === 'string' && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(value);
}

function extractFirstImageCandidateFromContent(content: string): ImageSourceCandidate | null {
  if (!content) return null;

  const mdImageRegex = /!\[.*?\]\((.*?)\)/;
  const mdMatch = content.match(mdImageRegex);
  if (mdMatch?.[1]) {
    return { kind: 'remote-url', url: mdMatch[1] };
  }

  const htmlImgRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
  const htmlMatch = content.match(htmlImgRegex);
  if (htmlMatch?.[1]) {
    return { kind: 'remote-url', url: htmlMatch[1] };
  }

  const objectBlockRegex = /\[\[kylrix-object:(\{.*?\})\]\]/g;
  let objMatch: RegExpExecArray | null;
  while ((objMatch = objectBlockRegex.exec(content)) !== null) {
    try {
      const payload = JSON.parse(objMatch[1]);
      const objectLooksLikeImage =
        payload?.childKind === 'image' ||
        payload?.type === 'image' ||
        isImageLikeMime(payload?.mimeType) ||
        isImageLikeMime(payload?.metadata?.mimeType) ||
        isImageLikeFilename(payload?.metadata?.fileName);

      if (!objectLooksLikeImage) continue;

      const fileUrl = payload?.metadata?.fileUrl || payload?.src || payload?.url;
      if (typeof fileUrl === 'string' && fileUrl.trim()) {
        return { kind: 'remote-url', url: fileUrl };
      }

      if (payload?.childId && payload?.bucketId) {
        return {
          kind: 'storage-file',
          bucketId: String(payload.bucketId),
          fileId: String(payload.childId),
        };
      }
    } catch {}
  }

  return null;
}

function extractFirstImageCandidateFromAttachments(attachments: unknown): ImageSourceCandidate | null {
  if (!Array.isArray(attachments)) return null;

  for (const entry of attachments) {
    try {
      const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
      const mime = parsed?.mimeType || parsed?.mime;
      const name = parsed?.fileName || parsed?.name;
      const fileUrl = parsed?.fileUrl || parsed?.url;
      const fileId = parsed?.fileId || parsed?.id || parsed?.$id;
      const bucketId = parsed?.bucketId || APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;

      if (!isImageLikeMime(mime) && !isImageLikeFilename(name)) continue;

      if (typeof fileUrl === 'string' && fileUrl.trim()) {
        return { kind: 'remote-url', url: fileUrl };
      }

      if (typeof fileId === 'string' && fileId.trim()) {
        return {
          kind: 'storage-file',
          bucketId: String(bucketId),
          fileId: fileId,
        };
      }
    } catch {}
  }

  return null;
}

async function resolveCandidateToDataUrl(candidate: ImageSourceCandidate | null): Promise<string | null> {
  if (!candidate) return null;

  try {
    if (candidate.kind === 'storage-file') {
      const { storage } = await import('@/lib/appwrite-admin').then((mod) => mod.createSystemClient());
      const fileBuffer = await storage.getFilePreview(candidate.bucketId, candidate.fileId, 1200, 630);
      return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
    }

    const imgRes = await fetch(candidate.url);
    if (!imgRes.ok) return null;
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentTypeHeader = imgRes.headers.get('content-type') || 'image/png';
    return `data:${contentTypeHeader};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.warn('Failed to resolve note preview image candidate:', e);
    return null;
  }
}

async function resolveProfileAvatarDataUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) return null;
  try {
    const { storage } = await import('@/lib/appwrite-admin').then((mod) => mod.createSystemClient());
    const fileBuffer = await storage.getFilePreview(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId, 128, 128);
    return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function SharedNoteOGImage(props: { 
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ key?: string }>;
}) {
  const params = await props.params;
  const noteId = params.id;
  const { key } = (await props.searchParams) || {};

  let noteTitle = 'Shared Note';
  let noteDesc = 'View this secure shared note on Kylrix.';
  let isEncrypted = false;
  let ownerName = 'Kylrix User';
  let ownerAvatarDataUrl: string | null = null;
  let dateText = '';
  let tags: string[] = [];
  let base64Image: string | null = null;

  try {
    const note = await validatePublicNoteAccess(noteId);

    if (note) {
      let meta: any = {};
      try {
        meta = JSON.parse(note.metadata || '{}');
      } catch {}
      isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;
      
      let rawTitle = note.title || 'Untitled Note';
      let rawContent = note.content || '';
      
      if (isEncrypted && key) {
        try {
          const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
          rawTitle = await decryptGhostData(rawTitle, key);
          rawContent = await decryptGhostData(rawContent, key);
          isEncrypted = false;
        } catch (err) {
          console.warn('Failed to decrypt note in OG image generation:', err);
        }
      }
      
      noteTitle = rawTitle;
      
      if (!isEncrypted && rawContent) {
        let cleanContent = rawContent
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/`[^`]*`/g, '')
          .replace(/^[#>\-\*\+]{1,}\s?/gm, '')
          .replace(/[\*\_\~\#\>]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        noteDesc = cleanContent.slice(0, 180);
        if (cleanContent.length > 180) noteDesc += '...';

        const contentImageCandidate = extractFirstImageCandidateFromContent(rawContent);
        const attachmentImageCandidate = extractFirstImageCandidateFromAttachments((note as any).attachments || []);
        base64Image = await resolveCandidateToDataUrl(contentImageCandidate || attachmentImageCandidate);
      } else if (isEncrypted) {
        noteDesc = 'This note is protected with end-to-end encryption. Unlock it to view the full content.';
      }

      tags = ((note as any).tags || []) as string[];
      
      if (note.$createdAt) {
        dateText = new Date(note.$createdAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }

      if (note.userId) {
        try {
          const ownerProfile = await UsersService.getProfileById(note.userId);
          if (ownerProfile) {
            ownerName = ownerProfile.displayName || ownerProfile.name || ownerProfile.username || ownerName;
            ownerAvatarDataUrl = await resolveProfileAvatarDataUrl(
              ownerProfile.avatar || ownerProfile.profilePicId || null
            );
          }
        } catch {}
      }
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
      chips: [dateText, ...tags].filter(Boolean),
      previewImageDataUrl: base64Image,
      previewImageAlt: noteTitle,
    }),
    { ...size }
  );
}
