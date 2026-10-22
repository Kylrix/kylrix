'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

export interface ContributorVerificationResult {
  isContributor: boolean;
  prCount: number;
  githubUsername?: string | null;
  lastCheckedAt: string;
  reason?: string;
}

export interface ContributorDetailResult {
  isContributor: boolean;
  prCount: number;
  commitCount?: number;
  githubUsername?: string | null;
  lastCheckedAt?: string;
  recentCommits?: Array<{
    sha: string;
    message: string;
    url: string;
    date: string;
    repo?: string;
  }>;
  recentPrs?: Array<{
    id: number;
    title: string;
    url: string;
    date: string;
    state: string;
  }>;
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
 * Dynamically resolves whether a public profile username is a recognized contributor,
 * checking linked GitHub account and fetching recent commits/PRs for that account.
 */
export async function getContributorStatusByUsernameAction(
  username: string
): Promise<ContributorDetailResult> {
  try {
    const cleanUsername = String(username || '').replace(/^@/, '').trim().toLowerCase();
    if (!cleanUsername) return { isContributor: false, prCount: 0 };

    const headers: Record<string, string> = {
      'User-Agent': 'Kylrix-Contributor-Verification',
      Accept: 'application/vnd.github.v3+json',
    };

    // 1. Resolve target user ID from profiles or user table
    let targetUserId: string | null = null;
    try {
      const profileRows = await db
        .select({ userId: schema.profiles.userId, username: schema.profiles.username })
        .from(schema.profiles)
        .where(eq(schema.profiles.username, cleanUsername))
        .limit(1);

      if (profileRows.length > 0) {
        targetUserId = profileRows[0].userId;
      }
    } catch {}

    if (!targetUserId) {
      try {
        const userRows = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(or(eq(schema.user.name, cleanUsername), eq(schema.user.id, cleanUsername)))
          .limit(1);

        if (userRows.length > 0) {
          targetUserId = userRows[0].id;
        }
      } catch {}
    }

    let githubUsername: string | null = null;

    // 2. If targetUserId found, check linked GitHub account in accounts table
    if (targetUserId) {
      try {
        const ghAccounts = await db
          .select({
            accountId: schema.account.accountId,
            accessToken: schema.account.accessToken,
          })
          .from(schema.account)
          .where(and(eq(schema.account.userId, targetUserId), eq(schema.account.providerId, 'github')))
          .limit(1);

        if (ghAccounts.length > 0) {
          const acc = ghAccounts[0];
          if (acc.accessToken) {
            headers.Authorization = `Bearer ${acc.accessToken}`;
            try {
              const uRes = await fetch('https://api.github.com/user', { headers });
              if (uRes.ok) {
                const uData = await uRes.json();
                githubUsername = uData.login || null;
              }
            } catch {}
          }
          if (!githubUsername && acc.accountId) {
            try {
              const uRes = await fetch(`https://api.github.com/user/${acc.accountId}`, { headers });
              if (uRes.ok) {
                const uData = await uRes.json();
                githubUsername = uData.login || null;
              }
            } catch {}
          }
        }
      } catch {}
    }

    // Fall back to cleanUsername if no linked GitHub found directly
    const ghAuthorToQuery = githubUsername || cleanUsername;

    // 3. Query GitHub API for PRs and Commits
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const searchPrUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(
      `repo:Kylrix/kylrix is:pr author:${ghAuthorToQuery}`
    )}`;

    let prCount = 0;
    let isContributor = false;
    const parsedPrs: Array<{
      id: number;
      title: string;
      url: string;
      date: string;
      state: string;
    }> = [];

    const parsedCommits: Array<{
      sha: string;
      message: string;
      url: string;
      date: string;
      repo?: string;
    }> = [];

    try {
      const searchRes = await fetch(searchPrUrl, {
        headers,
        next: { revalidate: 1800 },
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        prCount = Number(data.total_count || 0);
        if (Array.isArray(data.items)) {
          data.items.slice(0, 5).forEach((pr: any) => {
            parsedPrs.push({
              id: pr.id,
              title: pr.title,
              url: pr.html_url,
              date: pr.created_at || pr.closed_at || new Date().toISOString(),
              state: pr.state === 'closed' && pr.pull_request?.merged_at ? 'merged' : pr.state,
            });
          });
          isContributor = parsedPrs.some((pr) => pr.state === 'merged') || prCount > 0;
        }
      }
    } catch {}

    // 4. Also query GitHub Commits Search API for recent commit activity
    try {
      const commitsUrl = `https://api.github.com/search/commits?q=${encodeURIComponent(
        `author:${ghAuthorToQuery} committer-date:>=${thirtyDaysAgo}`
      )}`;

      const commitsRes = await fetch(commitsUrl, {
        headers: {
          ...headers,
          Accept: 'application/vnd.github.cloak-preview+json',
        },
        next: { revalidate: 1800 },
      });

      if (commitsRes.ok) {
        const cData = await commitsRes.json();
        if (Array.isArray(cData.items)) {
          cData.items.slice(0, 6).forEach((item: any) => {
            parsedCommits.push({
              sha: (item.sha || '').slice(0, 7),
              message: item.commit?.message?.split('\n')[0] || 'Commit',
              url: item.html_url,
              date: item.commit?.author?.date || new Date().toISOString(),
              repo: item.repository?.full_name || 'Kylrix/kylrix',
            });
          });
        }
      }
    } catch {}

    const lastCheckedAt = new Date().toISOString();

    // 5. If targetUserId exists, record/sync in Turso DB
    if (targetUserId) {
      try {
        await db
          .update(schema.user)
          .set({
            isContributor,
            contributorLastCheckedAt: lastCheckedAt,
            contributorPrCount: prCount,
            updatedAt: new Date(),
          })
          .where(eq(schema.user.id, targetUserId));
      } catch {}
    }

    return {
      isContributor,
      prCount,
      commitCount: parsedCommits.length,
      githubUsername: ghAuthorToQuery,
      lastCheckedAt,
      recentCommits: parsedCommits,
      recentPrs: parsedPrs,
    };
  } catch {
    return { isContributor: false, prCount: 0 };
  }
}
