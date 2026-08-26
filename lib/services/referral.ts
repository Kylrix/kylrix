import { ID, Query, Permission, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';

const DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const REFERRALS_TABLE = 'referrals';
const PROFILES_TABLE = APPWRITE_CONFIG.TABLES.CONNECT.PROFILES;

export type AttributionPayload = {
  ref: string;
  src?: 'user' | 'agent' | 'partner' | 'campaign' | string;
  origin?: 'direct' | 'nostr' | 'discord' | 'cli' | 'web' | string;
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
   * Format: https://www.kylrix.space/?ref=u_<usernameOrId>
   */
  buildReferralLink(identifier: string, src = 'user', origin?: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.kylrix.space';
    const cleanId = String(identifier || '').replace(/^@+/, '').trim();
    let refParam = cleanId;
    if (src === 'agent' && !cleanId.startsWith('agt_')) {
      refParam = `agt_${cleanId}`;
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
   * Resolves a referral token (e.g., u_alice, agt_bot1, or raw ID) to a concrete referrer userId.
   */
  async resolveReferrer(ref: string): Promise<{ referrerUserId: string; src: string } | null> {
    if (!ref) return null;
    const tables = createSystemTablesDB();
    let cleanCode = ref.trim();
    let src = 'user';

    if (cleanCode.startsWith('agt_')) {
      cleanCode = cleanCode.replace(/^agt_/, '');
      src = 'agent';
      // Check agents table
      try {
        const agentRows = await tables.listRows({
          databaseId: DB,
          tableId: APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
          queries: [
            Query.or([
              Query.equal('$id', cleanCode),
              Query.equal('agentId', cleanCode),
              Query.equal('name', cleanCode)
            ]),
            Query.limit(1)
          ]
        });
        if (agentRows.rows.length > 0) {
          const agent = agentRows.rows[0];
          return { referrerUserId: agent.ownerId || agent.userId || agent.$id, src: 'agent' };
        }
      } catch {}
    } else if (cleanCode.startsWith('u_')) {
      cleanCode = cleanCode.replace(/^u_/, '');
      src = 'user';
    }

    // Try finding profile by username or ID
    try {
      const profileRows = await tables.listRows({
        databaseId: DB,
        tableId: PROFILES_TABLE,
        queries: [
          Query.or([
            Query.equal('username', cleanCode.toLowerCase()),
            Query.equal('userId', cleanCode),
            Query.equal('$id', cleanCode)
          ]),
          Query.limit(1)
        ]
      });

      if (profileRows.rows.length > 0) {
        const profile = profileRows.rows[0];
        return { referrerUserId: profile.userId || profile.$id, src };
      }
    } catch {}

    // Fallback: direct ID if looks like Appwrite UID (up to 36 hex chars)
    if (/^[a-zA-Z0-9._-]{1,36}$/.test(cleanCode)) {
      return { referrerUserId: cleanCode, src };
    }

    return null;
  },

  /**
   * Claims a referral for a newly registered or converting user.
   * Guaranteed: A user can only ever be referred ONCE.
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

    const tables = createSystemTablesDB();

    try {
      // 1. Check if user was already referred
      const existing = await tables.listRows({
        databaseId: DB,
        tableId: REFERRALS_TABLE,
        queries: [Query.equal('userId', newUserId), Query.limit(1)]
      });

      if (existing.rows.length > 0) {
        return { ok: true, alreadyReferred: true, referrerId: existing.rows[0].referrerId };
      }

      // 2. Resolve referrer
      const resolved = await this.resolveReferrer(payload.ref);
      if (!resolved || !resolved.referrerUserId) {
        return { ok: false, error: 'Invalid referrer code' };
      }

      const referrerId = resolved.referrerUserId;

      // Prevent self-referral
      if (referrerId === newUserId) {
        return { ok: false, error: 'Self-referral is disallowed' };
      }

      const src = payload.src || resolved.src || 'user';
      const origin = payload.origin || 'direct';

      // 3. Create unique referral row
      const row = await tables.createRow({
        databaseId: DB,
        tableId: REFERRALS_TABLE,
        rowId: ID.unique(),
        data: {
          userId: newUserId,
          referrerId,
          refCode: payload.ref.slice(0, 128),
          src: src.slice(0, 32),
          origin: origin.slice(0, 64),
          status: 'completed',
          tokensRewarded: false,
        },
        permissions: [
          Permission.read(Role.user(newUserId)),
          Permission.read(Role.user(referrerId)),
        ]
      });

      // 4. Reward token minting to referrer (1.5 tokens for referral signup)
      try {
        await InternalKylrixTokenService.mintForActivity({
          userId: referrerId,
          sourceType: 'referral_signup',
          sourceId: newUserId,
          idempotencyKey: `mint:referral_signup:${referrerId}:${newUserId}`,
          rawAmount: '1.5',
        });

        // Update tokensRewarded flag
        await tables.updateRow({
          databaseId: DB,
          tableId: REFERRALS_TABLE,
          rowId: row.$id,
          data: { tokensRewarded: true }
        });

        return { ok: true, rewarded: true, referrerId };
      } catch (mintErr: any) {
        console.warn('[ReferralService] Referral row created but token mint failed:', mintErr?.message);
        return { ok: true, rewarded: false, referrerId };
      }
    } catch (err: any) {
      // Catch unique index collision (already referred)
      if (err?.code === 409 || err?.message?.includes('already exists') || err?.message?.includes('unique')) {
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
    const tables = createSystemTablesDB();
    const cleanUsername = String(username || '').replace(/^@+/, '').trim();
    const referralLink = this.buildReferralLink(cleanUsername || userId);

    try {
      const res = await tables.listRows({
        databaseId: DB,
        tableId: REFERRALS_TABLE,
        queries: [
          Query.equal('referrerId', userId),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      });

      const totalReferred = res.total ?? res.rows.length;
      const rewardedCount = res.rows.filter((r: any) => r.tokensRewarded !== false).length;
      const totalTokensEarned = (rewardedCount * 1.5).toFixed(1);

      return {
        totalReferred,
        totalTokensEarned,
        referralLink,
        referrals: res.rows.map((r: any) => ({
          id: r.$id,
          userId: r.userId,
          refCode: r.refCode || '',
          src: r.src || 'user',
          origin: r.origin || 'direct',
          createdAt: r.$createdAt,
        }))
      };
    } catch {
      return {
        totalReferred: 0,
        totalTokensEarned: '0.0',
        referralLink,
        referrals: []
      };
    }
  },

  /**
   * Generates a clean, unique username on the fly for users who don't have one yet.
   */
  async generateUsernameOnTheFly(userId: string, name?: string | null): Promise<string> {
    const tables = createSystemTablesDB();
    let base = 'user';
    if (name && typeof name === 'string') {
      const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length >= 3) base = clean.slice(0, 10);
    }

    // Try up to 5 unique combinations
    for (let i = 0; i < 5; i++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const candidate = `${base}${suffix}`;
      try {
        const existing = await tables.listRows({
          databaseId: DB,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('username', candidate), Query.limit(1)]
        });
        if (existing.rows.length === 0) {
          // Found available username, update profile if exists
          try {
            const userProfile = await tables.listRows({
              databaseId: DB,
              tableId: PROFILES_TABLE,
              queries: [Query.equal('userId', userId), Query.limit(1)]
            });
            if (userProfile.rows.length > 0) {
              await tables.updateRow({
                databaseId: DB,
                tableId: PROFILES_TABLE,
                rowId: userProfile.rows[0].$id,
                data: { username: candidate }
              });
            } else {
              await tables.createRow({
                databaseId: DB,
                tableId: PROFILES_TABLE,
                rowId: ID.unique(),
                data: {
                  userId,
                  username: candidate,
                  displayName: name || candidate,
                },
                permissions: [Permission.read(Role.any()), Permission.update(Role.user(userId))]
              });
            }
          } catch {}
          return candidate;
        }
      } catch {}
    }

    return `user${userId.slice(0, 6)}`;
  }
};
