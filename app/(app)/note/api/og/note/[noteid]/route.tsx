import { ImageResponse } from 'next/og';
import { validatePublicNoteAccess } from '@/lib/appwrite';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteid: string }> }
) {
  try {
    const { noteid } = await params;
    const note = await validatePublicNoteAccess(noteid);

    if (!note) {
      return new Response('Note not found', { status: 404 });
    }

    // Helper functions to get preview text from content if title is missing
    const stripMarkdown = (md?: string) => {
       if (!md) return '';
       let text = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
       text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
       text = text.replace(/```[\s\S]*?```/g, '');
       text = text.replace(/`[^`]*`/g, '');
       text = text.replace(/^[#>\-\*\+]{1,}\s?/gm, '');
       text = text.replace(/[\*\_\~\#\>]/g, '');
       text = text.replace(/\s+/g, ' ').trim();
       return text;
    };

    const firstParagraph = (md?: string) => {
       const plain = stripMarkdown(md);
       if (!plain) return '';
       const paras = plain.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
       if (paras.length) return paras[0];
       const lines = plain.split(/\n/).map(l => l.trim()).filter(Boolean);
       return lines[0] || plain;
    };

    const smartTruncate = (s: string | undefined, n: number) => {
       if (!s) return '...';
       const cleaned = s.trim();
       // Always end in ellipses as requested
       if (cleaned.length <= n) return cleaned + '...';
       let truncated = cleaned.slice(0, n);
       const lastSpace = truncated.lastIndexOf(' ');
       if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
       return truncated.trim() + '...';
    };

    const title = note.title && note.title.trim() 
      ? smartTruncate(note.title.trim(), 50) 
      : smartTruncate(firstParagraph(note.content || undefined), 50);
    
    const tags = ((note as any).tags || []) as string[];
    
    const date = new Date(note.$createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #141414 0%, #000000 100%)',
            padding: '100px',
            position: 'relative',
          }}
        >
          {/* Decorative Teal Glow in background */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '800px',
              height: '800px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 240, 255, 0.05) 0%, rgba(0, 240, 255, 0) 70%)',
              filter: 'blur(100px)',
            }}
          />

          {/* Simple Secondary Text instead of logo */}
          <div
            style={{
              position: 'absolute',
              top: 60,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: '#404040',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: 'sans-serif',
              }}
            >
              Kylrix Note • Protected Note
            </span>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              zIndex: 10,
              maxWidth: '900px',
            }}
          >
            <h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: '#F2F2F2',
                lineHeight: 1.2,
                marginBottom: '40px',
                letterSpacing: '-0.04em',
                fontFamily: 'sans-serif',
                wordBreak: 'break-word',
              }}
            >
              {title}
            </h1>

            {/* Date and Security Metadata */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#A1A1AA',
                fontSize: 24,
                fontFamily: 'sans-serif',
                marginBottom: tags.length > 0 ? '40px' : '0',
              }}
            >
              <span>{date}</span>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#00F0FF',
                  margin: '0 20px',
                }}
              />
              <span style={{ color: '#00F0FF', opacity: 0.9 }}>Encrypted</span>
            </div>

            {/* Tags (Optional) */}
            {tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '12px',
                }}
              >
                {tags.slice(0, 3).map((tag) => (
                  <div
                    key={tag}
                    style={{
                      padding: '6px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '100px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F2F2F2',
                      fontSize: 18,
                      fontWeight: 500,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    #{tag}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtle bottom detail */}
          <div
            style={{
              position: 'absolute',
              bottom: 60,
              color: '#141414',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              letterSpacing: '0.5em',
            }}
          >
            THE GLASS MONOLITH
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
