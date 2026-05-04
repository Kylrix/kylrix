import { NextResponse, NextRequest } from 'next/server';
import { Client, Databases, Query } from 'appwrite';
import { createRateLimiter } from '@/lib/rate-limit-middleware';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const rateLimiter = createRateLimiter({
  max: 30,
  windowMs: 60 * 1000,
});

const APPWRITE_ENDPOINT = APPWRITE_CONFIG.ENDPOINT;
const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;
const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const APPWRITE_TABLE_ID_PROFILES = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = rateLimiter(req);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter?.toString() || '60',
        },
      }
    );
  }

  try {
    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ documents: [] });
    }

    // Limit to 100 users per request for safety
    const targetIds = userIds.slice(0, 100);

    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);

    const databases = new Databases(client);

    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_PROFILES,
      [
        Query.equal('$id', targetIds),
        Query.limit(targetIds.length),
        Query.select(['$id', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey']),
      ]
    );

    // Filter sensitive fields if any (though Appwrite permissions should handle this, 
    // we want to be explicit about what we expose in a public-ish endpoint)
    const publicProfiles = res.documents.map(doc => ({
      $id: doc.$id,
      name: doc.displayName || doc.username,
      displayName: doc.displayName || null,
      username: doc.username,
      avatar: doc.avatar || null,
      bio: doc.bio || null,
      walletAddress: doc.walletAddress || null,
      publicKey: doc.publicKey || null,
      // Do NOT include email or other private data
    }));

    return NextResponse.json({ documents: publicProfiles });
  } catch (error: any) {
    console.error('Error fetching shared profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}
