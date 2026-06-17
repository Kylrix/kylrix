import { createSystemClient } from '@/lib/appwrite-admin';
import { ID, Query, Permission, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { notifyGiftCouponIssued, notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { calculateStackedSubscriptionCredit } from '@/lib/billing/subscription-stack';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';
import {
  shouldVerifyBlockBeeWebhookSignature,
  verifyBlockBeeWebhookPostSignature,
} from '@/lib/billing/blockbee-webhook-verify';
import {
  acquireBlockBeeIpnLock,
  completeBlockBeeIpnLock,
  getBlockBeePendingCheckout,
  markBlockBeePendingCheckoutConsumed,
  releaseBlockBeeIpnLock,
} from '@/lib/services/internal/blockbee-pending-checkout';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUB_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const ACCOUNT_EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;
const ACCOUNT_EVENTS_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

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

async function createGiftCouponRow(params: {
  databases: ReturnType<typeof createSystemClient>['databases'];
  payerUserId: string;
  payerName: string;
  recipientUserId: string;
  recipientName?: string;
  planId: string;
  months: number;
  currentPeriodEnd: string;
  giftMessage?: string | null;
  countryCode: string;
}) {
  const { databases } = params;
  const expiresAt = params.currentPeriodEnd;
  const payload = {
    userId: params.recipientUserId,
    type: 'coupon',
    actorId: params.payerUserId,
    relatedUserId: params.recipientUserId,
    status: 'active',
    discountPercent: 100,
    expiresAt,
    delta: null,
    metadata: JSON.stringify({
      source: 'billing.gift.checkout',
      gift: {
        kind: 'subscription-gift',
        planId: params.planId,
        months: params.months,
        payerUserId: params.payerUserId,
        payerName: params.payerName,
        recipientUserId: params.recipientUserId,
        recipientName: params.recipientName || null,
        giftMessage: params.giftMessage || null,
        countryCode: params.countryCode,
        expiresAt,
      },
    }),
  };

  return await databases.createRow(
    CHAT_DATABASE_ID,
    ACCOUNT_EVENTS_COLLECTION_ID,
    ID.unique(),
    payload,
    [Permission.read(Role.user(params.recipientUserId)), Permission.read(Role.user(params.payerUserId))],
  );
}

async function recordCompletedTransactionLedger(params: {
  databases: ReturnType<typeof createSystemClient>['databases'];
  paymentId: string;
  userId: string;
  planId: string;
  months: number;
  amountUsd: number;
  couponId?: string | null;
  metadata?: Record<string, any>;
}) {
  const { databases, paymentId, userId, planId, months, amountUsd, couponId, metadata } = params;
  try {
    let existingTx = null;
    try {
      existingTx = await databases.getRow(DATABASE_ID, 'billing_transactions', paymentId);
    } catch {
      // Ignore not found
    }

    const txPayload = {
      paymentId,
      userId,
      plan: planId,
      months,
      amountCents: Math.round(amountUsd * 100),
      amountUsd: `$${amountUsd.toFixed(2)}`,
      status: 'completed',
      provider: 'blockbee',
      couponId: couponId || null,
      metadata: JSON.stringify({
        completedAt: new Date().toISOString(),
        ...(metadata || {}),
      }),
      createdAt: existingTx ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingTx) {
      await databases.updateRow(
        DATABASE_ID,
        'billing_transactions',
        existingTx.$id,
        {
          status: 'completed',
          amountCents: txPayload.amountCents,
          amountUsd: txPayload.amountUsd,
          metadata: txPayload.metadata,
          updatedAt: txPayload.updatedAt,
        }
      );
    } else {
      await databases.createRow(
        DATABASE_ID,
        'billing_transactions',
        paymentId,
        txPayload,
        [Permission.read(Role.user(userId))]
      );
    }
  } catch (err) {
    console.error('[BlockBee IPN] Failed to log billing_transactions ledger entry:', err);
  }
}

async function logBillingWebhookCall(params: {
  paymentId?: string | null;
  provider: 'blockbee' | 'stripe';
  payload: string;
  headers?: Record<string, string>;
  status: 'success' | 'signature_failed' | 'failed';
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const { databases } = createSystemClient();
    await databases.createRow(
      DATABASE_ID,
      'billing_webhook_logs',
      ID.unique(),
      {
        paymentId: params.paymentId || null,
        provider: params.provider,
        payload: params.payload.slice(0, 65530),
        headers: params.headers ? JSON.stringify(params.headers).slice(0, 4990) : null,
        status: params.status,
        errorMessage: params.errorMessage || null,
        metadata: params.metadata ? JSON.stringify(params.metadata).slice(0, 4990) : null,
        createdAt: new Date().toISOString(),
      },
      []
    );
  } catch (err) {
    console.error('[Billing Logs] Failed to create billing_webhook_logs document:', err);
  }
}

function parseWebhookParams(rawBody: string, reqUrl: URL): URLSearchParams {
  const trimmed = rawBody.trim();
  let bodyParams: URLSearchParams;
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      bodyParams = new URLSearchParams();
      for (const [k, v] of Object.entries(j)) {
        if (v === undefined || v === null) continue;
        bodyParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    } catch {
      bodyParams = new URLSearchParams(trimmed);
    }
  } else {
    bodyParams = new URLSearchParams(trimmed);
  }

  if (!bodyParams.get('payment_id') && !bodyParams.get('order_id')) {
    const merged = new URLSearchParams(bodyParams);
    reqUrl.searchParams.forEach((v, k) => merged.set(k, v));
    return merged;
  }
  return bodyParams;
}

function parsePaidUsd(params: URLSearchParams): number {
  const raw =
    params.get('paid_amount_fiat') ||
    params.get('received_amount_fiat') ||
    params.get('value_paid_fiat') ||
    params.get('value_paid') ||
    '0';
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function paymentLooksComplete(params: URLSearchParams): boolean {
  const isPaid = params.get('is_paid');
  const status = String(params.get('status') || '').toLowerCase();
  const confirmed = params.get('confirmed');
  
  const paidOk = isPaid === '1' || confirmed === '1' || status === 'done';
  const checkoutDone = status === 'done';
  const legacyNumeric = status === '1' || status === '2';
  return paidOk && (checkoutDone || legacyNumeric || confirmed === '1');
}

/**
 * BlockBee checkout IPN — verified RSA signature + server-side pending checkout registry.
 */
export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return new Response('Bad body', { status: 400 });
  }

  const sig = req.headers.get('x-ca-signature') || req.headers.get('X-Ca-Signature');

  if (shouldVerifyBlockBeeWebhookSignature()) {
    if (!verifyBlockBeeWebhookPostSignature(rawBody, sig)) {
      console.error('[BlockBee IPN] Signature verification failed');
      await logBillingWebhookCall({
        provider: 'blockbee',
        payload: rawBody,
        headers: { signature: sig || '' },
        status: 'signature_failed',
        errorMessage: 'Signature verification failed',
      });
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[BlockBee IPN] BLOCKBEE_ALLOW_UNSIGNED_WEBHOOKS=true — signatures NOT verified');
  }

  const params = parseWebhookParams(rawBody || '', reqUrl);

  const paymentId = String(params.get('payment_id') || '').trim();
  if (!paymentId) {
    console.error('[BlockBee IPN] Missing payment_id');
    return new Response('Missing payment_id', { status: 400 });
  }

  if (!paymentLooksComplete(params)) {
    return new Response('*ok*', { status: 200 });
  }

  const pending = await getBlockBeePendingCheckout(paymentId);
  if (!pending) {
    console.error(`[BlockBee IPN] No pending checkout registry for payment_id=${paymentId} — refusing fulfillment`);
    return new Response('*ok*', { status: 200 });
  }

  const meta = pending.meta;
  const valuePaidUsd = parsePaidUsd(params);
  if (valuePaidUsd <= 0) {
    console.warn('[BlockBee IPN] Missing paid fiat amount');
    return new Response('*ok*', { status: 200 });
  }

  const floorPay = meta.expectedAmountUsd * 0.88;
  if (valuePaidUsd + 1e-6 < floorPay) {
    console.warn(
      `[BlockBee IPN] Paid ${valuePaidUsd} below expected floor ${floorPay} (registered ${meta.expectedAmountUsd})`,
    );
    return new Response('*ok*', { status: 200 });
  }

  let expectedPrice = calculateSubscriptionPrice(meta.planId, meta.countryCode, 'CRYPTO', meta.months);
  if (meta.couponId) {
    const { databases } = createSystemClient();
    const coupon = await databases.getRow(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, meta.couponId).catch(() => null);
    if (!coupon || String(coupon.type || '').toLowerCase() !== 'coupon') {
      console.warn('[BlockBee IPN] Pending checkout referenced invalid coupon');
      return new Response('*ok*', { status: 200 });
    }
    const md = parseMetadata(coupon.metadata);
    const couponMeta = parseMetadata(md.coupon);
    const couponDiscount = Number(coupon.discountPercent ?? coupon.discountPercentage ?? couponMeta.discountPercent ?? couponMeta.discountPercentage ?? 0);
    if (Number.isFinite(couponDiscount) && couponDiscount >= 0 && couponDiscount <= 100) {
      expectedPrice = expectedPrice * (1 - couponDiscount / 100);
    }
  }

  if (expectedPrice <= 0) {
    expectedPrice = 0.0001;
  }

  const ratio = valuePaidUsd / expectedPrice;
  const effectiveRatio = ratio >= 0.95 ? 1.0 : ratio;

  const lock = await acquireBlockBeeIpnLock(paymentId, meta.payerUserId);
  if (lock === 'skip') {
    return new Response('*ok*', { status: 200 });
  }
  if (lock === 'retry') {
    return new Response('retry', { status: 503 });
  }

  try {
    const { databases, users } = createSystemClient();

    const { currentPeriodStart, currentPeriodEnd, creditMs } = await calculateStackedSubscriptionCredit(
      databases,
      meta.payerUserId,
      meta.planId,
      meta.months,
      effectiveRatio,
    );
    const oneHourMs = 60 * 60 * 1000;

    if (creditMs < oneHourMs) {
      console.warn(`[BlockBee IPN] Payment too small after ratio for ${meta.payerUserId}`);
      await releaseBlockBeeIpnLock(paymentId);
      return new Response('*ok*', { status: 200 });
    }

    const payer = await users.get(meta.payerUserId).catch(() => null);
    const payerName = payer?.name || meta.payerUserId;

    if (meta.giftRecipientId) {
      const giftCoupon = await createGiftCouponRow({
        databases,
        payerUserId: meta.payerUserId,
        payerName,
        recipientUserId: meta.giftRecipientId,
        recipientName: meta.giftRecipientName || undefined,
        planId: meta.planId,
        months: meta.months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        giftMessage: meta.giftMessage || null,
        countryCode: meta.countryCode,
      });

      await notifyGiftCouponIssued({
        recipientUserId: meta.giftRecipientId,
        giverName: payerName,
        plan: meta.planId,
        months: meta.months,
        expiresAt: currentPeriodEnd.toISOString(),
        couponStatus: 'active',
        giftMessage:
          meta.giftMessage ||
          `A ${meta.months}-month ${meta.planId === 'PRO_YEAR' ? 'yearly' : 'monthly'} Kylrix Pro gift is waiting for you.`,
        claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/accounts/coupon/${giftCoupon.$id}`,
      }).catch((error) => {
        console.warn('[BlockBee IPN] Gift email send deferred:', error);
      });

      await recordCompletedTransactionLedger({
        databases,
        paymentId,
        userId: meta.payerUserId,
        planId: meta.planId,
        months: meta.months,
        amountUsd: valuePaidUsd,
        couponId: meta.couponId,
        metadata: {
          giftRecipientId: meta.giftRecipientId,
          giftCouponId: giftCoupon.$id,
        },
      });

      await completeBlockBeeIpnLock(paymentId, meta.payerUserId, {
        kind: 'gift_coupon',
        couponId: giftCoupon.$id,
      });
      await markBlockBeePendingCheckoutConsumed(paymentId);

      await logBillingWebhookCall({
        paymentId,
        provider: 'blockbee',
        payload: rawBody,
        headers: { signature: sig || '' },
        status: 'success',
        metadata: {
          giftRecipientId: meta.giftRecipientId,
          giftCouponId: giftCoupon.$id,
        },
      });

      return new Response('*ok*', { status: 200 });
    }

    const subData = {
      userId: meta.payerUserId,
      plan: 'pro',
      status: 'active',
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      seats: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const subscription = await databases.createRow(DATABASE_ID, SUB_COLLECTION_ID, ID.unique(), subData, [
      Permission.read(Role.user(meta.payerUserId))]);

    if (meta.couponId) {
      try {
        const coupon = await databases.getRow(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, meta.couponId).catch(() => null);
        if (coupon && String(coupon.type || '').toLowerCase() === 'coupon') {
          const couponMetadata = parseMetadata(coupon.metadata);
          const couponDetails = parseMetadata(couponMetadata.coupon);
          await databases.updateRow(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, meta.couponId, {
            status: 'applied',
            relatedUserId: meta.payerUserId,
            metadata: JSON.stringify({
              ...couponMetadata,
              coupon: {
                ...couponDetails,
                claimedBy: meta.payerUserId,
                appliedAt: new Date().toISOString(),
                claimState: 'applied',
                subscriptionId: subscription.$id,
              },
            }),
          });
        }
      } catch (error) {
        console.error('[BlockBee IPN] Failed to seal coupon claim:', error);
      }
    }

    const planTier = String(meta.planId || 'PRO').toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO';

    try {
      const prefs = (await users.getPrefs(meta.payerUserId)) as Record<string, unknown>;
      await users.updatePrefs(
        meta.payerUserId,
        applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), planTier),
      );
    } catch (err) {
      console.error('[BlockBee IPN] Failed to update user prefs:', err);
    }

    try {
      const profileRes = await databases.listRows(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('userId', meta.payerUserId)]);

      if (profileRes.total > 0) {
        await databases.updateRow(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, profileRes.rows[0].$id, {
          tier: planTier,
        });
      }
    } catch (err) {
      console.error('[BlockBee IPN] Failed to sync to profiles:', err);
    }

    await notifySubscriptionActivated({
      userId: meta.payerUserId,
      plan: meta.planId,
      months: meta.months,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      sourceLabel: 'Crypto payment',
      bodyCopy: `Your ${meta.months}-month access is live across Kylrix.`,
    }).catch((error) => {
      console.warn('[BlockBee IPN] Subscription email send deferred:', error);
    });

    await recordCompletedTransactionLedger({
      databases,
      paymentId,
      userId: meta.payerUserId,
      planId: meta.planId,
      months: meta.months,
      amountUsd: valuePaidUsd,
      couponId: meta.couponId,
      metadata: {
        subscriptionId: subscription.$id,
      },
    });

    await completeBlockBeeIpnLock(paymentId, meta.payerUserId, {
      kind: 'subscription',
      subscriptionId: subscription.$id,
      ratio: ratio.toFixed(4),
    });
    await markBlockBeePendingCheckoutConsumed(paymentId);

    await logBillingWebhookCall({
      paymentId,
      provider: 'blockbee',
      payload: rawBody,
      headers: { signature: sig || '' },
      status: 'success',
      metadata: {
        userId: meta.payerUserId,
        planId: meta.planId,
      },
    });

    return new Response('*ok*', { status: 200 });
  } catch (error: any) {
    console.error('[BlockBee IPN] Error processing:', error);
    await logBillingWebhookCall({
      paymentId: paymentId || null,
      provider: 'blockbee',
      payload: rawBody,
      headers: { signature: sig || '' },
      status: 'failed',
      errorMessage: error?.message || String(error),
    });
    await releaseBlockBeeIpnLock(paymentId);
    return new Response('Error', { status: 500 });
  }
}

export async function GET() {
  return new Response('*ok*', { status: 200 });
}
