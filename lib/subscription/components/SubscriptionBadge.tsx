'use client';

import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';

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
      backgroundColor: 'rgba(0, 112, 243, 0.1)',
      color: '#0070f3',
      border: '1px solid rgba(0, 112, 243, 0.3)',
    },
  };

  const currentStyle = styles[currentTier] || styles.FREE;

  return (
    <span style={{ ...styles.badge, ...currentStyle }}>
      {currentTier}
    </span>
  );
}
