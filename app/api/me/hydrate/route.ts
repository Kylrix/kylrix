import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getCorsHeaders } from '@/lib/api/permission-updater';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getVerifiedProEntitlementForUser } from '@/lib/services/internal/subscription-entitlement';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { Query } from 'node-appwrite';

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  const user = await verifyUser(req);

  if (!user?.$id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const { databases } = createAdminClient();
  const userId = user.$id;

  try {
    const [profileRes, entitlement, tokenBal, walletsRes, activityRes] = await Promise.all([
      databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
        Query.equal('userId', userId),
        Query.limit(1),
      ]),
      getVerifiedProEntitlementForUser(userId),
      InternalKylrixTokenService.getUserBalance(userId),
      databases.listDocuments(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS, [
        Query.equal('ownerId', `user:${userId}`),
        Query.equal('type', 'main'),
        Query.limit(10),
      ]),
      databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY, [
        Query.equal('userId', userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(1),
      ])
    ]);

    const profile = profileRes.documents[0] || null;
    const presence = activityRes.documents[0] || null;

    return NextResponse.json({
      user: {
        $id: user.$id,
        name: user.name,
        email: user.email,
        prefs: user.prefs,
        labels: user.labels,
      },
      profile,
      billing: {
        tier: entitlement.uiTier,
        active: entitlement.active,
        expiresAt: entitlement.expiresAt,
        source: entitlement.source,
        balance: {
            amount: tokenBal.amount,
            symbol: tokenBal.symbol,
            amountMicro: tokenBal.amountMicro
        },
        wallets: walletsRes.documents.map(w => ({
            id: w.$id,
            chain: w.chain,
            address: w.address,
            type: w.type
        }))
      },
      presence,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Me Hydrate API] Error:', error);
    return NextResponse.json({ error: 'Failed to hydrate session state' }, { status: 500, headers: corsHeaders });
  }
}
