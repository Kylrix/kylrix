import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

const REFERRAL_KEY = 'referral';
const REPUTATION_KEY = 'reputation';
const KYLRIX_REFERRAL_BASE = 'https://www.kylrix.space/referral';

function normalizeUsername(input: string | null | undefined) {
  if (!input) return null;
  const cleaned = input
    .toString()
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return cleaned || null;
}

function buildReferralPageUrl(username: string) {
  return `${KYLRIX_REFERRAL_BASE}/${encodeURIComponent(username)}`;
}

async function getProfileByUserId(databases: any, userId: string) {
  const result = await databases.listDocuments(CHAT_DB_ID, PROFILES_TABLE_ID, [
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  return result.documents[0] || null;
}

async function getProfileByUsername(databases: any, username: string) {
  const result = await databases.listDocuments(CHAT_DB_ID, PROFILES_TABLE_ID, [
    Query.equal('username', username),
    Query.limit(1),
  ]);
  return result.documents[0] || null;
}

async function getReferralEvent(databases: any, userId: string) {
  const result = await databases.listDocuments(CHAT_DB_ID, EVENTS_TABLE_ID, [
    Query.equal('userId', userId),
    Query.equal('type', REFERRAL_KEY),
    Query.limit(1),
  ]);
  return result.documents[0] || null;
}

async function getReputationRewardEvent(databases: any, referrerId: string, refereeId: string) {
  const result = await databases.listDocuments(CHAT_DB_ID, EVENTS_TABLE_ID, [
    Query.equal('userId', referrerId),
    Query.equal('type', REPUTATION_KEY),
    Query.equal('relatedUserId', refereeId),
    Query.limit(1),
  ]);
  return result.documents[0] || null;
}

async function createEvent(
  databases: any,
  targetUserId: string,
  payload: Record<string, unknown>,
) {
  return await databases.createDocument(
    CHAT_DB_ID,
    EVENTS_TABLE_ID,
    ID.unique(),
    payload,
    [
      Permission.read(Role.user(targetUserId)),
    ],
  );
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const profile = await getProfileByUserId(databases, user.$id);
    const referralEvent = await getReferralEvent(databases, user.$id);
    const referrerProfile = referralEvent?.actorId ? await getProfileByUserId(databases, referralEvent.actorId).catch(() => null) : null;

    const username = profile?.username || user.prefs?.username || null;
    const referralLink = username ? buildReferralPageUrl(username) : null;

    return NextResponse.json(
      {
        success: true,
        referralLink,
        currentUsername: username,
        hasReferral: Boolean(referralEvent),
        referralEvent: referralEvent || null,
        referrer: referrerProfile
          ? {
              userId: referrerProfile.userId || referrerProfile.$id,
              username: referrerProfile.username,
              displayName: referrerProfile.displayName || referrerProfile.username,
              avatar: referrerProfile.avatar || null,
            }
          : null,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch referral status';
    console.error('[Referrals API] GET error:', error);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const referrerUsername = normalizeUsername(body?.referrerUsername || body?.username || body?.ref);
    const referrerUserId = typeof body?.referrerUserId === 'string' ? body.referrerUserId.trim() : null;

    const { databases } = createAdminClient();
    const existingReferral = await getReferralEvent(databases, user.$id);
    if (existingReferral) {
      const referrerProfile = existingReferral.actorId ? await getProfileByUserId(databases, existingReferral.actorId).catch(() => null) : null;
      return NextResponse.json(
        {
          success: true,
          alreadyReferred: true,
          referralEvent: existingReferral,
          referrer: referrerProfile ? {
            userId: referrerProfile.userId || referrerProfile.$id,
            username: referrerProfile.username,
            displayName: referrerProfile.displayName || referrerProfile.username,
            avatar: referrerProfile.avatar || null,
          } : null,
        },
        { headers: corsHeaders },
      );
    }

    let referrerProfile = null;
    if (referrerUserId) {
      referrerProfile = await getProfileByUserId(databases, referrerUserId);
    } else if (referrerUsername) {
      referrerProfile = await getProfileByUsername(databases, referrerUsername);
    }

    if (!referrerProfile) {
      return NextResponse.json({ error: 'Referrer not found' }, { status: 404, headers: corsHeaders });
    }

    const normalizedCurrentProfile = await getProfileByUserId(databases, user.$id);
    const currentUsername = normalizedCurrentProfile?.username || user.prefs?.username || null;
    if (referrerProfile.userId === user.$id || referrerProfile.$id === user.$id) {
      return NextResponse.json({ error: 'Self referral is not allowed' }, { status: 400, headers: corsHeaders });
    }

    const referralLink = currentUsername ? buildReferralPageUrl(currentUsername) : null;

    const referredEvent = await createEvent(databases, user.$id, {
      userId: user.$id,
      type: REFERRAL_KEY,
      actorId: referrerProfile.userId || referrerProfile.$id,
      relatedUserId: referrerProfile.userId || referrerProfile.$id,
      delta: 10,
      status: 'active',
      metadata: JSON.stringify({
        source: 'referral-link',
        referralLink,
        referrerUsername: referrerProfile.username,
        referrerUserId: referrerProfile.userId || referrerProfile.$id,
        refereeUserId: user.$id,
      }),
    });

    const rewardEvent = await getReputationRewardEvent(databases, referrerProfile.userId || referrerProfile.$id, user.$id);
    if (!rewardEvent) {
      await createEvent(databases, referrerProfile.userId || referrerProfile.$id, {
        userId: referrerProfile.userId || referrerProfile.$id,
        type: REPUTATION_KEY,
        actorId: user.$id,
        relatedUserId: user.$id,
        delta: 10,
        status: 'active',
        metadata: JSON.stringify({
          source: 'referral-reward',
          referrerUsername: referrerProfile.username,
          referrerUserId: referrerProfile.userId || referrerProfile.$id,
          refereeUserId: user.$id,
        }),
      });
    }

    return NextResponse.json(
      {
        success: true,
        applied: true,
        referralEvent: referredEvent,
        referrer: {
          userId: referrerProfile.userId || referrerProfile.$id,
          username: referrerProfile.username,
          displayName: referrerProfile.displayName || referrerProfile.username,
          avatar: referrerProfile.avatar || null,
        },
        referralLink,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to apply referral';
    const status = message.startsWith('Referrer not found') ? 404 : 400;
    console.error('[Referrals API] POST error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
