'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface ContributorVerificationResult {
  isContributor: boolean;
  prCount: number;
  githubUsername?: string | null;
  lastCheckedAt: string;
  reason?: string;
}

/**
 * Checks if a user has contributed a merged PR to Kylrix/kylrix within the last 30 days.
 * If yes, upgrades/records their Pro contributor entitlement in Turso.
 */
export async function verifyAndApplyContributorStatus(userId: string): Promise<ContributorVerificationResult> {
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // 1. Fetch user's GitHub account from Better Auth accounts table
    const accounts = await db
      .select({
        providerId: schema.account.providerId,
        accountId: schema.account.accountId,
        accessToken: schema.account.accessToken,
      })
      .from(schema.account)
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'github')))
      .limit(1);

    if (accounts.length === 0) {
      return {
        isContributor: false,
        prCount: 0,
        lastCheckedAt: nowIso,
        reason: 'No connected GitHub account found. Sign in or connect GitHub in settings.',
      };
    }

    const githubAccount = accounts[0];
    let githubUsername: string | null = null;
    const headers: Record<string, string> = {
      'User-Agent': 'Kylrix-Contributor-Verification',
      Accept: 'application/vnd.github.v3+json',
    };

    if (githubAccount.accessToken) {
      headers.Authorization = `Bearer ${githubAccount.accessToken}`;
    }

    // Resolve GitHub username
    try {
      if (githubAccount.accessToken) {
        const userRes = await fetch('https://api.github.com/user', { headers });
        if (userRes.ok) {
          const userData = await userRes.json();
          githubUsername = userData.login || null;
        }
      }
    } catch {}

    if (!githubUsername) {
      // Fallback: lookup by account ID if possible or public user endpoint
      try {
        const uRes = await fetch(`https://api.github.com/user/${githubAccount.accountId}`, { headers });
        if (uRes.ok) {
          const uData = await uRes.json();
          githubUsername = uData.login || null;
        }
      } catch {}
    }

    if (!githubUsername) {
      return {
        isContributor: false,
        prCount: 0,
        lastCheckedAt: nowIso,
        reason: 'Could not resolve GitHub username from account profile.',
      };
    }

    // 2. Query GitHub Search API for merged PRs in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const query = encodeURIComponent(`repo:Kylrix/kylrix is:pr is:merged author:${githubUsername} merged:>=${thirtyDaysAgo}`);
    const searchUrl = `https://api.github.com/search/issues?q=${query}`;

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) {
      // Rate limit or transient error
      return {
        isContributor: false,
        prCount: 0,
        githubUsername,
        lastCheckedAt: nowIso,
        reason: `GitHub search API returned status ${searchRes.status}`,
      };
    }

    const searchData = await searchRes.json();
    const prCount = Number(searchData.total_count || 0);
    const isContributor = prCount > 0;

    // 3. Update Turso user record
    await db
      .update(schema.user)
      .set({
        isContributor,
        contributorLastCheckedAt: nowIso,
        contributorPrCount: prCount,
        updatedAt: now,
      })
      .where(eq(schema.user.id, userId));

    // 4. If contributor, ensure subscriptions table marks Pro tier
    if (isContributor) {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const existingSub = await db
        .select({ id: schema.subscriptions.id })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId))
        .limit(1);

      if (existingSub.length > 0) {
        await db
          .update(schema.subscriptions)
          .set({
            tier: 'pro',
            status: 'active',
            metadata: JSON.stringify({
              contributorGrant: true,
              githubUsername,
              prCount,
              grantedAt: nowIso,
              expiresAt: thirtyDaysFromNow,
            }),
            updatedAt: nowIso,
          })
          .where(eq(schema.subscriptions.id, existingSub[0].id));
      } else {
        await db.insert(schema.subscriptions).values({
          id: `sub_contrib_${userId.slice(0, 16)}`,
          userId,
          tier: 'pro',
          status: 'active',
          metadata: JSON.stringify({
            contributorGrant: true,
            githubUsername,
            prCount,
            grantedAt: nowIso,
            expiresAt: thirtyDaysFromNow,
          }),
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    return {
      isContributor,
      prCount,
      githubUsername,
      lastCheckedAt: nowIso,
    };
  } catch (err: any) {
    console.error('[contributor-ops] verifyAndApplyContributorStatus failed:', err);
    return {
      isContributor: false,
      prCount: 0,
      lastCheckedAt: nowIso,
      reason: err?.message || 'Internal verification error',
    };
  }
}

/**
 * Dynamically resolves whether a public profile username is a recognized contributor.
 */
export async function getContributorStatusByUsernameAction(username: string): Promise<{ isContributor: boolean; prCount?: number }> {
  try {
    const cleanUsername = String(username || '').replace(/^@/, '').trim().toLowerCase();
    if (!cleanUsername) return { isContributor: false };

    // 1. Try finding user in Turso by username/name
    const matchedUsers = await db
      .select({
        id: schema.user.id,
        isContributor: schema.user.isContributor,
        contributorLastCheckedAt: schema.user.contributorLastCheckedAt,
        contributorPrCount: schema.user.contributorPrCount,
      })
      .from(schema.user)
      .where(eq(schema.user.name, cleanUsername))
      .limit(1);

    if (matchedUsers.length > 0) {
      const u = matchedUsers[0];
      if (u.isContributor && u.contributorLastCheckedAt) {
        const lastChecked = new Date(u.contributorLastCheckedAt).getTime();
        // If checked in the last 24h, return cached true
        if (Date.now() - lastChecked < 24 * 60 * 60 * 1000) {
          return { isContributor: true, prCount: u.contributorPrCount || 1 };
        }
      }
      const verified = await verifyAndApplyContributorStatus(u.id);
      return { isContributor: verified.isContributor, prCount: verified.prCount };
    }

    // 2. Direct GitHub query for username in case user's profile handle is their GitHub username
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const query = encodeURIComponent(`repo:Kylrix/kylrix is:pr is:merged author:${cleanUsername} merged:>=${thirtyDaysAgo}`);
    const searchUrl = `https://api.github.com/search/issues?q=${query}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Kylrix-Contributor-Verification',
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 3600 },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const count = Number(searchData.total_count || 0);
      return { isContributor: count > 0, prCount: count };
    }

    return { isContributor: false };
  } catch {
    return { isContributor: false };
  }
}

