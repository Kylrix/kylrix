'use server';

import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';
import { resolveBlockBeeNotifyBaseUrl, resolveBlockBeeRedirectBaseUrl } from '@/lib/billing/blockbee-urls';
import { registerBlockBeePendingCheckout } from '@/lib/services/internal/blockbee-pending-checkout';
import { SponsorshipService } from '@/lib/services/sponsorship-service';
import { BadgeTier, resolveBadgeForAmount } from '@/lib/types/badges';

export async function createSponsorshipCheckoutAction(input: {
  amountUsd: number;
  tier?: BadgeTier;
  sponsorName?: string;
  sponsorUrl?: string;
  sponsorEmail?: string;
  sponsorMessage?: string;
  isPublic?: boolean;
  isAnonymous?: boolean;
  jwt?: string;
}) {
  const {
    amountUsd,
    tier = 'supporter',
    sponsorName,
    sponsorUrl,
    sponsorEmail,
    sponsorMessage,
    isPublic = true,
    isAnonymous = false,
    jwt,
  } = input;

  if (!amountUsd || amountUsd < 1) {
    throw new Error('Minimum sponsorship amount is $1.00 USD');
  }

  const user = await getAuthenticatedUserForBillingAction({ jwt }).catch(() => null);
  const userId = user?.$id || 'guest_sponsor';

  const blockbeeApiKey = process.env.BLOCKBEE_API;
  if (!blockbeeApiKey) {
    throw new Error('BlockBee API is not configured on this instance.');
  }

  const resolvedTier = tier || resolveBadgeForAmount(amountUsd)?.tier || 'custom';
  const planId = `SPONSOR_${resolvedTier.toUpperCase()}`;

  const notifyUrl = new URL(resolveBlockBeeNotifyBaseUrl());
  notifyUrl.searchParams.set('order_id', userId);
  notifyUrl.searchParams.set('plan_id', planId);
  notifyUrl.searchParams.set('is_sponsorship', '1');
  notifyUrl.searchParams.set('tier', resolvedTier);

  const redirectUrl = new URL(resolveBlockBeeRedirectBaseUrl());
  redirectUrl.searchParams.set('order_id', userId);
  redirectUrl.searchParams.set('sponsor', '1');

  const queryParams: Record<string, string> = {
    apikey: blockbeeApiKey,
    value: amountUsd.toString(),
    currency: 'USD',
    redirect_url: redirectUrl.toString(),
    notify_url: notifyUrl.toString(),
    post: '1',
  };

  const emailToUse = sponsorEmail || user?.email;
  if (emailToUse) {
    queryParams.customer_email = emailToUse;
  }

  const queryString = new URLSearchParams(queryParams).toString();
  const response = await fetch(`https://api.blockbee.io/checkout/request/?${queryString}`);
  const data = await response.json();

  if (data.status !== 'success') {
    const errMsg = data.error || data.message || 'Failed to initialize BlockBee payment';
    throw new Error(`BlockBee Error: ${errMsg}`);
  }

  const paymentId = String(data.payment_id || '').trim();

  // Register in pending checkout so IPN can verify & fulfill
  await registerBlockBeePendingCheckout({
    paymentId,
    payerUserId: userId,
    planId,
    months: 1,
    countryCode: 'US',
    expectedAmountUsd: amountUsd,
    giftRecipientId: null,
    giftRecipientName: sponsorName || (isAnonymous ? 'Anonymous' : user?.name || null),
    giftMessage: sponsorMessage || null,
    couponId: JSON.stringify({
      isSponsorship: true,
      tier: resolvedTier,
      isPublic,
      isAnonymous,
      sponsorUrl: sponsorUrl || null,
      sponsorEmail: emailToUse || null,
    }),
  });

  return {
    success: true,
    paymentId,
    url: data.payment_url,
  };
}

export async function getPublicSponsorsAction() {
  return await SponsorshipService.listPublicSponsors(60);
}

export async function getUserBadgesAction(userId?: string, jwt?: string) {
  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getAuthenticatedUserForBillingAction({ jwt }).catch(() => null);
    targetUserId = user?.$id;
  }
  if (!targetUserId) return [];
  return await SponsorshipService.getUserBadges(targetUserId);
}

export async function recordLightningZapOrTipAction(input: {
  amountUsd: number;
  provider: 'lightning' | 'crypto' | 'manual';
  txHash?: string;
  sponsorName?: string;
  sponsorMessage?: string;
  isAnonymous?: boolean;
  isPublic?: boolean;
  jwt?: string;
}) {
  const { amountUsd, provider, txHash, sponsorName, sponsorMessage, isAnonymous, isPublic, jwt } = input;
  const user = await getAuthenticatedUserForBillingAction({ jwt }).catch(() => null);

  const resolvedBadge = resolveBadgeForAmount(amountUsd);
  const tier = resolvedBadge?.tier || 'supporter';

  const sponsorship = await SponsorshipService.recordCompletedSponsorship({
    userId: user?.$id || null,
    sponsorName: sponsorName || (isAnonymous ? 'Anonymous Zap' : user?.name || null),
    sponsorMessage,
    amount: amountUsd,
    currency: 'USD',
    provider,
    tier,
    txHash: txHash || `zap_${Date.now()}`,
    isPublic: isPublic ?? true,
    isAnonymous: isAnonymous ?? false,
    metadata: {
      timestamp: new Date().toISOString(),
      lightningZap: provider === 'lightning',
    },
  });

  return {
    success: true,
    sponsorship,
  };
}
