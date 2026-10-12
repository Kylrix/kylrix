'use client';

import React from 'react';
import { Heart, Sparkles, Hammer, Crown, Zap, Shield, Award } from 'lucide-react';
import { BadgeTier, SPONSOR_BADGE_DEFINITIONS, UserBadge } from '@/lib/types/badges';

export function getBadgeIcon(iconName?: string, className = 'w-3.5 h-3.5') {
  switch (iconName) {
    case 'heart':
      return <Heart className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'hammer':
      return <Hammer className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'shield':
      return <Shield className={className} />;
    default:
      return <Award className={className} />;
  }
}

export function BadgeChip({
  badge,
  tier,
  name,
  size = 'md',
}: {
  badge?: UserBadge;
  tier?: BadgeTier | string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const resolvedTier = (tier || badge?.tier || 'supporter') as BadgeTier;
  const badgeDef =
    Object.values(SPONSOR_BADGE_DEFINITIONS).find((b) => b.tier === resolvedTier) ||
    SPONSOR_BADGE_DEFINITIONS.sponsor_supporter;

  const displayName = name || badge?.name || badgeDef.name;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-medium',
  }[size];

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const tierStyles = {
    supporter: 'border-[#EC4899]/30 bg-[#EC4899]/10 text-[#F472B6]',
    patron: 'border-[#6366F1]/30 bg-[#6366F1]/10 text-[#818CF8]',
    builder: 'border-[#10B981]/30 bg-[#10B981]/10 text-[#34D399]',
    sovereign: 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FBBF24]',
    custom: 'border-white/20 bg-white/5 text-white/90',
  }[resolvedTier] || 'border-white/20 bg-white/5 text-white/90';

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-mono select-none ${tierStyles} ${sizeClasses}`}
      title={badge?.description || badgeDef.description}
    >
      {getBadgeIcon(badgeDef.icon, iconSizes)}
      <span className="truncate">{displayName}</span>
    </span>
  );
}

export function BadgesShowcaseGrid() {
  const tiers = Object.values(SPONSOR_BADGE_DEFINITIONS);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {tiers.map((t) => {
        const tierKey = t.tier as BadgeTier;
        const borderStyle = {
          supporter: 'hover:border-[#EC4899]/40',
          patron: 'hover:border-[#6366F1]/40',
          builder: 'hover:border-[#10B981]/40',
          sovereign: 'hover:border-[#F59E0B]/40',
          custom: 'hover:border-white/30',
        }[tierKey];

        const accentColor = {
          supporter: 'text-[#EC4899]',
          patron: 'text-[#6366F1]',
          builder: 'text-[#10B981]',
          sovereign: 'text-[#F59E0B]',
          custom: 'text-white',
        }[tierKey];

        return (
          <div
            key={t.id}
            className={`p-4 rounded-xl bg-[#161412] border border-white/[0.06] transition-all flex flex-col justify-between ${borderStyle}`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className={`p-2 rounded-lg bg-[#0A0908] border border-white/[0.06] ${accentColor}`}>
                  {getBadgeIcon(t.icon, 'w-4 h-4')}
                </div>
                <span className="font-mono text-xs text-white/50">${t.minAmountUsd}+</span>
              </div>
              <h4 className="font-medium text-white text-sm mb-1">{t.name}</h4>
              <p className="text-xs text-white/60 leading-relaxed">{t.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <BadgeChip tier={t.tier} size="sm" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
