import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { ulid } from '@/lib/utils/ulid';
import { eq } from 'drizzle-orm';
import { calculateStackedSubscriptionCredit } from '@/lib/billing/subscription-stack';
import { notifySubscriptionActivated, notifyGiftSubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';
import { verifyBachsWebhookSignature } from '@/lib/billing/bachs-webhook-verify';
import { getBlockBeePendingCheckout, markBlockBeePendingCheckoutConsumed } from '@/lib/services/internal/blockbee-pending-checkout';

export async function POST(req: Request) {
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return new Response('Bad request body', { status: 400 });
  }

  const isValid = verifyBachsWebhookSignature(rawBody, req.headers);
  if (!isValid) {
    console.error('[Bachs Webhook] Invalid signature rejected');
    return new Response('Invalid signature', { status: 401 });
  }

  let event: any = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const eventType = String(event?.type || '').toLowerCase();
  const eventData = event?.data || {};

  // We fulfill on either checkout.completed (with payment collected) or collection.succeeded
  const isCheckoutCompleted = eventType === 'checkout.completed';
  const isCollectionSucceeded = eventType === 'collection.succeeded';

  if (!isCheckoutCompleted && !isCollectionSucceeded) {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify payment was actually collected
  if (isCheckoutCompleted && eventData.payment_status !== 'paid' && eventData.payment_status !== 'no_payment_required') {
    return new Response(JSON.stringify({ received: true, pending: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const checkoutId = String(eventData.checkout_id || eventData.reference || '').trim();
  if (!checkoutId) {
    return new Response('Missing checkout_id', { status: 400 });
  }

  const pending = await getBlockBeePendingCheckout(checkoutId);
  const metadata = eventData.metadata || pending?.meta || {};
  const payerUserId = metadata.userId || pending?.meta?.payerUserId;
  const planId = metadata.planId || pending?.meta?.planId || 'PRO_MONTH';
  const months = parseInt(String(metadata.months || pending?.meta?.months || '1'), 10) || 1;
  const giftRecipientId = metadata.giftRecipientId || pending?.meta?.giftRecipientId || null;
  const giftRecipientName = metadata.giftRecipientName || pending?.meta?.giftRecipientName || null;
  const targetUserId = giftRecipientId || payerUserId;
  const isGift = Boolean(giftRecipientId && giftRecipientId !== payerUserId);

  if (!targetUserId) {
    console.warn(`[Bachs Webhook] No target user found for checkoutId=${checkoutId}`);
    return new Response(JSON.stringify({ received: true, status: 'no_user' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { currentPeriodEnd } = await calculateStackedSubscriptionCredit(
      null,
      targetUserId,
      planId,
      months,
      1.0,
    );

    const now = new Date().toISOString();
    const subId = ulid();

    await db.insert(schema.subscriptions).values({
      id: subId,
      userId: targetUserId,
      tier: 'pro',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const planTier = String(planId).toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO';

    try {
      const settings = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, targetUserId)).limit(1);
      let prefs: Record<string, unknown> = {};
      if (settings.length > 0 && settings[0].preferences) {
        try { prefs = JSON.parse(settings[0].preferences); } catch {}
      }
      const updatedPrefs = applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), planTier);
      if (settings.length > 0) {
        await db.update(schema.userSettings).set({ preferences: JSON.stringify(updatedPrefs), updatedAt: now }).where(eq(schema.userSettings.userId, targetUserId));
      } else {
        await db.insert(schema.userSettings).values({
          id: `settings-${targetUserId}`,
          userId: targetUserId,
          preferences: JSON.stringify(updatedPrefs),
          securityFlags: '{}',
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.error('[Bachs Webhook] Failed to update user prefs:', err);
    }

    try {
      await db.update(schema.profiles).set({ status: planTier, updatedAt: now }).where(eq(schema.profiles.userId, targetUserId));
    } catch (err) {
      console.error('[Bachs Webhook] Failed to sync to profiles:', err);
    }

    const amountUsd = parseFloat(String(eventData.amount || '0')) || 0;

    await db.insert(schema.billingTransactions).values({
      id: ulid(),
      paymentId: checkoutId,
      userId: payerUserId || targetUserId,
      plan: planId,
      amountUsd: `$${amountUsd.toFixed(2)}`,
      status: 'completed',
      provider: 'bachs',
      couponId: metadata.couponId || null,
      metadata: JSON.stringify({
        completedAt: now,
        isGift,
        giftRecipientId,
        giftRecipientName,
        subscriptionId: subId,
        bachsEventId: event.id,
      }),
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().catch((err) => console.error('[Bachs Webhook] Tx ledger error:', err));

    await markBlockBeePendingCheckoutConsumed(checkoutId).catch(() => {});

    if (isGift && giftRecipientId) {
      await notifyGiftSubscriptionActivated({
        recipientUserId: giftRecipientId,
        giverName: payerUserId || 'A friend',
        plan: planId,
        months,
        expiresAt: currentPeriodEnd.toISOString(),
      }).catch(() => {});
    } else if (payerUserId) {
      await notifySubscriptionActivated({
        userId: payerUserId,
        plan: planId,
        months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: 'Card payment (Bachs)',
        bodyCopy: `Your subscription is confirmed and access is active through ${currentPeriodEnd.toLocaleDateString()}.`,
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ received: true, fulfilled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Bachs Webhook] Error fulfilling subscription:', error);
    return new Response('Internal error', { status: 500 });
  }
}

export async function GET() {
  return new Response('Bachs webhook endpoint active', { status: 200 });
}
