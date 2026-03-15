'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { Client, Account } from 'appwrite';
import { 
  SubscriptionTier, 
  PaymentMethod, 
  RegionConfig, 
  PPP_DATA, 
  calculateSubscriptionPrice 
} from '@/lib/subscription/ppp';

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
    const data = PPP_DATA[regionCode] || PPP_DATA.DEFAULT;
    return { ...data, countryCode: regionCode === 'DEFAULT' ? 'US' : regionCode };
  }, [regionCode]);

  const prices = useMemo(() => ({
    PRO: calculateSubscriptionPrice('PRO', regionCode, paymentMethod),
    ULTRA: calculateSubscriptionPrice('ULTRA', regionCode, paymentMethod),
    ENTERPRISE: calculateSubscriptionPrice('ENTERPRISE', regionCode, paymentMethod),
  }), [regionCode, paymentMethod]);

  useEffect(() => {
    const initSubscription = async () => {
      try {
        const prefs = await account.getPrefs();
        if (prefs?.tier) setCurrentTier(prefs.tier as SubscriptionTier);
        if (prefs?.region && PPP_DATA[prefs.region]) setRegionCode(prefs.region);
        else {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.country_code && PPP_DATA[data.country_code]) setRegionCode(data.country_code);
        }
      } catch (e) {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.country_code && PPP_DATA[data.country_code]) setRegionCode(data.country_code);
        } catch (ipErr) {}
      } finally {
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

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return context;
}
