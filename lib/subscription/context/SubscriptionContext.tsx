'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { Client, Account } from 'appwrite';
import { 
  SubscriptionTier, 
  PaymentMethod, 
  RegionConfig, 
  PPP_DATA, 
  calculateSubscriptionPrice 
} from '../ppp';

interface SubscriptionState {
  currentTier: SubscriptionTier | 'FREE';
  detectedRegion: RegionConfig & { countryCode: string };
  paymentMethod: PaymentMethod;
  isLoading: boolean;
  prices: Record<SubscriptionTier, number>;
  setPaymentMethod: (method: PaymentMethod) => void;
  setRegion: (countryCode: string) => void;
  refreshPrices: () => void;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ 
  children,
  endpoint = 'https://fra.cloud.appwrite.io/v1',
  projectId = '67fe9627001d97e37ef3'
}: { 
  children: React.ReactNode,
  endpoint?: string,
  projectId?: string
}) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | 'FREE'>('FREE');
  const [regionCode, setRegionCode] = useState<string>('DEFAULT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CRYPTO');
  const [isLoading, setIsLoading] = useState(true);

  const client = useMemo(() => new Client().setEndpoint(endpoint).setProject(projectId), [endpoint, projectId]);
  const account = useMemo(() => new Account(client), [client]);

  const detectedRegion = useMemo(() => {
    return { ...PPP_DATA.DEFAULT, countryCode: 'US' };
  }, []);

  const prices = useMemo(() => ({
    PRO: calculateSubscriptionPrice('PRO', 'DEFAULT', paymentMethod),
    TEAMS: calculateSubscriptionPrice('TEAMS', 'DEFAULT', paymentMethod),
  }), [paymentMethod]);

  useEffect(() => {
    const initSubscription = async () => {
      try {
        const prefs = await account.getPrefs();
        if (prefs && prefs.tier) {
          setCurrentTier(prefs.tier as SubscriptionTier);
        } else {
          setCurrentTier('FREE');
        }

        setRegionCode('DEFAULT');
        setIsLoading(false);
      } catch (_error) {
        setCurrentTier('FREE');
        setRegionCode('DEFAULT');
        setIsLoading(false);
      }
    };
    initSubscription();
  }, [account]);

  const value: SubscriptionState = {
    currentTier,
    detectedRegion,
    paymentMethod,
    isLoading,
    prices,
    setPaymentMethod,
    setRegion: setRegionCode,
    refreshPrices: () => {},
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
