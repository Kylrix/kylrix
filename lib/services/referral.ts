import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';

export type AttributionPayload = {
  ref: string;
  src?: 'user' | 'agent' | 'partner' | 'campaign' | string;
  origin?: 'direct' | 'discord' | 'cli' | 'web' | string;
  timestamp?: number;
};

export type ReferralStats = {
  totalReferred: number;
  totalTokensEarned: string;
  referralLink: string;
  referrals: Array<{
    id: string;
    userId: string;
    refCode: string;
    src: string;
    origin: string;
    createdAt: string;
  }>;
};

export const ReferralService = {
  /**
   * Generates the canonical, RFC-compliant referral URL.
   */
  buildReferralLink(identifier: string, src = 'user', origin?: string, isUserId?: boolean): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.kylrix.space';
    const cleanId = String(identifier || '').replace(/^@+/, '').trim();
    let refParam = cleanId;

    if (src === 'agent' && !cleanId.startsWith('agt_')) {
      refParam = `agt_${cleanId}`;
    } else if (isUserId || src === 'userid' || cleanId.startsWith('id_') || cleanId.startsWith('uid_')) {
      if (!cleanId.startsWith('id_') && !cleanId.startsWith('uid_')) {
        refParam = `id_${cleanId}`;
      }
    } else if (src === 'user' && !cleanId.startsWith('u_')) {
      refParam = `u_${cleanId}`;
    }

    const url = new URL('/', base);
    url.searchParams.set('ref', refParam);
    if (origin && origin !== 'direct') {
      url.searchParams.set('origin', origin);
    }
    return url.toString();
  },

  /**
   * Resolves a referral token to a concrete referrer userId with zero ambiguity.
   */
  async resolveReferrer(ref: string): Promise<{ referrerUserId: string; src: string } | null> {
    if (!ref) return null;
    const cleanCode = ref.trim();

    // 1. Agent Referrals: agt_<agentId>
    if (cleanCode.startsWith('agt_')) {
      const agentId = cleanCode.replace(/^agt_/, '');
      try {
        const agentRows = await db
          .select()
          .from(schema.agents)
          .where(eq(schema.agents.id, agentId))
          .limit(1);
        if (agentRows.length > 0) {
          const agent = agentRows[0];
          return { referrerUserId: agent.ownerId || agent.id, src: 'agent' };
        }
      } catch {}
      return null;
    }

    // 2. Concrete User ID Referrals: id_<userId> or uid_<userId>
    if (cleanCode.startsWith('id_') || cleanCode.startsWith('uid_')) {
      const targetUserId = cleanCode.replace(/^(id_|uid_)/, '');
      try {
        const profileRows = await db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, targetUserId))
          .limit(1);
        if (profileRows.length > 0) {
          return { referrerUserId: profileRows[0].userId, src: 'userid' };
        }
      } catch {}

      if (/^[a-zA-Z0-9._-]{1,36}$/.test(targetUserId)) {
        return { referrerUserId: targetUserId, src: 'userid' };
      }
      return null;
    }

    // 3. Username Referrals: u_<username> or @<username>
    if (cleanCode.startsWith('u_') || cleanCode.startsWith('@')) {
      const targetUsername = cleanCode.replace(/^(@|u_)/, '').toLowerCase().trim();
      if (!targetUsername) return null;
      try {
        const profileRows = await db
          .select()
          .from(schema.profiles)
          .where(or(eq(schema.profiles.username, targetUsername), eq(schema.profiles.username, `@${targetUsername}`)))
          .limit(1);
        if (profileRows.length > 0) {
          return { referrerUserId: profileRows[0].userId, src: 'username' };
        }
      } catch {}
      return null;
    }

    // 4. Legacy fallback: attempt both username and direct user ID
    try {
      const profileRows = await db
        .select()
        .from(schema.profiles)
        .where(or(eq(schema.profiles.username, cleanCode.toLowerCase()), eq(schema.profiles.userId, cleanCode)))
        .limit(1);

      if (profileRows.length > 0) {
        return { referrerUserId: profileRows[0].userId, src: 'user' };
      }
    } catch {}

    if (/^[a-zA-Z0-9._-]{1,36}$/.test(cleanCode)) {
      return { referrerUserId: cleanCode, src: 'user' };
    }

    return null;
  },

  /**
   * Claims a referral for a newly registered or converting user.
   */
  async claimReferral(newUserId: string, payload: AttributionPayload): Promise<{
    ok: boolean;
    alreadyReferred?: boolean;
    rewarded?: boolean;
    referrerId?: string;
    error?: string;
  }> {
    if (!newUserId || !payload?.ref) {
      return { ok: false, error: 'Missing newUserId or ref payload' };
    }

    try {
      // 1. Check if user was already referred
      const existing = await db
        .select()
        .from(schema.referrals)
        .where(eq(schema.referrals.userId, newUserId))
        .limit(1);

      if (existing.length > 0) {
        return { ok: true, alreadyReferred: true, referrerId: existing[0].referrerId };
      }

      // 2. Resolve referrer
      const resolved = await this.resolveReferrer(payload.ref);
      if (!resolved || !resolved.referrerUserId) {
        return { ok: false, error: 'Invalid referrer code' };
      }

      const referrerId = resolved.referrerUserId;

      if (referrerId === newUserId) {
        return { ok: false, error: 'Self-referral is disallowed' };
      }

      const src = payload.src || resolved.src || 'user';
      const origin = payload.origin || 'direct';
      const rowId = crypto.randomUUID();
      const now = new Date().toISOString();

      // 3. Create unique referral row
      await db.insert(schema.referrals).values({
        id: rowId,
        userId: newUserId,
        referrerId,
        refCode: payload.ref.slice(0, 128),
        src: src.slice(0, 32),
        origin: origin.slice(0, 64),
        status: 'completed',
        tokensRewarded: false,
        createdAt: now,
      });

      // 4. Reward token minting to referrer (1.5 tokens for referral signup)
      try {
        await InternalKylrixTokenService.mintForActivity({
          userId: referrerId,
          idempotencyKey: `mint:referral_signup:${referrerId}:${newUserId}`,
          activityType: 'referral_signup',
          uniqueActors: 2,
          trustScore: 85,
          sourceType: 'referral_signup',
          sourceId: newUserId,
        });

        await db
          .update(schema.referrals)
          .set({ tokensRewarded: true })
          .where(eq(schema.referrals.id, rowId));

        return { ok: true, rewarded: true, referrerId };
      } catch (mintErr: any) {
        console.warn('[ReferralService] Referral row created but token mint failed:', mintErr?.message);
        return { ok: true, rewarded: false, referrerId };
      }
    } catch (err: any) {
      if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('PRIMARY KEY')) {
        return { ok: true, alreadyReferred: true };
      }
      console.error('[ReferralService.claimReferral]', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Retrieves aggregate referral statistics and list for a user.
   */
  async getReferralStats(userId: string, username?: string | null): Promise<ReferralStats> {
    const cleanUsername = String(username || '').replace(/^@+/, '').trim();
    const referralLink = cleanUsername
      ? this.buildReferralLink(cleanUsername, 'user')
      : this.buildReferralLink(userId, 'userid', undefined, true);

    let rows: any[] = [];
    try {
      rows = await db
        .select()
        .from(schema.referrals)
        .where(eq(schema.referrals.referrerId, userId))
        .orderBy(desc(schema.referrals.createdAt))
        .limit(100);
    } catch (err) {
      console.warn('[ReferralService.getReferralStats] Query failed:', err);
    }

    const totalCount = rows.length;
    const rewardedCount = rows.filter((r: any) => Boolean(r.tokensRewarded)).length;
    const totalTokensEarned = (rewardedCount * 1.5).toFixed(1);

    return {
      totalReferred: totalCount,
      totalTokensEarned,
      referralLink,
      referrals: rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        refCode: r.refCode || '',
        src: r.src || 'user',
        origin: r.origin || 'direct',
        createdAt: r.createdAt || '',
      })),
    };
  },

  /**
   * Generates a clean, unique username on the fly for users who don't have one yet.
   */
  async generateUsernameOnTheFly(userId: string, name?: string | null): Promise<string> {
    let base = 'user';
    if (name && typeof name === 'string') {
      const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length >= 3) base = clean.slice(0, 10);
    }

    for (let i = 0; i < 5; i++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const candidate = `${base}${suffix}`;
      try {
        const existing = await db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.username, candidate))
          .limit(1);

        if (existing.length === 0) {
          const userProfile = await db
            .select()
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, userId))
            .limit(1);

          const now = new Date().toISOString();
          if (userProfile.length > 0) {
            await db
              .update(schema.profiles)
              .set({ username: candidate, updatedAt: now })
              .where(eq(schema.profiles.id, userProfile[0].id));
          } else {
            await db.insert(schema.profiles).values({
              id: crypto.randomUUID(),
              userId,
              username: candidate,
              displayName: name || candidate,
              createdAt: now,
              updatedAt: now,
            });
          }
          return candidate;
        }
      } catch {}
    }

    return `user${userId.slice(0, 6)}`;
  }
};
