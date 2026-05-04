import { NextResponse, NextRequest } from 'next/server';
import { Client, Databases, Query } from 'appwrite';
import { createRateLimiter } from '@/lib/rate-limit-middleware';
import { TargetType } from '@/types/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const rateLimiter = createRateLimiter({
  max: 20,
  windowMs: 60 * 1000,
});

const APPWRITE_ENDPOINT = APPWRITE_CONFIG.ENDPOINT;
const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;
const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

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

  const searchParams = req.nextUrl.searchParams;
  const targetId = searchParams.get('targetId') || noteid;
  const targetType = searchParams.get('targetType') || TargetType.NOTE;

  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);
    
    

    const databases = new Databases(client);

    // 1. Verify note is public
    const note = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      noteid
    );

    if (!note || !note.isPublic) {
      return NextResponse.json({ error: 'Note not found or not public' }, { status: 404 });
    }

    // 2. Fetch reactions for the specific target
    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_REACTIONS,
      [
        Query.equal('targetType', targetType),
        Query.equal('targetId', targetId),
        Query.orderAsc('createdAt'),
        Query.limit(500),
      ]
    );

    return NextResponse.json({ documents: res.documents });
  } catch (error: any) {
    console.error('Error fetching shared reactions:', error);
    return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 });
  }
}