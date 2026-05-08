import { NextResponse, NextRequest } from 'next/server';
import { validatePublicNoteAccess } from '@/lib/appwrite';
import { createRateLimiter } from '@/lib/rate-limit-middleware';
import { createAdminClient } from '@/lib/appwrite-admin';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';

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

    // Secure stale-huddle cleanup: if this public note references a call that already expired,
    // remove that call row immediately via server SDK so clients do not join dead sessions.
    const extractHuddleCallId = (input: any): string | null => {
      const direct = String(input?.huddleCallId || '').trim();
      if (direct) return direct;
      try {
        const metadata = JSON.parse(String(input?.metadata || '{}'));
        const fromMeta = String(metadata?.huddleCallId || '').trim();
        return fromMeta || null;
      } catch {
        return null;
      }
    };

    const huddleCallId = extractHuddleCallId(note as any);
    if (huddleCallId) {
      try {
        const { databases } = createAdminClient();
        await deleteCallIfExpired(databases as any, huddleCallId);
      } catch (cleanupError) {
        console.warn('[Shared Note] stale call cleanup skipped:', cleanupError);
      }
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
