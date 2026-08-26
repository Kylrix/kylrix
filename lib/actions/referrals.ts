'use server';

import { ReferralService, type AttributionPayload, type ReferralStats } from '@/lib/services/referral';
import { getAuthenticatedUserId } from '@/lib/server-auth';

export async function getReferralStatsAction(username?: string | null): Promise<ReferralStats> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      totalReferred: 0,
      totalTokensEarned: '0.0',
      referralLink: ReferralService.buildReferralLink(username || ''),
      referrals: [],
    };
  }
  return ReferralService.getReferralStats(userId, username);
}

export async function claimReferralAction(payload: AttributionPayload): Promise<{
  ok: boolean;
  alreadyReferred?: boolean;
  rewarded?: boolean;
  referrerId?: string;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { ok: false, error: 'Unauthorized' };
  }
  return ReferralService.claimReferral(userId, payload);
}

export async function generateUsernameOnTheFlyAction(name?: string | null): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { ok: false, error: 'Unauthorized' };
  }
  try {
    const username = await ReferralService.generateUsernameOnTheFly(userId, name);
    return { ok: true, username };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
