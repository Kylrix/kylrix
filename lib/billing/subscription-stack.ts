import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';

/** Stack new paid time after latest active subscription end (ratio 1 = full term). */
export async function calculateStackedSubscriptionCredit(
  _databases: any,
  userId: string,
  planId: string,
  months: number,
  effectiveRatio: number) {
  const now = new Date();
  let currentPeriodStart = now;

  try {
    const existingSubs = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(100);

    const activeSubscriptions = (existingSubs as unknown as SubscriptionRow[]).filter(
      (row) => String(row.status || '').toLowerCase() === 'active');
    const latestSubscription = pickLatestSubscription(activeSubscriptions);
    if (latestSubscription?.currentPeriodEnd) {
      const latestExpiry = new Date(latestSubscription.currentPeriodEnd);
      if (latestExpiry > now) {
        currentPeriodStart = latestExpiry;
      }
    }
  } catch (_e) {
    console.warn('[subscription-stack] Failed to fetch existing subs for stacking', _e);
  }

  const baseDurationMs =
    planId === 'PRO_YEAR'
      ? (months === 1 ? 365 : 30 * months) * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
  const intendedDurationMs = planId === 'PRO_YEAR' ? baseDurationMs : baseDurationMs * Math.max(1, months);
  const creditMs = Math.floor(intendedDurationMs * effectiveRatio);
  const currentPeriodEnd = new Date(currentPeriodStart.getTime() + creditMs);

  return {
    currentPeriodStart,
    currentPeriodEnd,
    creditMs,
    intendedDurationMs};
}
