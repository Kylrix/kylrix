import { createAdminClient } from '@/lib/appwrite-admin';
import { ID, Query, Permission, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { notifyGiftCouponIssued, notifySubscriptionActivated } from '@/lib/billing/subscription-notifications';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';

// Constants for readability
const DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE; // Using NOTE db as per config for subscriptions
const SUB_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const ACCOUNT_EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;
const ACCOUNT_EVENTS_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

function parsePositiveInteger(value: string | null, fallback = 1) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function calculateStackedPeriod(databases: ReturnType<typeof createAdminClient>['databases'], userId: string, planId: string, months: number, effectiveRatio: number) {
  const now = new Date();
  let currentPeriodStart = now;

  try {
    const existingSubs = await databases.listDocuments(DATABASE_ID, SUB_COLLECTION_ID, [
      Query.equal('userId', userId),
      Query.limit(100),
      Query.select(['$id', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt', 'status', 'plan']),
    ]);

    const activeSubscriptions = (existingSubs.documents as SubscriptionRow[]).filter(
      (row) => String(row.status || '').toLowerCase() === 'active'
    );
    const latestSubscription = pickLatestSubscription(activeSubscriptions);
    if (latestSubscription?.currentPeriodEnd) {
      const latestExpiry = new Date(latestSubscription.currentPeriodEnd);
      if (latestExpiry > now) {
        currentPeriodStart = latestExpiry;
      }
    }
  } catch (_e) {
    console.warn('[BlockBee IPN] Failed to fetch existing subs for stacking, defaulting to NOW', _e);
  }

  const baseDurationMs = planId === 'PRO_YEAR'
    ? (months === 1 ? 365 : 30 * months) * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  const intendedDurationMs = planId === 'PRO_YEAR'
    ? baseDurationMs
    : baseDurationMs * Math.max(1, months);
  const creditMs = Math.floor(intendedDurationMs * effectiveRatio);
  const currentPeriodEnd = new Date(currentPeriodStart.getTime() + creditMs);

  return {
    currentPeriodStart,
    currentPeriodEnd,
    creditMs,
    intendedDurationMs,
  };
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

async function createGiftCouponRow(params: {
  databases: ReturnType<typeof createAdminClient>['databases'];
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

  return await databases.createDocument(
    CHAT_DATABASE_ID,
    ACCOUNT_EVENTS_COLLECTION_ID,
    ID.unique(),
    payload,
    [
      Permission.read(Role.user(params.recipientUserId)),
      Permission.read(Role.user(params.payerUserId)),
    ],
  );
}

/**
 * BlockBee IPN (Instant Payment Notification) Handler
 * Documentation: https://blockbee.com/docs/ipn/
 * 
 * Logic:
 * - Proportional time calculation based on amount paid vs PPP-adjusted expected price.
 * - 95% and above = Full intended timeframe.
 * - < 95% = Exact fractional credit.
 * - Minimum threshold: 1 hour worth of subscription time.
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    let body: FormData | null = null;
    try {
      body = await req.formData();
    } catch (_e) {
      // Not form data
    }

    const getParam = (name: string) => {
      return searchParams.get(name) || (body ? body.get(name) as string : null);
    };

    // BlockBee sends data as POST parameters (form-data)
    const userId = getParam('order_id');
    const planId = getParam('plan_id') || 'PRO_MONTH';
    const months = parsePositiveInteger(getParam('months'), 1);
    const status = getParam('status');
    const isPaid = getParam('is_paid'); // '1' if paid, '0' otherwise
    const giftRecipientId = getParam('gift_recipient_id') || null;
    const giftRecipientName = getParam('gift_recipient_name') || null;
    const giftMessage = getParam('gift_message') || null;
    const couponId = getParam('coupon_id') || null;
    
    // BlockBee provided amounts (in USD since we use currency=USD in the request)
    // value_paid_fiat is the actual fiat value that reached the payment provider.
    const valuePaidUsd = parseFloat(getParam('value_paid_fiat') || getParam('value_paid') || '0');
    
    console.log(`[BlockBee IPN] Received: userId=${userId}, planId=${planId}, status=${status}, isPaid=${isPaid}, valuePaidUsd=${valuePaidUsd}`);

    if (!userId) {
      console.error('[BlockBee IPN] Missing order_id');
      return new Response('Missing order_id', { status: 400 });
    }

    // Status codes: -1: Cancelled, 0: Pending, 1: Confirmed, 2: Partially Paid
    if (isPaid === '1' || status === '1' || status === '2') {
      const { databases, users } = createAdminClient();

      // Get user prefs to identify region (PPP)
      let countryCode = 'US';
      try {
        const userPrefs = await users.getPrefs(userId);
        countryCode = userPrefs.region || 'US';
      } catch (_e) {
        console.warn(`[BlockBee IPN] Could not fetch prefs for ${userId}, defaulting to US PPP`, _e);
      }

      // Expected price for the INTENDED plan
      let expectedPrice = calculateSubscriptionPrice(planId, countryCode, 'CRYPTO', months);
      if (couponId) {
        const { databases } = createAdminClient();
        const coupon = await databases.getDocument(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, couponId).catch(() => null);
        if (!coupon || String(coupon.type || '').toLowerCase() !== 'coupon') {
          console.warn('[BlockBee IPN] Coupon discount referenced a missing coupon row');
          return new Response('*ok*', { status: 200 });
        }

        const metadata = parseMetadata(coupon.metadata);
        const couponMeta = parseMetadata(metadata.coupon);
        const couponDiscount = Number(coupon.discountPercent ?? couponMeta.discountPercent ?? 0);
        if (Number.isFinite(couponDiscount) && couponDiscount >= 0 && couponDiscount <= 100) {
          expectedPrice = expectedPrice * (1 - couponDiscount / 100);
        }
      }

      if (expectedPrice <= 0) {
        expectedPrice = 0.0001;
      }
      
      // Calculate proportionality
      const ratio = valuePaidUsd / expectedPrice;
      
      // 95% Tolerance Logic: 0.95 and above gives 100% of the intended timeframe
      const effectiveRatio = ratio >= 0.95 ? 1.0 : ratio;
      
      const { currentPeriodStart, currentPeriodEnd, creditMs } = await calculateStackedPeriod(
        databases,
        userId,
        planId,
        months,
        effectiveRatio,
      );
      const oneHourMs = 60 * 60 * 1000;

      // Threshold Guard: Minimum 1 hour worth of time
      if (creditMs < oneHourMs) {
        console.warn(`[BlockBee IPN] Payment too small for ${userId}: ${valuePaidUsd} USD -> ${creditMs}ms. Min threshold is 1 hour.`);
        return new Response('*ok*', { status: 200 });
      }

      const payer = await users.get(userId).catch(() => null);
      const payerName = payer?.name || userId;

      if (giftRecipientId) {
        const giftCoupon = await createGiftCouponRow({
          databases,
          payerUserId: userId,
          payerName,
          recipientUserId: giftRecipientId,
          recipientName: giftRecipientName || undefined,
          planId,
          months,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          giftMessage,
          countryCode,
        });

        await notifyGiftCouponIssued({
          recipientUserId: giftRecipientId,
          giverName: payerName,
          plan: planId,
          months,
          expiresAt: currentPeriodEnd.toISOString(),
          couponStatus: 'active',
          giftMessage: giftMessage || `A ${months}-month ${planId === 'PRO_YEAR' ? 'yearly' : 'monthly'} Kylrix Pro gift is waiting for you.`,
          claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/accounts/coupon/${giftCoupon.$id}`,
        }).catch((error) => {
          console.warn('[BlockBee IPN] Gift email send deferred:', error);
        });

        console.log(`[BlockBee IPN] Created gift coupon ${giftCoupon.$id} for ${giftRecipientId} from ${userId}.`);
        return new Response('*ok*', { status: 200 });
      }

      // 2. Create DISCRETE Subscription Unit (New Row)
      const subData = {
        userId,
        plan: 'pro',
        status: 'active',
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        seats: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const subscription = await databases.createDocument(DATABASE_ID, SUB_COLLECTION_ID, ID.unique(), subData, [
        Permission.read(Role.user(userId))
      ]);
      console.log(`[BlockBee IPN] Created proportional sub for user ${userId}. Paid: ${valuePaidUsd} (Ratio: ${ratio.toFixed(4)}). Added: ${(creditMs / (24 * 60 * 60 * 1000)).toFixed(2)} days. New Expiry: ${currentPeriodEnd.toISOString()}`);

      if (couponId) {
        try {
          const coupon = await databases.getDocument(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, couponId).catch(() => null);
          if (coupon && String(coupon.type || '').toLowerCase() === 'coupon') {
            const couponMetadata = parseMetadata(coupon.metadata);
            const couponDetails = parseMetadata(couponMetadata.coupon);
            await databases.updateDocument(CHAT_DATABASE_ID, ACCOUNT_EVENTS_TABLE_ID, couponId, {
              status: 'applied',
              relatedUserId: userId,
              metadata: JSON.stringify({
                ...couponMetadata,
                coupon: {
                  ...couponDetails,
                  claimedBy: userId,
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

      // 3. Update User Prefs (ledger-aligned keys — never rely on `tier` alone)
      try {
        const prefs = (await users.getPrefs(userId)) as Record<string, unknown>;
        await users.updatePrefs(userId, applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString()));
      } catch (err) {
        console.error('[BlockBee IPN] Failed to update user prefs:', err);
      }

      // 4. Sync to Public Profile
      try {
        const profileRes = await databases.listDocuments(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, [
          Query.equal('userId', userId)
        ]);

        if (profileRes.total > 0) {
          await databases.updateDocument(CHAT_DATABASE_ID, PROFILES_COLLECTION_ID, profileRes.documents[0].$id, {
            tier: 'PRO'
          });
        }
      } catch (err) {
        console.error('[BlockBee IPN] Failed to sync to profiles:', err);
      }

      await notifySubscriptionActivated({
        userId,
        plan: planId,
        months,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: 'Crypto payment',
        bodyCopy: giftRecipientId
          ? `Your gift checkout was processed and the subscription ledger has been updated.`
          : `Your ${months}-month access is live across Kylrix.`,
      }).catch((error) => {
        console.warn('[BlockBee IPN] Subscription email send deferred:', error);
      });
      
      return new Response('*ok*', { status: 200 });
    }

    return new Response('*ok*', { status: 200 }); // Always acknowledge IPN
  } catch (error) {
    console.error('[BlockBee IPN] Error processing:', error);
    return new Response('Error', { status: 500 });
  }
}

export async function GET() {
  return new Response('*ok*', { status: 200 });
}
