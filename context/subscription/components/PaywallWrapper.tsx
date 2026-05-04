'use client';

import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { SubscriptionTier } from '../lib/ppp';

interface PaywallWrapperProps {
  children: React.ReactNode;
  requiredTier: SubscriptionTier;
  fallback?: React.ReactNode;
}

export function PaywallWrapper({ 
  children, 
  requiredTier, 
  fallback 
}: PaywallWrapperProps) {
  const { currentTier, isLoading } = useSubscription();

  if (isLoading) return null;

  const tiers: (SubscriptionTier | 'FREE')[] = ['FREE', 'PRO'];
  const userTierIndex = tiers.indexOf(currentTier);
  const requiredTierIndex = tiers.indexOf(requiredTier);

  const hasAccess = userTierIndex >= requiredTierIndex;

  if (!hasAccess) {
    return fallback || (
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        backgroundColor: 'rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.1)',
        textAlign: 'center',
        margin: '16px 0'
      }}>
        <h3 style={{ marginBottom: '8px' }}>{requiredTier} Feature</h3>
        <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '14px', marginBottom: '16px' }}>
          This feature is only available for {requiredTier} subscribers.
        </p>
        <button 
          onClick={() => window.location.href = '/pricing'}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Upgrade to {requiredTier}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
