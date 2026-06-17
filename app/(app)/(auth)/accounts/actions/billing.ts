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
const COUPONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.COUPONS;
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

async function buildAlreadyClaimedCouponResponse(userId: string, coupon: any, metadata: Record<string, any>) {
  const ent = await getVerifiedProEntitlementForUser(userId).catch(() => null);
  return {
    ok: true,
    claimed: true,
    alreadyClaimed: true,
    couponId: coupon.$id,
    subscriptionId: metadata.subscriptionId || null,
    currentPeriodEnd: ent?.expiresAt || metadata.currentPeriodEnd || null,
    message: 'This coupon is already applied to your account.',
  };
}

/**
 * Resolves a billing country code. 
 * PPP is deprecated, so we now default to a fixed Global rate (US).
 */
async function resolveSecureCountryCode(_userId: string, clientCountryCode?: string): Promise<string> {
  return clientCountryCode?.toUpperCase() || 'US';
}

export async function getUserBillingRegionAction(jwt?: string) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwt ?? undefined });
  if (!user) throw new Error('Authentication required');
  return 'US';
}

async function calculateStackedPeriod(databases: ReturnType<typeof createSystemClient>['databases'], userId: string, planId: string, months: number) {
  const now = new Date();
  let currentPeriodStart = now;
  try {
    const existingSubs = await databases.listRows(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
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
    couponRow = await databases.getRow(NOTE_DB_ID, COUPONS_TABLE_ID, String(couponId).trim()).catch(() => null);
    if (!couponRow) throw new Error('Coupon not found');
    const metadata = parseMetadata(couponRow.metadata);
    const claimedBy = metadata.claimedBy || null;
    const targetUserId = couponRow.targetUserId || null;
    const status = String(couponRow.status || '').toLowerCase();
    
    couponDiscountPercent = Number(couponRow.discountPercent ?? couponRow.discountPercentage);
    if (!Number.isFinite(couponDiscountPercent) || couponDiscountPercent < 0 || couponDiscountPercent > 100) throw new Error('Invalid coupon discount');
    if (status === 'revoked' || status === 'expired' || status === 'depleted') throw new Error('Coupon is no longer valid');
    
    const redemptionLimit = Number(couponRow.redemptionLimit || 1);
    const redemptionCount = Number(couponRow.redemptionCount || 0);
    if (redemptionCount >= redemptionLimit) throw new Error('Coupon redemption limit reached');
    
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
      const subscription = await databases.createRow(
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

      const newRedemptionCount = redemptionCount + 1;
      const isLastRedemption = newRedemptionCount >= redemptionLimit;

      await databases.updateRow(NOTE_DB_ID, COUPONS_TABLE_ID, couponRow.$id, {
        status: isLastRedemption ? 'depleted' : 'active',
        redemptionCount: newRedemptionCount,
        metadata: JSON.stringify({
          ...metadata,
          claimedBy: user.$id, 
          appliedAt: new Date().toISOString(), 
          subscriptionId: subscription.$id, 
          claimState: 'applied'
        }),
      });
      try {
        const prefs = (await users.getPrefs(user.$id)) as Record<string, unknown>;
        await users.updatePrefs(
          user.$id,
          applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), String(planId).toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO'),
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

      await databases.createRow(
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
    await databases.createRow(
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
    coupon = await databases.getRow(NOTE_DB_ID, COUPONS_TABLE_ID, couponId).catch(() => null);
    if (!coupon) {
      const eventCoupon = await databases.getRow(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS,
        couponId
      ).catch(() => null);
      if (eventCoupon && eventCoupon.type === 'coupon') {
        const meta = parseMetadata(eventCoupon.metadata);
        coupon = {
          $id: eventCoupon.$id,
          $createdAt: eventCoupon.$createdAt,
          status: eventCoupon.status || 'active',
          expiresAt: eventCoupon.expiresAt || null,
          targetUserId: eventCoupon.relatedUserId || null,
          createdBy: eventCoupon.actorId,
          discountPercent: eventCoupon.discountPercent ?? 100,
          redemptionLimit: 1,
          redemptionCount: eventCoupon.status === 'applied' ? 1 : 0,
          metadata: eventCoupon.metadata,
          note: meta.gift?.giftMessage || '',
          isEventCoupon: true,
        };
      }
    }
    if (!coupon) throw new Error('Coupon not found');
  } else {
    const couponResult = await databases.listRows(NOTE_DB_ID, COUPONS_TABLE_ID, [
      Query.equal('targetUserId', user.$id),
      Query.equal('status', 'active'),
      Query.orderDesc('$createdAt'),
      Query.limit(1)
    ]);
    coupon = couponResult.rows[0];

    if (!coupon) {
      const eventCouponResult = await databases.listRows(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS,
        [
          Query.equal('relatedUserId', user.$id),
          Query.equal('type', 'coupon'),
          Query.equal('status', 'active'),
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]
      );
      const eventCoupon = eventCouponResult.rows[0];
      if (eventCoupon) {
        const meta = parseMetadata(eventCoupon.metadata);
        coupon = {
          $id: eventCoupon.$id,
          $createdAt: eventCoupon.$createdAt,
          status: eventCoupon.status || 'active',
          expiresAt: eventCoupon.expiresAt || null,
          targetUserId: eventCoupon.relatedUserId || null,
          createdBy: eventCoupon.actorId,
          discountPercent: eventCoupon.discountPercent ?? 100,
          redemptionLimit: 1,
          redemptionCount: eventCoupon.status === 'applied' ? 1 : 0,
          metadata: eventCoupon.metadata,
          note: meta.gift?.giftMessage || '',
          isEventCoupon: true,
        };
      }
    }

    if (!coupon) return { ok: true, claimed: false, message: 'No active coupon found' };
  }

  const metadata = parseMetadata(coupon.metadata);
  const claimedBy = String(metadata.claimedBy || '').trim();
  const claimState = String(metadata.claimState || '').trim();
  const sameUserAlreadyApplied =
    claimedBy === user.$id && (claimState === 'applied' || Boolean(metadata.appliedAt));

  if (sameUserAlreadyApplied) {
    return buildAlreadyClaimedCouponResponse(user.$id, coupon, metadata);
  }

  const existingStatus = String(coupon.status || '').toLowerCase();
  if (['depleted', 'revoked', 'expired', 'applied'].includes(existingStatus)) throw new Error('Coupon is no longer valid');
  
  const redemptionLimit = Number(coupon.redemptionLimit || 1);
  const redemptionCount = Number(coupon.redemptionCount || 0);
  
  if (redemptionCount >= redemptionLimit) {
    throw new Error('Coupon redemption limit reached');
  }

  const planId = String(metadata.planId || metadata.gift?.planId || 'PRO_MONTH');
  const months = parsePositiveInteger(metadata.months || metadata.gift?.months || 1, 1);
  const payerUserId = String(coupon.createdBy || '');
  const payerName = String(metadata.payerName || '');
  const giftMessage = String(metadata.giftMessage || coupon.note || 'Your gift subscription has been claimed.');
  const targetUserId = String(coupon.targetUserId || '').trim();
  const discountPercent = Number(coupon.discountPercent ?? coupon.discountPercentage);
  
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Invalid coupon discount');
  if (targetUserId && targetUserId !== user.$id) throw new Error('Coupon is reserved for another account');

  const newRedemptionCount = redemptionCount + 1;
  const isLastRedemption = newRedemptionCount >= redemptionLimit;

  const { currentPeriodStart, currentPeriodEnd } = await calculateStackedPeriod(databases, user.$id, planId, months);
  const nextMetadata = {
    ...metadata,
    claimedBy: user.$id,
    claimedAt: new Date().toISOString(),
    redemptionIndex: newRedemptionCount,
  };

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

  const subscription = await databases.createRow(
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

  if (coupon.isEventCoupon) {
    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS,
      coupon.$id,
      {
        status: 'applied',
        metadata: JSON.stringify({
          ...metadata,
          claimedBy: user.$id,
          appliedAt: new Date().toISOString(),
          subscriptionId: subscription.$id,
          claimState: 'applied'
        }),
      }
    );
  } else {
    await databases.updateRow(NOTE_DB_ID, COUPONS_TABLE_ID, coupon.$id, {
      status: isLastRedemption ? 'depleted' : 'active',
      redemptionCount: newRedemptionCount,
      metadata: JSON.stringify({
        ...nextMetadata,
        appliedAt: new Date().toISOString(), 
        subscriptionId: subscription.$id, 
        claimState: 'applied'
      }),
    });
  }

  try {
    const prefs = (await users.getPrefs(user.$id)) as Record<string, unknown>;
    await users.updatePrefs(user.$id, applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), String(planId).toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO'));
  } catch {}

  await databases.createRow(
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
    const profileResult = await databases.listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
      Query.equal('userId', user.$id),
      Query.limit(1),
      Query.select(['$id', 'userId', 'tier'])]);
    if (profileResult.total > 0) {
      await databases.updateRow(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, profileResult.rows[0].$id, {
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
    message: 'Coupon applied successfully.',
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
      databases.listRows(CHAT_DB_ID, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
        Query.equal('userId', userId),
        Query.limit(1)]),
      getVerifiedProEntitlementForUser(userId),
      (async () => {
          const { InternalKylrixTokenService } = await import('@/lib/services/internal/kylrix-token');
          return InternalKylrixTokenService.getUserBalance(userId);
      })(),
      databases.listRows(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS, [
        Query.equal('ownerId', `user:${userId}`),
        Query.equal('type', 'main'),
        Query.limit(10)]),
      databases.listRows(CHAT_DB_ID, APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS, [
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

export async function listBillingTransactionsAction(jwtInput?: string) {
  const user = await getAuthenticatedUserForBillingAction({ jwt: jwtInput });
  if (!user) throw new Error('Authentication required');

  const { databases } = createSystemClient();
  try {
    const list = await databases.listRows(NOTE_DB_ID, 'billing_transactions', [
      Query.equal('userId', user.$id),
      Query.orderDesc('createdAt'),
      Query.limit(100),
    ]);
    return { success: true, transactions: list.rows };
  } catch (error: any) {
    console.error('[Billing] Failed to list billing transactions:', error?.message);
    return { success: false, error: error?.message || 'Failed to list transactions' };
  }
}
