'use client';

import React from 'react';
import { useSubscription } from '../SubscriptionContext';

export interface SubscriptionBadgeProps {
  showFree?: boolean;
}

export function SubscriptionBadge({ showFree = false }: SubscriptionBadgeProps) {
  const { currentTier, isLoading } = useSubscription();

  if (isLoading) return null;
  if (!showFree && currentTier === 'FREE') return null;

  const styles: Record<string, React.CSSProperties> = {
    badge: {
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace',
    },
    FREE: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(255, 255, 255, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    PRO: {
      backgroundColor: 'rgba(99, 102, 241, 0.12)',
      color: '#A5B4FC',
      border: '1px solid rgba(99, 102, 241, 0.35)',
    },
    ORG: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      color: '#34D399',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    },
    LIFETIME: {
      backgroundColor: 'rgba(236, 72, 153, 0.1)',
      color: '#F472B6',
      border: '1px solid rgba(236, 72, 153, 0.35)',
    },
  };

  const currentStyle = styles[currentTier] || styles.FREE;

  return (
    <span style={{ ...styles.badge, ...currentStyle }}>
      {currentTier}
    </span>
  );
}
