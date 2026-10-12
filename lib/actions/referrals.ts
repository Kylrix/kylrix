'use server';

import { ReferralService, type AttributionPayload, type ReferralStats } from '@/lib/services/referral';
import { getActor } from '@/lib/actions/secure-ops/shared';

export async function getReferralStatsAction(username?: string | null, jwt?: string): Promise<ReferralStats> {
  const actor = await getActor(jwt);
  const userId = actor?.$id;
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

export async function claimReferralAction(payload: AttributionPayload, jwt?: string): Promise<{
  ok: boolean;
  alreadyReferred?: boolean;
  rewarded?: boolean;
  referrerId?: string;
  error?: string;
}> {
  const actor = await getActor(jwt);
  const userId = actor?.$id;
  if (!userId) {
    return { ok: false, error: 'Unauthorized' };
  }
  return ReferralService.claimReferral(userId, payload);
}

export async function generateUsernameOnTheFlyAction(name?: string | null, jwt?: string): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const actor = await getActor(jwt);
  const userId = actor?.$id;
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
