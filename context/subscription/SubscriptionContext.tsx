'use client';

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import type { BillingUiTier } from '@/lib/subscription/tier-resolution';
import type { SubscriptionTier, PaymentMethod, RegionConfig } from '@/lib/subscription/ppp';
import { PPP_DATA, calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { account } from '@/lib/appwrite/client';
import { useAuth } from '@/context/auth/AuthContext';
import { verifyProEntitlementAction } from '@/app/(app)/(auth)/accounts/actions/billing';
import { normalizeBillingPrefsTier } from '@/lib/subscription/tier-resolution';

export type { BillingUiTier };

interface SubscriptionState {
  /** Tier after server entitlement + synced prefs gate (never from URL alone). */
  currentTier: BillingUiTier;
  detectedRegion: RegionConfig & { countryCode: string };
  paymentMethod: PaymentMethod;
  isLoading: boolean;
  prices: Record<SubscriptionTier, number>;
  exchangeRates: Record<string, number>;
  setPaymentMethod: (method: PaymentMethod) => void;
  setRegion: (countryCode: string) => void;
  refreshPrices: () => void;
  /** Re-query trusted entitlement (payments, ledger, staff prefs tracks). */
  refreshEntitlement: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();

  const [currentTier, setCurrentTier] = useState<BillingUiTier>('FREE');
  const [regionCode, setRegionCode] = useState<string>('DEFAULT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CRYPTO');
  const [tierLoading, setTierLoading] = useState(true);
  const [regionLoading, setRegionLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });

  const detectedRegion = useMemo(() => {
    const data = PPP_DATA[regionCode] || PPP_DATA.DEFAULT;
    return { ...data, countryCode: regionCode === 'DEFAULT' ? 'US' : regionCode };
  }, [regionCode]);

  const isLoading = authLoading || tierLoading || regionLoading;

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
        const data = await res.json();
        if (data.rates) {
          setExchangeRates({ USD: 1, ...data.rates });
        }
      } catch {
        console.error('[Subscription] Failed to fetch exchange rates');
      }
    };
    fetchRates();
  }, []);

  const prices = useMemo(
    () => ({
      PRO: calculateSubscriptionPrice('PRO', regionCode, paymentMethod),
    }),
    [regionCode, paymentMethod],
  );

  const applyRegionPrefs = useCallback(async () => {
    setRegionLoading(true);
    try {
      const prefs = await account.getPrefs().catch(() => null);
      if (prefs?.region && PPP_DATA[prefs.region as string]) {
        setRegionCode(prefs.region as string);
        return;
      }
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.country_code && PPP_DATA[data.country_code]) setRegionCode(data.country_code);
      } catch {
        // leave DEFAULT
      }
    } finally {
      setRegionLoading(false);
    }
  }, []);

  const refreshEntitlement = useCallback(async () => {
    if (authLoading) return;
    setTierLoading(true);
    try {
      if (!user || (user as { isPulse?: boolean }).isPulse) {
        setCurrentTier('FREE');
        return;
      }
      try {
        const jwt = await account.createJWT().then((r: { jwt?: string }) => r?.jwt || '').catch(() => '');
        const result = await verifyProEntitlementAction(jwt || undefined);
        if (result.authenticated) {
          setCurrentTier(result.uiTier);
          return;
        }
      } catch {
        /* fall through — prefs normalization */
      }

      try {
        const prefs = await account.getPrefs().catch(() => null);
        setCurrentTier(normalizeBillingPrefsTier(prefs as Record<string, unknown> | null));
      } catch {
        setCurrentTier('FREE');
      }
    } finally {
      setTierLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    void applyRegionPrefs();
  }, [applyRegionPrefs]);

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  const value: SubscriptionState = useMemo(
    () => ({
      currentTier,
      detectedRegion,
      paymentMethod,
      isLoading,
      prices,
      exchangeRates,
      setPaymentMethod,
      setRegion: setRegionCode,
      refreshPrices: () => {},
      refreshEntitlement,
    }),
    [
      currentTier,
      detectedRegion,
      paymentMethod,
      isLoading,
      prices,
      exchangeRates,
      refreshEntitlement,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return context;
}
