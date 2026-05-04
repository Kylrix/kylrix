import { NextResponse } from 'next/server';
import { Account, Client, ID, Permission, Query, Role } from 'node-appwrite';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUBSCRIPTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const ACCOUNT_EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function getAuthenticatedUser(req: Request) {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID);

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    client.setJWT(authHeader.split(' ')[1]);
  } else {
    const sessionName = `a_session_${APPWRITE_CONFIG.PROJECT_ID.toLowerCase()}`;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionName) || cookieStore.get(`${sessionName}_legacy`);

    if (sessionCookie) {
      client.setSession(sessionCookie.value);
    } else {
      return null;
    }
  }

  const account = new Account(client);
  try {
    return await account.get();
  } catch (_e) {
    return null;
  }
}

async function calculateStackedPeriod(databases: ReturnType<typeof createAdminClient>['databases'], userId: string, planId: string, months: number) {
  const now = new Date();
  let currentPeriodStart = now;

  try {
    const existingSubs = await databases.listDocuments(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.orderDesc('updatedAt'),
      Query.limit(1),
      Query.select(['$id', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt', 'status', 'plan']),
    ]);

    const activeSubscriptions = (existingSubs.documents as SubscriptionRow[]).filter(
      (row) => String(row.status || '').toLowerCase() === 'active'
    );
    const latestSubscription = pickLatestSubscription(activeSubscriptions);
    if (latestSubscription?.currentPeriodEnd) {
      const latestExpiry = new Date(latestSubscription.currentPeriodEnd);
      if (latestExpiry > now) {
        currentPeriodStart = latestExpiry;
      }
    }
  } catch (_e) {
    console.warn('[Coupon Claim] Failed to load existing subscription stack', _e);
  }

  const baseDurationMs = planId === 'PRO_YEAR'
    ? (months === 1 ? 365 : 30 * months) * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  const currentPeriodEnd = new Date(
    currentPeriodStart.getTime() + (planId === 'PRO_YEAR' ? baseDurationMs : baseDurationMs * Math.max(1, months)),
  );

  return { currentPeriodStart, currentPeriodEnd };
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { databases, users } = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const couponId = typeof body?.couponId === 'string' ? body.couponId.trim() : '';

    let coupon: any = null;
    if (couponId) {
      coupon = await databases.getDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, couponId).catch(() => null);
      if (!coupon || String(coupon.type || '').toLowerCase() !== 'coupon') {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
      }
    } else {
      const couponResult = await databases.listDocuments(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, [
        Query.equal('type', 'coupon'),
        Query.or([
          Query.equal('userId', user.$id),
          Query.equal('relatedUserId', user.$id),
        ]),
        Query.or([
          Query.equal('status', 'active'),
          Query.equal('status', 'pending'),
        ]),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
        Query.select(['$id', 'userId', 'actorId', 'relatedUserId', 'status', 'metadata', 'discountPercent', 'expiresAt', '$createdAt']),
      ]);

      coupon = couponResult.documents[0];
      if (!coupon) {
        return NextResponse.json({ ok: true, claimed: false, message: 'No active coupon found' });
      }
    }

    const existingStatus = String(coupon.status || '').toLowerCase();
    if (['applied', 'redeemed', 'used'].includes(existingStatus)) {
      return NextResponse.json({ ok: true, claimed: false, message: 'Coupon already claimed' });
    }

    const metadata = parseMetadata(coupon.metadata);
    const couponMeta = parseMetadata(metadata.coupon);
    const giftMeta = parseMetadata(metadata.gift);
    const planId = String(giftMeta.planId || couponMeta.planId || 'PRO_MONTH');
    const months = parsePositiveInteger(giftMeta.months || couponMeta.months || 1, 1);
    const payerUserId = String(giftMeta.payerUserId || coupon.actorId || '');
    const payerName = String(giftMeta.payerName || '');
    const giftMessage = String(giftMeta.giftMessage || metadata.note || 'Your gift subscription has been claimed.');
    const targetUserId = String(couponMeta.targetUserId || coupon.relatedUserId || '').trim();
    const claimedBy = String(couponMeta.claimedBy || metadata.claimedBy || '').trim();
    const discountPercent = Number(coupon.discountPercent ?? couponMeta.discountPercent ?? metadata.discountPercent ?? 0);

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: 'Invalid coupon discount' }, { status: 400 });
    }

    if (claimedBy && claimedBy !== user.$id) {
      return NextResponse.json({ error: 'Coupon is reserved for another account' }, { status: 403 });
    }

    if (targetUserId && targetUserId !== user.$id) {
      return NextResponse.json({ error: 'Coupon is reserved for another account' }, { status: 403 });
    }

    const { currentPeriodStart, currentPeriodEnd } = await calculateStackedPeriod(
      databases,
      user.$id,
      planId,
      months,
    );

    const nextMetadata = {
      ...metadata,
      coupon: {
        ...couponMeta,
        ...giftMeta,
        claimedBy: user.$id,
        claimedAt: new Date().toISOString(),
        discountPercent,
        targetUserId: targetUserId || null,
      },
    };

    await databases.updateDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, coupon.$id, {
      status: 'pending',
      relatedUserId: user.$id,
      metadata: JSON.stringify({
        ...nextMetadata,
        coupon: {
          ...nextMetadata.coupon,
          claimState: 'pending',
        },
      }),
    });

    if (discountPercent < 100) {
      return NextResponse.json({
        ok: true,
        claimed: true,
        requiresPayment: true,
        couponId: coupon.$id,
        discountPercent,
        planId,
        months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        payerUserId: payerUserId || null,
      });
    }

    const subscription = await databases.createDocument(
      NOTE_DB_ID,
      SUBSCRIPTIONS_TABLE_ID,
      ID.unique(),
      {
        userId: user.$id,
        plan: 'pro',
        status: 'active',
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        seats: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(user.$id)),
      ],
    );

    await databases.updateDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, coupon.$id, {
      status: 'applied',
      relatedUserId: user.$id,
      metadata: JSON.stringify({
        ...nextMetadata,
        coupon: {
          ...nextMetadata.coupon,
          appliedAt: new Date().toISOString(),
          subscriptionId: subscription.$id,
          claimState: 'applied',
        },
      }),
    });

    try {
      const prefs = await users.getPrefs(user.$id);
      await users.updatePrefs(user.$id, { ...prefs, tier: 'PRO' });
    } catch (error) {
      console.warn('[Coupon Claim] Failed to update user prefs:', error);
    }

    try {
      const profileResult = await databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
        Query.equal('userId', user.$id),
        Query.limit(1),
        Query.select(['$id', 'userId', 'tier']),
      ]);
      if (profileResult.total > 0) {
        await databases.updateDocument(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, profileResult.documents[0].$id, {
          tier: 'PRO',
        });
      }
    } catch (error) {
      console.warn('[Coupon Claim] Failed to sync profile tier:', error);
    }

    await notifySubscriptionActivated({
      userId: user.$id,
      plan: planId,
      months,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      sourceLabel: payerName ? `Gift from ${payerName}` : 'Coupon claim',
      bodyCopy: giftMessage || 'Your coupon has been applied and your subscription is live.',
    }).catch((error) => {
      console.warn('[Coupon Claim] Subscription notification failed:', error);
    });

    return NextResponse.json({
      ok: true,
      claimed: true,
      couponId: coupon.$id,
      subscriptionId: subscription.$id,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      payerUserId: payerUserId || null,
    });
  } catch (error: any) {
    console.error('[Coupon Claim] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to claim coupon' },
      { status: 500 },
    );
  }
}
