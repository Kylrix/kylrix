import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  BadgeTier,
  Sponsorship,
  UserBadge,
  resolveBadgeForAmount,
  SPONSOR_BADGE_DEFINITIONS,
} from '@/lib/types/badges';

const DB_ID = APPWRITE_CONFIG.DATABASE_ID;
const SPONSORSHIPS_TABLE = APPWRITE_CONFIG.TABLES.SPONSORSHIPS || 'sponsorships';
const USER_BADGES_TABLE = APPWRITE_CONFIG.TABLES.USER_BADGES || 'user_badges';

export class SponsorshipService {
  /**
   * List confirmed public sponsors for the Wall of Sponsors / leaderboard.
   */
  static async listPublicSponsors(limit = 50): Promise<Sponsorship[]> {
    try {
      const { databases } = createSystemClient();
      const res = await databases.listRows(DB_ID, SPONSORSHIPS_TABLE, [
        Query.equal('status', 'completed'),
        Query.equal('isPublic', true),
        Query.orderDesc('amount'),
        Query.limit(limit),
      ]);
      return (res.rows || []) as unknown as Sponsorship[];
    } catch (err) {
      console.warn('[SponsorshipService] Failed to list public sponsors:', err);
      return [];
    }
  }

  /**
   * Get all badges awarded to a specific user.
   */
  static async getUserBadges(userId: string): Promise<UserBadge[]> {
    if (!userId) return [];
    try {
      const { databases } = createSystemClient();
      const res = await databases.listRows(DB_ID, USER_BADGES_TABLE, [
        Query.equal('userId', userId),
        Query.orderDesc('awardedAt'),
        Query.limit(20),
      ]);
      return (res.rows || []) as unknown as UserBadge[];
    } catch (err) {
      console.warn('[SponsorshipService] Failed to get user badges:', err);
      return [];
    }
  }

  /**
   * Award or upgrade a badge for a user.
   */
  static async awardBadgeToUser(input: {
    userId: string;
    tier: BadgeTier | string;
    amountUsd?: number;
    sponsorshipId?: string;
  }): Promise<UserBadge | null> {
    const { userId, tier, amountUsd, sponsorshipId } = input;
    if (!userId) return null;

    const badgeDef =
      typeof amountUsd === 'number'
        ? resolveBadgeForAmount(amountUsd)
        : Object.values(SPONSOR_BADGE_DEFINITIONS).find((b) => b.tier === tier) ||
          SPONSOR_BADGE_DEFINITIONS.sponsor_supporter;

    if (!badgeDef) return null;

    const { databases } = createSystemClient();
    const now = new Date().toISOString();

    try {
      // Check if user already has this specific badge or a higher tier badge
      const existing = await databases.listRows(DB_ID, USER_BADGES_TABLE, [
        Query.equal('userId', userId),
        Query.equal('badgeId', badgeDef.id),
        Query.limit(1),
      ]);

      if (existing.total > 0) {
        const row = existing.rows[0];
        const updated = await databases.updateRow(DB_ID, USER_BADGES_TABLE, row.$id, {
          awardedAt: now,
          sponsorshipId: sponsorshipId || row.sponsorshipId,
          isPublic: true,
        });
        return updated as unknown as UserBadge;
      }

      // Create new badge row
      const permissions = [
        Permission.read(Role.any()),
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
      ];

      const created = await databases.createRow(
        DB_ID,
        USER_BADGES_TABLE,
        ID.unique(),
        {
          userId,
          badgeId: badgeDef.id,
          badgeType: 'sponsor',
          tier: badgeDef.tier,
          name: badgeDef.name,
          description: badgeDef.description,
          icon: badgeDef.icon,
          isPublic: true,
          awardedAt: now,
          sponsorshipId: sponsorshipId || null,
          metadata: JSON.stringify({
            amountUsd,
            accent: badgeDef.accent,
          }),
        },
        permissions,
      );

      return created as unknown as UserBadge;
    } catch (err) {
      console.error('[SponsorshipService] Failed to award badge:', err);
      return null;
    }
  }

  /**
   * Record a completed sponsorship and award badges.
   */
  static async recordCompletedSponsorship(data: {
    userId?: string | null;
    sponsorName?: string | null;
    sponsorUrl?: string | null;
    sponsorEmail?: string | null;
    sponsorMessage?: string | null;
    amount: number;
    currency?: string;
    provider?: 'blockbee' | 'lightning' | 'crypto' | 'stripe' | 'manual';
    tier?: BadgeTier | string;
    txHash?: string | null;
    isPublic?: boolean;
    isAnonymous?: boolean;
    metadata?: Record<string, any>;
  }): Promise<Sponsorship> {
    const { databases } = createSystemClient();
    const now = new Date().toISOString();
    const resolvedTier = (data.tier || resolveBadgeForAmount(data.amount)?.tier || 'supporter') as BadgeTier;

    const rowId = ID.unique();
    const permissions = [
      Permission.read(Role.any()),
    ];

    if (data.userId) {
      permissions.push(Permission.read(Role.user(data.userId)));
    }

    const rowData = {
      userId: data.userId || null,
      sponsorName: data.sponsorName || (data.isAnonymous ? 'Anonymous Supporter' : null),
      sponsorUrl: data.sponsorUrl || null,
      sponsorEmail: data.sponsorEmail || null,
      sponsorMessage: data.sponsorMessage || null,
      amount: data.amount,
      currency: data.currency || 'USD',
      provider: data.provider || 'blockbee',
      tier: resolvedTier,
      status: 'completed',
      txHash: data.txHash || null,
      isPublic: data.isPublic ?? true,
      isAnonymous: data.isAnonymous ?? false,
      badgeAwarded: Boolean(data.userId),
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdAt: now,
    };

    const record = await databases.createRow(
      DB_ID,
      SPONSORSHIPS_TABLE,
      rowId,
      rowData,
      permissions,
    );

    // Award badge if associated with a user
    if (data.userId) {
      await this.awardBadgeToUser({
        userId: data.userId,
        tier: resolvedTier,
        amountUsd: data.amount,
        sponsorshipId: record.$id,
      }).catch((e) => console.error('[SponsorshipService] Award badge deferred:', e));
    }

    return record as unknown as Sponsorship;
  }
}
