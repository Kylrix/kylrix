'use server';

import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';
import { resolveBillingNotifyUrl, resolveBillingSuccessUrl } from '@/lib/billing/callback-urls';
import { registerPendingCheckoutWithAdapter } from '@/lib/billing/pending-checkout';
import { resolveCryptoBillingAdapter } from '@/lib/billing/providers/registry';
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

  const adapter = resolveCryptoBillingAdapter();
  if (adapter.id === 'stub') {
    throw new Error('Sponsorship checkout requires a configured crypto billing provider (e.g. blockbee).');
  }

  const resolvedTier = tier || resolveBadgeForAmount(amountUsd)?.tier || 'custom';
  const planId = `SPONSOR_${resolvedTier.toUpperCase()}`;

  const notifyUrl = new URL(resolveBillingNotifyUrl());
  notifyUrl.searchParams.set('order_id', userId);
  notifyUrl.searchParams.set('plan_id', planId);
  notifyUrl.searchParams.set('is_sponsorship', '1');
  notifyUrl.searchParams.set('tier', resolvedTier);

  const redirectUrl = new URL(resolveBillingSuccessUrl());
  redirectUrl.searchParams.set('order_id', userId);
  redirectUrl.searchParams.set('sponsor', '1');

  const emailToUse = sponsorEmail || user?.email;

  const session = await adapter.createCheckoutSession({
    planId,
    userId,
    countryCode: 'US',
    months: 1,
    email: emailToUse,
    amountUsd,
    notifyUrl: notifyUrl.toString(),
    redirectUrl: redirectUrl.toString(),
  });

  const paymentId = session.id;

  await registerPendingCheckoutWithAdapter({
    paymentId,
    providerAdapterId: adapter.id,
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
    url: session.url,
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
