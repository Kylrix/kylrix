'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { getActor } from '@/lib/actions/secure-ops/auth-helper';
import { dispatchTelegramNotification } from '@/lib/services/internal/telegram-dispatch';
import { renderEmailTemplate } from '@/lib/email-renderer';
import { ID } from 'node-appwrite';

export interface PaymentIntentRecord {
  tier: 'PRO' | 'TEAMS';
  months: number;
  planId: string;
  checkoutUrl?: string;
  createdAt: number;
  remindedAt?: number;
}

const INTENT_PREF_KEY = 'kylrix_pending_checkout_intent';

/**
 * Persists a user's initiated payment intent to their Appwrite user preferences.
 */
export async function recordPaymentIntentAction(input: {
  tier: 'PRO' | 'TEAMS';
  months: number;
  planId: string;
  checkoutUrl?: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(input.jwt);
    if (!actor || !actor.$id) return { success: false, error: 'Unauthorized' };

    const { users } = createSystemClient();
    const userDoc = await users.get(actor.$id);
    const existingPrefs = (userDoc.prefs || {}) as Record<string, unknown>;

    const record: PaymentIntentRecord = {
      tier: input.tier,
      months: input.months,
      planId: input.planId,
      checkoutUrl: input.checkoutUrl,
      createdAt: Date.now(),
    };

    await users.updatePrefs(actor.$id, {
      ...existingPrefs,
      [INTENT_PREF_KEY]: JSON.stringify(record),
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to record payment intent:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Clears the payment intent once subscription is active or user dismissed.
 */
export async function clearPaymentIntentAction(jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor || !actor.$id) return { success: false, error: 'Unauthorized' };

    const { users } = createSystemClient();
    const userDoc = await users.get(actor.$id);
    const existingPrefs = (userDoc.prefs || {}) as Record<string, unknown>;

    if (existingPrefs[INTENT_PREF_KEY]) {
      const copy = { ...existingPrefs };
      delete copy[INTENT_PREF_KEY];
      await users.updatePrefs(actor.$id, copy);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to clear payment intent:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Checks for a pending payment intent >= 1 hour old and dispatches friendly reminder if not reminded yet.
 */
export async function checkAndRemindPaymentIntentAction(jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor || !actor.$id) return { hasPending: false };

    const { users } = createSystemClient();
    const userDoc = await users.get(actor.$id);
    const existingPrefs = (userDoc.prefs || {}) as Record<string, unknown>;
    const raw = existingPrefs[INTENT_PREF_KEY];

    if (!raw || typeof raw !== 'string') return { hasPending: false };

    let record: PaymentIntentRecord;
    try {
      record = JSON.parse(raw);
    } catch {
      return { hasPending: false };
    }

    // Must be at least 1 hour (3600000 ms) old
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    const age = now - (record.createdAt || 0);

    if (age < ONE_HOUR) {
      return { hasPending: false };
    }

    // If already reminded, return pending status for client prompt without re-dispatching external messages
    if (record.remindedAt) {
      return { hasPending: true, record };
    }

    // Mark as reminded so it never dispatches again
    record.remindedAt = now;
    await users.updatePrefs(actor.$id, {
      ...existingPrefs,
      [INTENT_PREF_KEY]: JSON.stringify(record),
    });

    const tierName = record.tier === 'TEAMS' ? 'Kylrix Teams' : 'Kylrix Pro';
    const planDuration = `${record.months} month${record.months > 1 ? 's' : ''}`;

    // 1. Dispatch Telegram notification if linked & verified
    const tgMessage = `✨ <b>Finish upgrading your Kylrix workspace</b>\n\nYou started an upgrade to <b>${tierName}</b> (${planDuration}) earlier. Whenever you're ready, tap below to complete your checkout and unlock unlimited tools, AI sidekicks, and storage.\n\n<a href="${record.checkoutUrl || 'https://www.kylrix.space'}">Complete Checkout →</a>`;

    const tgSent = await dispatchTelegramNotification(actor.$id, tgMessage, {
      title: 'Upgrade Reminder',
    }).catch(() => false);

    // 2. If Telegram was not delivered, send a clean email
    if (!tgSent && userDoc.email) {
      try {
        const { messaging } = createSystemClient();
        const rendered = await renderEmailTemplate('subscription-update', {
          recipientName: userDoc.name || userDoc.email.split('@')[0],
          planLabel: tierName,
          durationLabel: planDuration,
          currentPeriodEnd: 'Pending Checkout',
          sourceLabel: 'Kylrix Billing',
          bodyCopy: `You recently started an upgrade to ${tierName} (${planDuration}). You can resume anytime to unlock full workspace power, AI agents, and file storage.`,
          ctaUrl: record.checkoutUrl || 'https://www.kylrix.space',
        });

        await messaging.createEmail({
          messageId: ID.unique(),
          subject: `Finish setting up ${tierName}`,
          content: rendered.html,
          users: [actor.$id],
          html: true,
        });
      } catch (emailErr) {
        console.warn('Could not dispatch reminder email:', emailErr);
      }
    }

    return { hasPending: true, record };
  } catch (err) {
    console.error('Payment intent check failed:', err);
    return { hasPending: false };
  }
}
