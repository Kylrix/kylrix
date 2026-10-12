export type BadgeTier = 'supporter' | 'patron' | 'builder' | 'sovereign' | 'custom';

export type BadgeType = 'sponsor' | 'contributor' | 'system' | 'special';

export interface UserBadge {
  $id: string;
  userId: string;
  badgeId: string;
  badgeType: BadgeType;
  tier?: BadgeTier | string;
  name: string;
  description?: string;
  icon?: string;
  isPublic: boolean;
  awardedAt: string;
  sponsorshipId?: string;
  metadata?: string | Record<string, any>;
}

export interface Sponsorship {
  $id: string;
  userId?: string;
  sponsorName?: string;
  sponsorUrl?: string;
  sponsorEmail?: string;
  sponsorMessage?: string;
  amount: number;
  currency: string;
  provider: 'blockbee' | 'lightning' | 'crypto' | 'stripe' | 'manual';
  tier: BadgeTier;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  isPublic: boolean;
  isAnonymous: boolean;
  badgeAwarded: boolean;
  metadata?: string | Record<string, any>;
  createdAt: string;
}

export interface BadgeDefinition {
  id: string;
  tier: BadgeTier;
  name: string;
  description: string;
  minAmountUsd: number;
  icon: string;
  color: string;
  accent: string;
}

export const SPONSOR_BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  sponsor_supporter: {
    id: 'sponsor_supporter',
    tier: 'supporter',
    name: 'Kylrix Supporter',
    description: 'Backed the open-source mission with micro-tips and community support.',
    minAmountUsd: 5,
    icon: 'heart',
    color: '#EC4899',
    accent: '#F472B6',
  },
  sponsor_patron: {
    id: 'sponsor_patron',
    tier: 'patron',
    name: 'Sovereign Patron',
    description: 'Empowers ongoing development and independent infrastructure maintenance.',
    minAmountUsd: 25,
    icon: 'sparkles',
    color: '#6366F1',
    accent: '#818CF8',
  },
  sponsor_builder: {
    id: 'sponsor_builder',
    tier: 'builder',
    name: 'Ecosystem Builder',
    description: 'Major backer accelerating core features, MCP tooling, and protocol research.',
    minAmountUsd: 100,
    icon: 'hammer',
    color: '#10B981',
    accent: '#34D399',
  },
  sponsor_sovereign: {
    id: 'sponsor_sovereign',
    tier: 'sovereign',
    name: 'Founding Sponsor',
    description: 'Top-tier lifetime sponsor securing long-term self-hosted sovereign productivity.',
    minAmountUsd: 500,
    icon: 'crown',
    color: '#F59E0B',
    accent: '#FBBF24',
  },
};

export function resolveBadgeForAmount(amountUsd: number): BadgeDefinition | null {
  if (amountUsd >= 500) return SPONSOR_BADGE_DEFINITIONS.sponsor_sovereign;
  if (amountUsd >= 100) return SPONSOR_BADGE_DEFINITIONS.sponsor_builder;
  if (amountUsd >= 25) return SPONSOR_BADGE_DEFINITIONS.sponsor_patron;
  if (amountUsd >= 5) return SPONSOR_BADGE_DEFINITIONS.sponsor_supporter;
  return null;
}
