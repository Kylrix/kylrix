'use server';

import { ID, Permission, Query, Role } from 'node-appwrite';
import { billingManager } from '@/lib/billing/provider-factory';
import { CryptoPaymentProvider } from '@/lib/billing/providers/crypto-provider';
import { PaymentMethod } from '@/lib/billing/types';
import { registerBlockBeePendingCheckout } from '@/lib/services/internal/blockbee-pending-checkout';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';
import { getVerifiedProEntitlementForUser } from '@/lib/services/internal/subscription-entitlement';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';

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

/**
 * Resolves a secure billing country code by combining Appwrite session locale/logs,
 * Edge header fallbacks, and a threshold-gated historical account IP consensus check.
 */
async function resolveSecureCountryCode(userId: string, clientCountryCode?: string): Promise<string> {
  let edgeCountry: string | null = clientCountryCode || null;
  
  // 1. Edge/CDN Geolocation Fallback check
  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    edgeCountry = headerStore.get('x-vercel-ip-country') || 
                  headerStore.get('cf-ipcountry') || 
                  clientCountryCode || 
                  null;
  } catch {}

  const { users } = createSystemClient();
  try {
    // 2. Fetch the user's historical account session activity logs
    const logsRes = await users.listLogs(userId);
    const logs = logsRes.logs || [];

    // Reliability threshold: consensus requires at least 5 logs
    if (logs.length >= 5) {
      const counts: Record<string, number> = {};
      logs.forEach((log: any) => {
        if (log.countryCode && log.countryCode !== '—') {
          counts[log.countryCode] = (counts[log.countryCode] || 0) + 1;
        }
      });

      // Sort logs by regional popularity
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const topCountry = sorted[0][0];
        const topCount = sorted[0][1];

        // 40% majority consensus required to regard this as their canonical home country
        if (topCount >= logs.length * 0.4) {
          console.log(`[Billing Location] SECURE CONSENSUS: Resolved ${topCountry} from ${topCount}/${logs.length} activity entries.`);
          return topCountry;
        }
      }
    }
  } catch (err) {
    console.warn('[Billing Location] SECURE CONSENSUS: Failed to calculate from account activity logs:', err);
  }

  // 3. Fallback path: Edge Location -> Client Input -> US default
  return edgeCountry || 'US';
}

async function calculateStackedPeriod(databases: ReturnType<typeof createSystemClient>['databases'], userId: string, planId: string, months: number) {
  const now = new Date();
  let currentPeriodStart = now;
  try {
    const existingSubs = await databases.listDocuments(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.orderDesc('updatedAt'),
      Query.limit(1),
      Query.select(['$id', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt', 'status', 'plan'])]);
    const activeSubscriptions = (existingSubs.rows as SubscriptionRow[]).filter((row) => String(row.status || '').toLowerCase() === 'active');
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

  // Resolve secure billing location using edge headers and account IP history consensus
  const resolvedCountryCode = await resolveSecureCountryCode(user.$id, countryCode);

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
    const { databases } = createSystemClient();
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

    const baseAmount = calculateSubscriptionPrice(String(planId), resolvedCountryCode, 'CRYPTO', normalizedMonths);
    adjustedAmountUsd = Math.max(0, baseAmount * (1 - couponDiscountPercent / 100));

    if (adjustedAmountUsd <= 0.00001) {
      const { databases, users } = createSystemClient();
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
        const prefs = (await users.getPrefs(user.$id)) as Record<string, unknown>;
        await users.updatePrefs(
          user.$id,
          applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString()),
        );
      } catch {}

      await notifySubscriptionActivated({
        userId: user.$id,
        plan: String(planId),
        months: normalizedMonths,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: 'Coupon',
        bodyCopy: 'Your coupon fully covered the subscription and access is now live.',
      }).catch(() => {});

      await databases.createDocument(
        NOTE_DB_ID,
        'billing_transactions',
        ID.unique(),
        {
          paymentId: `coupon_${couponRow.$id}_${user.$id}_${Date.now()}`,
          userId: user.$id,
          plan: String(planId),
          months: normalizedMonths,
          amountCents: 0,
          amountUsd: '$0.00',
          status: 'completed',
          provider: 'manual',
          couponId: couponRow.$id,
          metadata: JSON.stringify({
            couponCode: couponRow.$id,
            completedAt: new Date().toISOString(),
            subscriptionId: subscription.$id,
          }),
        },
        [Permission.read(Role.user(user.$id))]
      ).catch((err) => {
        console.error('[Billing] Failed to log completed coupon transaction ledger entry:', err);
      });

      return {
        id: subscription.$id,
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/accounts/pro/success?success=true`,
        provider: PaymentMethod.COUPON,
        couponApplied: true,
      };
    }
  }

  const session = await provider.createCheckoutSession(
    planId,
    user.$id,
    resolvedCountryCode,
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

  if (session?.id) {
    const expectedAmountUsd =
      typeof adjustedAmountUsd === 'number' && Number.isFinite(adjustedAmountUsd)
        ? adjustedAmountUsd
        : calculateSubscriptionPrice(String(planId), resolvedCountryCode, method as any, normalizedMonths);

    const { databases } = createSystemClient();
    await databases.createDocument(
      NOTE_DB_ID,
      'billing_transactions',
      ID.unique(),
      {
        paymentId: session.id,
        userId: user.$id,
        plan: planId,
        months: normalizedMonths,
        amountCents: Math.round(expectedAmountUsd * 100),
        amountUsd: `$${expectedAmountUsd.toFixed(2)}`,
        status: 'pending',
        provider: String(method).toLowerCase() === 'stripe' ? 'stripe' : 'blockbee',
        couponId: couponRow?.$id || null,
        metadata: JSON.stringify({
          giftRecipientId: giftRecipientId || null,
          giftRecipientName: giftRecipientName || null,
          giftMessage: giftMessage || null,
          countryCode: resolvedCountryCode,
          createdAt: new Date().toISOString(),
        }),
      },
      [Permission.read(Role.user(user.$id))]
    ).catch((err) => {
      console.error('[Billing] Failed to create pending billing_transaction record:', err);
    });
  }

  if (
    String(method).toUpperCase() === PaymentMethod.CRYPTO &&
    session?.id &&
    session.provider === PaymentMethod.CRYPTO
  ) {
    const expectedAmountUsd =
      typeof adjustedAmountUsd === 'number' && Number.isFinite(adjustedAmountUsd)
        ? adjustedAmountUsd
        : calculateSubscriptionPrice(String(planId), resolvedCountryCode, 'CRYPTO', normalizedMonths);

    await registerBlockBeePendingCheckout({
      paymentId: session.id,
      payerUserId: user.$id,
      planId: String(planId),
      months: normalizedMonths,
      countryCode: resolvedCountryCode,
      expectedAmountUsd,
      giftRecipientId: giftRecipientId || undefined,
      giftRecipientName: giftRecipientName || undefined,
      giftMessage: giftMessage || undefined,
      couponId: couponRow?.$id || undefined,
    }).catch((err) => {
      console.error('[Billing] BlockBee pending checkout registry failed', err);
    });
  }

  return session;
}

export async function claimCouponAction(couponIdInput?: string, jwtInput?: string) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwtInput });
  if (!user) throw new Error('Authentication required');

  const { databases, users } = createSystemClient();
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
      Query.select(['$id', 'userId', 'actorId', 'relatedUserId', 'status', 'metadata', 'discountPercent', 'expiresAt', '$createdAt'])]);
    coupon = couponResult.rows[0];
    if (!coupon) return { ok: true, claimed: false, message: 'No active coupon found' };
  }

  const existingStatus = String(coupon.status || '').toLowerCase();
  if (['used', 'revoked', 'expired'].includes(existingStatus)) throw new Error('Coupon is no longer valid');
  
  const redemptionLimit = Number(coupon.redemptionLimit || 1);
  const redemptionCount = Number(coupon.redemptionCount || 0);
  
  if (redemptionCount >= redemptionLimit) {
    throw new Error('Coupon redemption limit reached');
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
  
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Invalid coupon discount');
  if (targetUserId && targetUserId !== user.$id) throw new Error('Coupon is reserved for another account');

  const newRedemptionCount = redemptionCount + 1;
  const isLastRedemption = newRedemptionCount >= redemptionLimit;

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
      redemptionIndex: newRedemptionCount,
    },
  };

  // Update coupon state
  await databases.updateDocument(CHAT_DB_ID, ACCOUNT_EVENTS_TABLE_ID, coupon.$id, {
    status: discountPercent < 100 ? 'pending' : (isLastRedemption ? 'applied' : 'active'),
    relatedUserId: user.$id,
    redemptionCount: newRedemptionCount,
    metadata: JSON.stringify({
      ...nextMetadata,
      coupon: { ...nextMetadata.coupon, claimState: discountPercent < 100 ? 'pending' : 'applied' },
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
    const prefs = (await users.getPrefs(user.$id)) as Record<string, unknown>;
    await users.updatePrefs(user.$id, applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString()));
  } catch {}

  await databases.createDocument(
    NOTE_DB_ID,
    'billing_transactions',
    ID.unique(),
    {
      paymentId: `coupon_claim_${coupon.$id}_${user.$id}_${Date.now()}`,
      userId: user.$id,
      plan: planId,
      months,
      amountCents: 0,
      amountUsd: '$0.00',
      status: 'completed',
      provider: 'manual',
      couponId: coupon.$id,
      metadata: JSON.stringify({
        couponCode: coupon.$id,
        completedAt: new Date().toISOString(),
        subscriptionId: subscription.$id,
      }),
    },
    [Permission.read(Role.user(user.$id))]
  ).catch((err) => {
    console.error('[Billing] Failed to log completed coupon claim transaction:', err);
  });

  try {
    const profileResult = await databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
      Query.equal('userId', user.$id),
      Query.limit(1),
      Query.select(['$id', 'userId', 'tier'])]);
    if (profileResult.total > 0) {
      await databases.updateDocument(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, profileResult.rows[0].$id, {
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

export async function verifyProEntitlementAction(jwt?: string | null) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwt ?? undefined });
  if (!user) {
    return {
      authenticated: false as const,
      active: false,
      expiresAt: null as string | null,
      source: 'none' as const,
      uiTier: 'FREE' as const,
    };
  }
  const ent = await getVerifiedProEntitlementForUser(user.$id);
  return {
    authenticated: true as const,
    active: ent.active,
    expiresAt: ent.expiresAt,
    source: ent.source,
    uiTier: ent.uiTier,
  };
}

/**
 * Consolidated hydration for the current session.
 * Achievement: returns profile, billing, token, and presence in one server trip.
 */
export async function hydrateSessionAction(jwt?: string | null) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwt ?? undefined });
  if (!user) {
    return {
      authenticated: false as const,
      profile: null,
      billing: null,
      presence: null,
    };
  }

  const { databases } = createSystemClient();
  const userId = user.$id;

  try {
    const [profileRes, entitlement, tokenBal, walletsRes, activityRes] = await Promise.all([
      databases.listDocuments(CHAT_DB_ID, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
        Query.equal('userId', userId),
        Query.limit(1)]),
      getVerifiedProEntitlementForUser(userId),
      // Use internal service logic for direct server access
      (async () => {
          const { InternalKylrixTokenService } = await import('@/lib/services/internal/kylrix-token');
          return InternalKylrixTokenService.getUserBalance(userId);
      })(),
      databases.listDocuments(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS, [
        Query.equal('ownerId', `user:${userId}`),
        Query.equal('type', 'main'),
        Query.limit(10)]),
      databases.listDocuments(CHAT_DB_ID, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, [
        Query.equal('userId', userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(1)])
    ]);

    return {
      authenticated: true as const,
      profile: profileRes.rows[0] || null,
      billing: {
        tier: entitlement.uiTier,
        active: entitlement.active,
        expiresAt: entitlement.expiresAt,
        source: entitlement.source,
        balance: {
          amount: tokenBal.amount,
          symbol: tokenBal.symbol,
        },
        wallets: walletsRes.rows.map((w) => ({
          id: w.$id,
          chain: w.chain,
          address: w.address,
          type: w.type,
          label: w.chain,
          symbol: w.chain.toUpperCase(),
          family: (w.chain === 'sol' ? 'solana' : 'evm') as 'evm' | 'solana' | 'bitcoin' | 'sui',
          publicProfile: true,
        })),
      },
      presence: activityRes.rows[0] || null,
    };
  } catch (error) {
    console.error('[hydrateSessionAction] Error:', error);
    return {
      authenticated: true as const,
      profile: null,
      billing: null,
      presence: null,
    };
  }
}

/**
 * Server Action: Triggers a high-priority subscription expiry reminder email
 * bypassing ordinary rate limits.
 */
export async function sendSubscriptionExpiryReminderAction(jwtInput?: string) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwtInput });
  if (!user || !user.email) throw new Error('Authentication required');

  try {
    const { dispatchEmail } = await import('@/lib/services/internal/emailDispatch');
    await dispatchEmail({
      eventType: 'subscription_expiry_reminder',
      sourceApp: 'accounts',
      recipientEmails: [user.email],
      recipientIds: [user.$id],
      actorName: user.name || 'Kylrix User',
      actorId: user.$id,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Failed to dispatch subscription expiry reminder:', error?.message);
    return { success: false, error: error?.message };
  }
}

