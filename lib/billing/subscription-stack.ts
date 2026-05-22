import { Query } from 'node-appwrite';
import type { Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUB_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

/** Stack new paid time after latest active subscription end (ratio 1 = full term). */
export async function calculateStackedSubscriptionCredit(
  databases: Databases,
  userId: string,
  planId: string,
  months: number,
  effectiveRatio: number,
) {
  const now = new Date();
  let currentPeriodStart = now;

  try {
    const existingSubs = await databases.listDocuments(NOTE_DB_ID, SUB_COLLECTION_ID, [
      Query.equal('userId', userId),
      Query.limit(100),
      Query.select(['$id', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt', 'status', 'plan'])]);

    const activeSubscriptions = (existingSubs.documents as SubscriptionRow[]).filter(
      (row) => String(row.status || '').toLowerCase() === 'active',
    );
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
    intendedDurationMs,
  };
}
