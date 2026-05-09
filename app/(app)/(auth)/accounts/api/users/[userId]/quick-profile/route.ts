import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

function normalizeUserId(value: string) {
  return String(value || '').trim();
}

async function getProfile(databases: ReturnType<typeof createAdminClient>['databases'], userId: string) {
  try {
    const byUserId = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    if (byUserId.documents[0]) return byUserId.documents[0];
  } catch {
    // fall through to row-id lookup
  }

  try {
    return await databases.getDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      userId
    );
  } catch {
    return null;
  }
}

async function getPublishedWallets(databases: ReturnType<typeof createAdminClient>['databases'], userId: string) {
  const ownerId = `user:${userId}`;
  const rows = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS,
    [
      Query.equal('ownerId', ownerId),
      Query.equal('type', 'main'),
      Query.limit(50),
      Query.select(['$id', 'chain', 'address', 'type', 'updatedAt', '$updatedAt']),
    ]
  );

  const dedupedByChain = new Map<string, any>();
  for (const row of rows.documents) {
    const chain = String((row as any).chain || '').trim().toLowerCase();
    const address = String((row as any).address || '').trim();
    if (!chain || !address) continue;
    if (!dedupedByChain.has(chain)) {
      dedupedByChain.set(chain, {
        chain,
        address,
        updatedAt: (row as any).updatedAt || row.$updatedAt || null,
      });
    }
  }

  return Array.from(dedupedByChain.values());
}

export async function GET(req: NextRequest, ctx: RouteParams) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const requester = await verifyUser(req);
    if (!requester?.$id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { userId: rawUserId } = await ctx.params;
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const [profile, wallets] = await Promise.all([
      getProfile(databases, userId),
      getPublishedWallets(databases, userId),
    ]);

    return NextResponse.json(
      {
        profile: profile
          ? {
              $id: profile.$id,
              userId: (profile as any).userId || profile.$id,
              username: (profile as any).username || null,
              displayName: (profile as any).displayName || null,
              bio: (profile as any).bio || null,
              avatar: (profile as any).avatar || null,
              tier: (profile as any).tier || null,
              publicKey: (profile as any).publicKey || null,
            }
          : null,
        wallets,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Quick Profile API] Failed to load profile:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load profile' },
      { status: 500, headers: corsHeaders }
    );
  }
}
