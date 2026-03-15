'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { 
  SubscriptionTier, 
  PaymentMethod, 
  RegionConfig, 
  PPP_DATA, 
  calculateSubscriptionPrice 
} from '@/lib/subscription/ppp';

interface SubscriptionState {
  currentTier: SubscriptionTier;
  detectedRegion: RegionConfig & { countryCode: string };
  paymentMethod: PaymentMethod;
  isLoading: boolean;
  prices: Record<SubscriptionTier, number>;
  
  // Actions
  setPaymentMethod: (method: PaymentMethod) => void;
  setRegion: (countryCode: string) => void;
  refreshPrices: () => void;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('PRO');
  const [regionCode, setRegionCode] = useState<string>('DEFAULT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CRYPTO');
  const [isLoading, setIsLoading] = useState(true);

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
        // Attempt to detect region via IP
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.country_code && PPP_DATA[data.country_code]) {
          setRegionCode(data.country_code);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize subscription context or detect IP', error);
        setIsLoading(false);
      }
    };
    initSubscription();
  }, []);

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
