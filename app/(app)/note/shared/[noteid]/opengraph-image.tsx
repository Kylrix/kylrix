import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { UsersService } from '@/lib/services/users';
import { parseSendGhostMetadata } from '@/lib/send/metadata';

export const alt = 'Kylrix Shared Note';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function SharedNoteOGImage(props: { 
  params: Promise<{ noteid: string }>;
  searchParams?: Promise<{ key?: string }>;
}) {
  const params = await props.params;
  const noteId = params.noteid;
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
        // Strip markdown and get a clean preview
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

  // Draw a premium OpenBricks 3.0 note card
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
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow ambient background spotlight - Note specific (Teal/Pink) */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            right: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand Command Line Indicator */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #EC4899 0%, #818CF8 50%, #6366F1 100%)',
          }}
        />

        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Official wireframe cube logo SVG */}
            <svg
              viewBox="0 0 100 100"
              width="38"
              height="38"
              fill="none"
              style={{ display: 'flex' }}
            >
              <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" />

              <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" />

              <circle cx="50" cy="10" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="15" cy="30" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="85" cy="30" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="15" cy="70" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="50" cy="90" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="85" cy="70" r="5" fill="#6366F1" stroke="#000000" strokeWidth="1.8" />
              <circle cx="50" cy="50" r="7" fill="#6366F1" stroke="#000000" strokeWidth="2.2" />
            </svg>
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              KYLRIX
            </span>
          </div>

          {/* Visibility/Type pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 30,
              background: isEncrypted ? 'rgba(168, 85, 247, 0.1)' : 'rgba(236, 72, 153, 0.1)',
              border: `1px solid ${isEncrypted ? 'rgba(168, 85, 247, 0.2)' : 'rgba(236, 72, 153, 0.2)'}`,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: isEncrypted ? '#A855F7' : '#EC4899',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {isEncrypted ? 'Protected Note' : 'Shared Note'}
            </span>
          </div>
        </div>

        {/* Main Details Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 40,
            marginBottom: 40,
            maxWidth: '90%',
          }}
        >
          <h1
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: '#FFFFFF',
              margin: 0,
              padding: 0,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            {noteTitle}
          </h1>

          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
              padding: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              overflow: 'hidden',
            }}
          >
            {noteDesc}
          </p>
        </div>

        {/* Footer Meta Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: 30,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Avatar or Placeholder */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#161412',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EC4899',
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {ownerName.replace(/^@/, '').slice(0, 1).toUpperCase()}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared By
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {ownerName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {dateText && (
              <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255, 255, 255, 0.3)' }}>
                {dateText}
              </span>
            )}
            <span style={{ fontSize: 15, fontWeight: 800, color: '#EC4899', letterSpacing: '0.05em' }}>
              kylrix.space
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
