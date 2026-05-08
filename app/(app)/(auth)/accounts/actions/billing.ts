'use server';

import { ID, Permission, Query, Role } from 'node-appwrite';
import { billingManager } from '@/lib/billing/provider-factory';
import { StripeProvider } from '@/lib/billing/providers/stripe-provider';
import { CryptoPaymentProvider } from '@/lib/billing/providers/crypto-provider';
import { PaymentMethod } from '@/lib/billing/types';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';

billingManager.registerProvider(new StripeProvider());
billingManager.registerProvider(new CryptoPaymentProvider());

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUBSCRIPTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const ACCOUNT_EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

const parseMetadata = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const parsePositiveInteger = (value: unknown, fallback = 1) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

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
    const activeSubscriptions = (existingSubs.documents as SubscriptionRow[]).filter((row) => String(row.status || '').toLowerCase() === 'active');
    const latestSubscription = pickLatestSubscription(activeSubscriptions);
    if (latestSubscription?.currentPeriodEnd) {
      const latestExpiry = new Date(latestSubscription.currentPeriodEnd);
      if (latestExpiry > now) currentPeriodStart = latestExpiry;
    }
  } catch {}

  const baseDurationMs = planId === 'PRO_YEAR'
    ? (months === 1 ? 365 : 30 * months) * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  const currentPeriodEnd = new Date(currentPeriodStart.getTime() + (planId === 'PRO_YEAR' ? baseDurationMs : baseDurationMs * Math.max(1, months)));
  return { currentPeriodStart, currentPeriodEnd };
}

export async function createBillingCheckoutSessionAction(input: {
  planId: string;
  method: string;
  countryCode?: string;
  months?: number;
  giftRecipientId?: string;
  giftRecipientName?: string;
  giftMessage?: string;
  couponId?: string;
  jwt?: string;
  baseUrl?: string;
}) {
  const { planId, method, countryCode, months, giftRecipientId, giftRecipientName, giftMessage, couponId, jwt, baseUrl } = input;
  const user = await getAuthenticatedUserForBillingAction({ jwt });
  if (!user) throw new Error('Authentication required');
  if (!planId || !method) throw new Error('Missing parameters');
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
    couponRow = await databases.getDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, String(couponId).trim()).catch(() => null);
    if (!couponRow || String(couponRow.type || '').toLowerCase() !== 'coupon') throw new Error('Coupon not found');
    const metadata = parseMetadata(couponRow.metadata);
    const couponMeta = parseMetadata(metadata.coupon);
    const claimedBy = couponMeta.claimedBy || metadata.claimedBy || null;
    const targetUserId = couponMeta.targetUserId || couponRow.relatedUserId || null;
    const status = String(couponRow.status || '').toLowerCase();
    const discountPercentRaw = couponRow.discountPercent ?? couponMeta.discountPercent ?? metadata.discountPercent ?? 0;
    couponDiscountPercent = Number(discountPercentRaw);
    if (!Number.isFinite(couponDiscountPercent) || couponDiscountPercent < 0 || couponDiscountPercent > 100) throw new Error('Invalid coupon discount');
    if (status === 'revoked' || status === 'expired' || status === 'used') throw new Error('Coupon is no longer valid');
    if (claimedBy && claimedBy !== user.$id) throw new Error('Coupon is reserved for another account');
    if (targetUserId && targetUserId !== user.$id) throw new Error('Coupon is not assigned to this account');

    const baseAmount = calculateSubscriptionPrice(String(planId), String(countryCode || 'US'), 'CRYPTO', normalizedMonths);
    adjustedAmountUsd = Math.max(0, baseAmount * (1 - couponDiscountPercent / 100));

    if (adjustedAmountUsd <= 0.00001) {
      const { databases, users } = createAdminClient();
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(currentPeriodStart.getTime() + (normalizedMonths >= 12
        ? (normalizedMonths === 12 ? 365 : 30 * normalizedMonths) * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000 * normalizedMonths));
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
        [Permission.read(Role.user(user.$id))],
      );

      await databases.updateDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, couponRow.$id, {
        status: 'applied',
        relatedUserId: user.$id,
        metadata: JSON.stringify({
          ...metadata,
          coupon: { ...couponMeta, claimedBy: user.$id, appliedAt: new Date().toISOString(), subscriptionId: subscription.$id, claimState: 'applied' },
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

      return {
        id: subscription.$id,
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/accounts/pro/success?success=true`,
        provider: PaymentMethod.COUPON,
        couponApplied: true,
      };
    }
  }

  return provider.createCheckoutSession(
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
      baseUrl: baseUrl || null,
    },
  );
}

export async function claimCouponAction(couponIdInput?: string, jwtInput?: string) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwtInput });
  if (!user) throw new Error('Authentication required');

  const { databases, users } = createAdminClient();
  const couponId = typeof couponIdInput === 'string' ? couponIdInput.trim() : '';
  let coupon: any = null;
  if (couponId) {
    coupon = await databases.getDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, couponId).catch(() => null);
    if (!coupon || String(coupon.type || '').toLowerCase() !== 'coupon') throw new Error('Coupon not found');
  } else {
    const couponResult = await databases.listDocuments(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, [
      Query.equal('type', 'coupon'),
      Query.or([Query.equal('userId', user.$id), Query.equal('relatedUserId', user.$id)]),
      Query.or([Query.equal('status', 'active'), Query.equal('status', 'pending')]),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
      Query.select(['$id', 'userId', 'actorId', 'relatedUserId', 'status', 'metadata', 'discountPercent', 'expiresAt', '$createdAt']),
    ]);
    coupon = couponResult.documents[0];
    if (!coupon) return { ok: true, claimed: false, message: 'No active coupon found' };
  }

  const existingStatus = String(coupon.status || '').toLowerCase();
  if (['applied', 'redeemed', 'used'].includes(existingStatus)) return { ok: true, claimed: false, message: 'Coupon already claimed' };
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
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Invalid coupon discount');
  if (claimedBy && claimedBy !== user.$id) throw new Error('Coupon is reserved for another account');
  if (targetUserId && targetUserId !== user.$id) throw new Error('Coupon is reserved for another account');

  const { currentPeriodStart, currentPeriodEnd } = await calculateStackedPeriod(databases, user.$id, planId, months);
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
      coupon: { ...nextMetadata.coupon, claimState: 'pending' },
    }),
  });

  if (discountPercent < 100) {
    return {
      ok: true,
      claimed: true,
      requiresPayment: true,
      couponId: coupon.$id,
      discountPercent,
      planId,
      months,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      payerUserId: payerUserId || null,
    };
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
    [Permission.read(Role.user(user.$id))],
  );

  await databases.updateDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, coupon.$id, {
    status: 'applied',
    relatedUserId: user.$id,
    metadata: JSON.stringify({
      ...nextMetadata,
      coupon: { ...nextMetadata.coupon, appliedAt: new Date().toISOString(), subscriptionId: subscription.$id, claimState: 'applied' },
    }),
  });

  try {
    const prefs = await users.getPrefs(user.$id);
    await users.updatePrefs(user.$id, { ...prefs, tier: 'PRO' });
  } catch {}

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
  } catch {}

  await notifySubscriptionActivated({
    userId: user.$id,
    plan: planId,
    months,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    sourceLabel: payerName ? `Gift from ${payerName}` : 'Coupon claim',
    bodyCopy: giftMessage || 'Your coupon has been applied and your subscription is live.',
  }).catch(() => {});

  return {
    ok: true,
    claimed: true,
    couponId: coupon.$id,
    subscriptionId: subscription.$id,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    payerUserId: payerUserId || null,
  };
}
