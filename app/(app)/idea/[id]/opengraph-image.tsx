import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { UsersService } from '@/lib/services/users';
import { parseSendGhostMetadata } from '@/lib/send/metadata';

export const alt = 'Kylrix Shared Note';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

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
  let dateText = '';
  let tags: string[] = [];

  try {
    const note = await validatePublicNoteAccess(noteId);

    if (note) {
      const meta = parseSendGhostMetadata(note.metadata);
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
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('[SharedNoteOGImage] Failed to fetch note:', err);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: '#0A0908',
          color: '#ffffff',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontWeight: 900,
                fontSize: '18px',
              }}
            >
              K
            </div>
            <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.04em' }}>Kylrix</span>
          </div>
          {dateText && (
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              {dateText}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              maxWidth: '900px',
            }}
          >
            {noteTitle}
          </div>
          <div
            style={{
              fontSize: '20px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.5,
              maxWidth: '900px',
            }}
          >
            {noteDesc}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 800,
              }}
            >
              {ownerName.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>SHARED BY</span>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>{ownerName}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {tags.slice(0, 3).map((tag, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px solid rgba(99,102,241,0.1)',
                  color: '#6366F1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
