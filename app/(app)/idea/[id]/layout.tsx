import type { Metadata } from 'next';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const note = await validatePublicNoteAccess(id);

    if (!note) {
      return {
        title: 'Shared Note · Kylrix',
        description: 'View this shared note securely.',
      };
    }

    let meta: any = {};
    try {
      meta = JSON.parse(note.metadata || '{}');
    } catch {}
    const isEncrypted = note.isEncrypted === true || meta.isEncrypted === true;

    const titleText = note.title?.trim() || 'Shared Note';
    const title = isEncrypted ? 'Protected Note · Kylrix' : `${titleText} · Kylrix`;
    const description = isEncrypted
      ? 'This note is secure and password-protected.'
      : (note.content || 'View this note shared securely via Kylrix.').slice(0, 160).trim() +
        ((note.content || '').length > 160 ? '…' : '');

    // Relative path — same pattern as goals. Next injects the working hashed
    // opengraph-image-* URL. Absolute `/opengraph-image` is swallowed by [[...key]].
    const previewImage = `/idea/${id}/opengraph-image?v=${encodeURIComponent(
      note.updatedAt || note.$updatedAt || note.$id || id
    )}`;

    return buildOgMetadata({ title, description, imageUrl: previewImage });
  } catch {
    return {
      title: 'Shared Note · Kylrix',
      description: 'View shared notes securely.',
    };
  }
}

export default function IdeaShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
