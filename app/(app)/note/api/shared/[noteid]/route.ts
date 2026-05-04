import { NextResponse, NextRequest } from 'next/server';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { createRateLimiter } from '@/lib/rate-limit-middleware';

const rateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 1000, // 10 requests per minute
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ noteid: string }> }) {
  const { noteid } = await params;
  const { allowed, retryAfter } = rateLimiter(req);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter?.toString() || '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const note = await validatePublicNoteAccess(noteid);

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found or not public' },
        { status: 404 }
      );
    }

    return NextResponse.json(note);
  } catch (error: any) {
    console.error('Error fetching shared note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}
