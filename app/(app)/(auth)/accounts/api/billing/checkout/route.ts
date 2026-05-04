import { NextResponse } from 'next/server';
import { billingManager } from '@/lib/billing/provider-factory';
import { StripeProvider } from '@/lib/billing/providers/stripe-provider';
import { CryptoPaymentProvider } from '@/lib/billing/providers/crypto-provider';
import { PaymentMethod } from '@/lib/billing/types';
import { Account, Client } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/appwrite-admin';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { Permission, Role, ID } from 'node-appwrite';

// Register providers
billingManager.registerProvider(new StripeProvider());
billingManager.registerProvider(new CryptoPaymentProvider());

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

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { planId, method, countryCode, months, giftRecipientId, giftRecipientName, giftMessage, couponId } = await req.json();

    if (!planId || !method) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const provider = billingManager.getProvider(method as PaymentMethod);
    const normalizedMonths = parsePositiveInteger(months, 1);
    const giftDetails = giftRecipientId
      ? {
          recipientUserId: String(giftRecipientId).trim(),
          recipientName: typeof giftRecipientName === 'string' ? giftRecipientName.trim() : undefined,
          giftMessage: typeof giftMessage === 'string' ? giftMessage.trim() : undefined,
        }
      : undefined;

    let couponDiscountPercent: number | null = null;
    let adjustedAmountUsd: number | null = null;
    let couponRow: any = null;

    if (couponId) {
      const { databases } = createAdminClient();
      couponRow = await databases.getDocument(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, String(couponId).trim()).catch(() => null);
      if (!couponRow || String(couponRow.type || '').toLowerCase() !== 'coupon') {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
      }

      const metadata = parseMetadata(couponRow.metadata);
      const couponMeta = parseMetadata(metadata.coupon);
      const claimedBy = couponMeta.claimedBy || metadata.claimedBy || null;
      const targetUserId = couponMeta.targetUserId || couponRow.relatedUserId || null;
      const status = String(couponRow.status || '').toLowerCase();
      const discountPercentRaw = couponRow.discountPercent ?? couponMeta.discountPercent ?? metadata.discountPercent ?? 0;
      couponDiscountPercent = Number(discountPercentRaw);

      if (!Number.isFinite(couponDiscountPercent) || couponDiscountPercent < 0 || couponDiscountPercent > 100) {
        return NextResponse.json({ error: 'Invalid coupon discount' }, { status: 400 });
      }

      if (status === 'revoked' || status === 'expired' || status === 'used') {
        return NextResponse.json({ error: 'Coupon is no longer valid' }, { status: 400 });
      }

      if (claimedBy && claimedBy !== user.$id) {
        return NextResponse.json({ error: 'Coupon is reserved for another account' }, { status: 403 });
      }

      if (targetUserId && targetUserId !== user.$id) {
        return NextResponse.json({ error: 'Coupon is not assigned to this account' }, { status: 403 });
      }

      const baseAmount = calculateSubscriptionPrice(String(planId), String(countryCode || 'US'), 'CRYPTO', normalizedMonths);
      adjustedAmountUsd = Math.max(0, baseAmount * (1 - couponDiscountPercent / 100));

      if (adjustedAmountUsd <= 0.00001) {
        const { databases, users } = createAdminClient();
        const currentPeriodStart = new Date();
        const currentPeriodEnd = new Date(currentPeriodStart.getTime() + (normalizedMonths >= 12
          ? (normalizedMonths === 12 ? 365 : 30 * normalizedMonths) * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000 * normalizedMonths));

        const subscription = await databases.createDocument(
          APPWRITE_CONFIG.DATABASES.NOTE,
          APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS,
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
          [Permission.read(Role.user(user.$id))],
        );

        await databases.updateDocument(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, couponRow.$id, {
          status: 'applied',
          relatedUserId: user.$id,
          metadata: JSON.stringify({
            ...metadata,
            coupon: {
              ...couponMeta,
              claimedBy: user.$id,
              appliedAt: new Date().toISOString(),
              subscriptionId: subscription.$id,
              claimState: 'applied',
            },
          }),
        });

        try {
          const prefs = await users.getPrefs(user.$id);
          await users.updatePrefs(user.$id, { ...prefs, tier: 'PRO' });
        } catch {}

        await notifySubscriptionActivated({
          userId: user.$id,
          plan: String(planId),
          months: normalizedMonths,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          sourceLabel: 'Coupon',
          bodyCopy: 'Your coupon fully covered the subscription and access is now live.',
        }).catch(() => {});

        return NextResponse.json({
          id: subscription.$id,
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/pro/success?success=true`,
          provider: PaymentMethod.COUPON,
          couponApplied: true,
        });
      }
    }

    const session = await provider.createCheckoutSession(
      planId,
      user.$id,
      countryCode || 'US',
      normalizedMonths,
      user.email,
      giftDetails,
      {
        couponId: couponRow?.$id || null,
        discountPercent: couponDiscountPercent,
        adjustedAmountUsd,
      },
    );

    return NextResponse.json(session);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId') || 'PRO_MONTH';
    const method = (searchParams.get('method') as PaymentMethod) || PaymentMethod.CRYPTO;
    const countryCode = searchParams.get('countryCode') || 'US';
    const months = parseInt(searchParams.get('months') || '1');
    const giftRecipientId = searchParams.get('giftRecipientId') || undefined;
    const giftRecipientName = searchParams.get('giftRecipientName') || undefined;
    const giftMessage = searchParams.get('giftMessage') || undefined;

    const provider = billingManager.getProvider(method);
    const session = await provider.createCheckoutSession(
      planId,
      user.$id,
      countryCode,
      months,
      user.email,
      giftRecipientId ? {
        recipientUserId: giftRecipientId,
        recipientName: giftRecipientName || undefined,
        giftMessage: giftMessage || undefined,
      } : undefined,
    );
    return NextResponse.json(session);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
