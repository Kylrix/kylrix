import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  BadgeTier,
  Sponsorship,
  UserBadge,
  resolveBadgeForAmount,
  SPONSOR_BADGE_DEFINITIONS,
} from '@/lib/types/badges';

export class SponsorshipService {
  static async listPublicSponsors(limit = 50): Promise<Sponsorship[]> {
    try {
      const rows = await db
        .select()
        .from(schema.sponsorships)
        .where(and(eq(schema.sponsorships.status, 'completed'), eq(schema.sponsorships.isPublic, true)))
        .orderBy(desc(schema.sponsorships.createdAt))
        .limit(limit);

      return rows as unknown as Sponsorship[];
    } catch (err) {
      console.warn('[SponsorshipService] Failed to list public sponsors:', err);
      return [];
    }
  }

  static async getUserBadges(userId: string): Promise<UserBadge[]> {
    if (!userId) return [];
    try {
      const rows = await db
        .select()
        .from(schema.userBadges)
        .where(eq(schema.userBadges.userId, userId))
        .orderBy(desc(schema.userBadges.awardedAt))
        .limit(20);

      return rows as unknown as UserBadge[];
    } catch (err) {
      console.warn('[SponsorshipService] Failed to get user badges:', err);
      return [];
    }
  }

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
    const now = new Date().toISOString();

    try {
      const existing = await db
        .select()
        .from(schema.userBadges)
        .where(and(eq(schema.userBadges.userId, userId), eq(schema.userBadges.badgeId, badgeDef.id)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.userBadges)
          .set({
            awardedAt: now,
            sponsorshipId: sponsorshipId || existing[0].sponsorshipId,
            isPublic: true,
          })
          .where(eq(schema.userBadges.id, existing[0].id));
        return { ...existing[0], awardedAt: now } as unknown as UserBadge;
      }

      const id = crypto.randomUUID();
      const badgeData = {
        id,
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
      };

      await db.insert(schema.userBadges).values(badgeData);
      return badgeData as unknown as UserBadge;
    } catch (err) {
      console.error('[SponsorshipService] Failed to award badge:', err);
      return null;
    }
  }

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
    const now = new Date().toISOString();
    const resolvedTier = (data.tier || resolveBadgeForAmount(data.amount)?.tier || 'supporter') as BadgeTier;
    const rowId = crypto.randomUUID();

    const rowData = {
      id: rowId,
      userId: data.userId || null,
      sponsorName: data.sponsorName || (data.isAnonymous ? 'Anonymous Supporter' : null),
      sponsorUrl: data.sponsorUrl || null,
      sponsorEmail: data.sponsorEmail || null,
      sponsorMessage: data.sponsorMessage || null,
      amount: String(data.amount),
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

    await db.insert(schema.sponsorships).values(rowData);

    if (data.userId) {
      await this.awardBadgeToUser({
        userId: data.userId,
        tier: resolvedTier,
        amountUsd: data.amount,
        sponsorshipId: rowId,
      }).catch((e) => console.error('[SponsorshipService] Award badge deferred:', e));
    }

    return { ...rowData, $id: rowId } as unknown as Sponsorship;
  }
}
