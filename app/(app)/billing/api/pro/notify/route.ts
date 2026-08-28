import { createSystemClient } from '@/lib/appwrite-admin';
import { ID, Query, Permission, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { calculateStackedSubscriptionCredit } from '@/lib/billing/subscription-stack';
import { notifySubscriptionActivated, notifyGiftSubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';
import {
  shouldVerifyBlockBeeWebhookSignature,
  verifyBlockBeeWebhookPostSignature} from '@/lib/billing/blockbee-webhook-verify';
import {
  acquireBlockBeeIpnLock,
  completeBlockBeeIpnLock,
  getBlockBeePendingCheckout,
  markBlockBeePendingCheckoutConsumed,
  releaseBlockBeeIpnLock} from '@/lib/services/internal/blockbee-pending-checkout';
import { SponsorshipService } from '@/lib/services/sponsorship-service';
import { BadgeTier } from '@/lib/types/badges';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUB_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const ACCOUNT_EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

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
        ...(metadata || {})}),
      createdAt: existingTx ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString()};

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
          updatedAt: txPayload.updatedAt}
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
        createdAt: new Date().toISOString()},
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
        errorMessage: 'Signature verification failed'});
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
      `[BlockBee IPN] Paid ${valuePaidUsd} below expected floor ${floorPay} (registered ${meta.expectedAmountUsd})`);
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

  // Handle Sponsorship payment fulfillment
  if (meta.planId?.startsWith('SPONSOR_') || params.get('is_sponsorship') === '1') {
    try {
      let sponsorCouponMeta: any = {};
      if (meta.couponId) {
        try {
          sponsorCouponMeta = JSON.parse(meta.couponId);
        } catch {}
      }
      const resolvedTier = (sponsorCouponMeta.tier || meta.planId.replace('SPONSOR_', '').toLowerCase() || 'supporter') as BadgeTier;
      const targetUserId = meta.payerUserId && meta.payerUserId !== 'guest_sponsor' ? meta.payerUserId : null;

      await SponsorshipService.recordCompletedSponsorship({
        userId: targetUserId,
        sponsorName: meta.giftRecipientName || null,
        sponsorMessage: meta.giftMessage || null,
        sponsorUrl: sponsorCouponMeta.sponsorUrl || null,
        sponsorEmail: sponsorCouponMeta.sponsorEmail || null,
        amount: valuePaidUsd,
        currency: 'USD',
        provider: 'blockbee',
        tier: resolvedTier,
        txHash: paymentId,
        isPublic: sponsorCouponMeta.isPublic ?? true,
        isAnonymous: sponsorCouponMeta.isAnonymous ?? false,
        metadata: {
          blockbeePaymentId: paymentId,
          paidUsd: valuePaidUsd,
        },
      });

      await completeBlockBeeIpnLock(paymentId, meta.payerUserId, {
        subscriptionId: 'sponsorship_' + paymentId,
        targetUserId: targetUserId || 'anonymous',
        planId: meta.planId,
        valuePaidUsd,
      });
      await markBlockBeePendingCheckoutConsumed(paymentId);
      return new Response('*ok*', { status: 200 });
    } catch (err) {
      console.error('[BlockBee IPN] Failed to fulfill sponsorship:', err);
      await releaseBlockBeeIpnLock(paymentId);
      return new Response('*ok*', { status: 200 });
    }
  }

  try {
    const { databases, users } = createSystemClient();

    const targetUserId = meta.giftRecipientId || meta.payerUserId;
    const isGift = Boolean(meta.giftRecipientId && meta.giftRecipientId !== meta.payerUserId);

    const { currentPeriodStart, currentPeriodEnd, creditMs } = await calculateStackedSubscriptionCredit(
      databases,
      targetUserId,
      meta.planId,
      meta.months,
      effectiveRatio);
    const oneHourMs = 60 * 60 * 1000;

    if (creditMs < oneHourMs) {
      console.warn(`[BlockBee IPN] Payment too small after ratio for ${meta.payerUserId} -> ${targetUserId}`);
      await releaseBlockBeeIpnLock(paymentId);
      return new Response('*ok*', { status: 200 });
    }

    const payer = await users.get(meta.payerUserId).catch(() => null);
    const payerName = payer?.name || meta.payerUserId;

    const subData = {
      userId: targetUserId,
      plan: 'pro',
      status: 'active',
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      seats: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()};

    const permissions = [Permission.read(Role.user(targetUserId))];
    if (isGift) {
      permissions.push(Permission.read(Role.user(meta.payerUserId)));
    }

    const subscription = await databases.createRow(DATABASE_ID, SUB_COLLECTION_ID, ID.unique(), subData, permissions);

    if (meta.couponId) {
      try {
        const coupon = await databases.getRow(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, meta.couponId).catch(() => null);
        if (coupon && String(coupon.type || '').toLowerCase() === 'coupon') {
          const couponMetadata = parseMetadata(coupon.metadata);
          const couponDetails = parseMetadata(couponMetadata.coupon);
          await databases.updateRow(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, meta.couponId, {
            status: 'applied',
            relatedUserId: targetUserId,
            metadata: JSON.stringify({
              ...couponMetadata,
              coupon: {
                ...couponDetails,
                claimedBy: targetUserId,
                appliedAt: new Date().toISOString(),
                claimState: 'applied',
                subscriptionId: subscription.$id}})});
        }
      } catch (error) {
        console.error('[BlockBee IPN] Failed to seal coupon claim:', error);
      }
    }

    const planTier = String(meta.planId || 'PRO').toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO';

    // 1. Update user preferences for active Pro status
    try {
      const prefs = (await users.getPrefs(targetUserId)) as Record<string, unknown>;
      await users.updatePrefs(
        targetUserId,
        applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), planTier));
    } catch (err) {
      console.error('[BlockBee IPN] Failed to update user prefs:', err);
    }

    // 2. Sync tier to profile
    try {
      const profileRes = await databases.listRows(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('userId', targetUserId)]);

      if (profileRes.total > 0) {
        await databases.updateRow(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, profileRes.rows[0].$id, {
          tier: planTier});
      }
    } catch (err) {
      console.error('[BlockBee IPN] Failed to sync to profiles:', err);
    }

    // 3. Record transaction ledger
    await recordCompletedTransactionLedger({
      databases,
      paymentId,
      userId: meta.payerUserId,
      planId: meta.planId,
      months: meta.months,
      amountUsd: valuePaidUsd,
      couponId: meta.couponId,
      metadata: {
        isGift,
        giftRecipientId: meta.giftRecipientId || null,
        giftRecipientName: meta.giftRecipientName || null,
        giftMessage: meta.giftMessage || null,
        subscriptionId: subscription.$id}});

    // 4. Send Notifications
    if (isGift && meta.giftRecipientId) {
      await notifyGiftSubscriptionActivated({
        recipientUserId: meta.giftRecipientId,
        giverName: payerName,
        plan: meta.planId,
        months: meta.months,
        expiresAt: currentPeriodEnd.toISOString(),
        giftMessage: meta.giftMessage || null,
      }).catch((err: any) => {
        console.warn('[BlockBee IPN] Gift notification deferred:', err);
      });

      await notifySubscriptionActivated({
        userId: meta.payerUserId,
        plan: meta.planId,
        months: meta.months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: 'Gift payment',
        bodyCopy: `Your gift subscription for ${meta.giftRecipientName || meta.giftRecipientId} has been successfully processed and is now active on their account.`,
      }).catch(() => {});
    } else {
      await notifySubscriptionActivated({
        userId: meta.payerUserId,
        plan: meta.planId,
        months: meta.months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: 'Crypto payment',
        bodyCopy: `Your subscription is confirmed and access is active through ${currentPeriodEnd.toLocaleDateString()}.`});
    }

    await completeBlockBeeIpnLock(paymentId, meta.payerUserId, {
      kind: 'subscription',
      isGift,
      targetUserId,
      subscriptionId: subscription.$id});
    await markBlockBeePendingCheckoutConsumed(paymentId);

    await logBillingWebhookCall({
      paymentId,
      provider: 'blockbee',
      payload: rawBody,
      headers: { signature: sig || '' },
      status: 'success',
      metadata: {
        isGift,
        targetUserId,
        giftRecipientId: meta.giftRecipientId || null,
        subscriptionId: subscription.$id}});

    return new Response('*ok*', { status: 200 });
  } catch (error: any) {
    console.error('[BlockBee IPN] Error processing:', error);
    await logBillingWebhookCall({
      paymentId: paymentId || null,
      provider: 'blockbee',
      payload: rawBody,
      headers: { signature: sig || '' },
      status: 'failed',
      errorMessage: error?.message || String(error)});
    await releaseBlockBeeIpnLock(paymentId);
    return new Response('Error', { status: 500 });
  }
}

export async function GET() {
  return new Response('*ok*', { status: 200 });
}
