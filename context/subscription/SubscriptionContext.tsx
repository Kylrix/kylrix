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
import { BillingCacheService } from '@/lib/services/billing';
import type { WalletSummary } from '@/lib/services/wallets';

export type { BillingUiTier };

interface SubscriptionState {
  /** Tier after server entitlement + synced prefs gate (never from URL alone). */
  currentTier: BillingUiTier;
  detectedRegion: RegionConfig & { countryCode: string };
  paymentMethod: PaymentMethod;
  isLoading: boolean;
  prices: Record<SubscriptionTier, number>;
  exchangeRates: Record<string, number>;
  tokenBalance: { amount: string; symbol: string } | null;
  wallets: WalletSummary[];
  expiresAt: string | null;
  setPaymentMethod: (method: PaymentMethod) => void;
  setRegion: (countryCode: string) => void;
  refreshPrices: () => void;
  /** Re-query trusted entitlement (payments, ledger, staff prefs tracks). */
  refreshEntitlement: () => Promise<void>;
  refreshBalances: (force?: boolean) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();

  const [currentTier, setCurrentTier] = useState<BillingUiTier>('FREE');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [regionCode, setRegionCode] = useState<string>('DEFAULT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CRYPTO');
  const [tierLoading, setTierLoading] = useState(true);
  const [regionLoading, setRegionLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });
  
  const [tokenBalance, setTokenBalance] = useState<{ amount: string; symbol: string } | null>(null);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const detectedRegion = useMemo(() => {
    return { ...PPP_DATA.DEFAULT, countryCode: 'US' };
  }, []);

  const isLoading = authLoading || tierLoading || balanceLoading;

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
      PRO: calculateSubscriptionPrice('PRO', 'DEFAULT', paymentMethod),
      TEAMS: calculateSubscriptionPrice('TEAMS', 'DEFAULT', paymentMethod),
    }),
    [paymentMethod],
  );

  const refreshEntitlement = useCallback(async (force = false) => {
    if (authLoading || !user?.$id) return;
    setTierLoading(true);
    try {
      if ((user as { isPulse?: boolean }).isPulse) {
        setCurrentTier('FREE');
        setExpiresAt(null);
        return;
      }
      const ent = await BillingCacheService.getEntitlement(user.$id, force);
      setCurrentTier(ent.uiTier);
      setExpiresAt(ent.expiresAt);
    } catch (err) {
      console.warn('[SubscriptionContext] Failed to refresh entitlement:', err);
    } finally {
      setTierLoading(false);
    }
  }, [user, authLoading]);

  const refreshBalances = useCallback(async (force = false) => {
    if (authLoading || !user?.$id) return;
    setBalanceLoading(true);
    try {
      const [bal, w] = await Promise.all([
        BillingCacheService.getBalance(user.$id, force),
        BillingCacheService.getWallets(user.$id, force)
      ]);
      setTokenBalance(bal);
      setWallets(w);
    } catch (err) {
      console.warn('[SubscriptionContext] Failed to refresh balances:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.$id, authLoading]);

  const checkSubscriptionExpiry = useCallback(async (expiresAtVal: string | null, active: boolean) => {
    if (!active || !expiresAtVal || !user?.$id) return;

    const lastCheckKey = `kylrix_expiry_reminder_check_${user.$id}`;
    const lastCheck = localStorage.getItem(lastCheckKey);
    const nowMs = Date.now();

    // Cache check weekly: skip if checked within the last 7 days
    if (lastCheck && (nowMs - parseInt(lastCheck)) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const expiryTime = new Date(expiresAtVal).getTime();
    const twoDaysFromNow = nowMs + 2 * 24 * 60 * 60 * 1000;

    // Send expiry reminder email 2 days before actual expiry
    if (expiryTime <= twoDaysFromNow && expiryTime > nowMs) {
      try {
        const { sendSubscriptionExpiryReminderAction } = await import('@/app/(app)/(auth)/accounts/actions/billing');
        const jwt = await account.createJWT().then((r: { jwt?: string }) => r?.jwt || '').catch(() => '');
        const res = await sendSubscriptionExpiryReminderAction(jwt || undefined);
        if (res?.success) {
          console.log('[SubscriptionContext] Expiry reminder email sent successfully.');
          localStorage.setItem(lastCheckKey, nowMs.toString());
        }
      } catch (err) {
        console.warn('[SubscriptionContext] Failed to send subscription expiry email:', err);
      }
    }
  }, [user?.$id]);

  const hydrateSubscriptionState = useCallback(async (force = false) => {
    if (authLoading || !user?.$id) return;
    setTierLoading(true);
    setBalanceLoading(true);
    try {
      if ((user as { isPulse?: boolean }).isPulse) {
        setCurrentTier('FREE');
        setTokenBalance(null);
        setWallets([]);
        setExpiresAt(null);
        return;
      }

      // Try server hydration first for initial load or forced refresh
      if (force) {
        const serverData = await BillingCacheService.hydrateFromServer();
        if (serverData?.billing) {
            setTokenBalance({ amount: serverData.billing.balance.amount, symbol: serverData.billing.balance.symbol });
            setWallets(serverData.billing.wallets);
            setCurrentTier(serverData.billing.tier);
            setExpiresAt(serverData.billing.expiresAt);
            void checkSubscriptionExpiry(serverData.billing.expiresAt, serverData.billing.active);
            return;
        }
      }

      const [bal, w, ent] = await BillingCacheService.hydrate(user.$id, force);
      setTokenBalance(bal);
      setWallets(w);
      setCurrentTier(ent.uiTier);
      setExpiresAt(ent.expiresAt);
      void checkSubscriptionExpiry(ent.expiresAt, ent.active);
    } catch (err) {
      console.warn('[SubscriptionContext] Failed to hydrate subscription state:', err);
    } finally {
      setTierLoading(false);
      setBalanceLoading(false);
    }
  }, [user?.$id, authLoading, checkSubscriptionExpiry]);

  useEffect(() => {
    void hydrateSubscriptionState();
  }, [hydrateSubscriptionState]);

  useEffect(() => {
    if (!user?.$id) return;
    const interval = setInterval(() => {
      void hydrateSubscriptionState(false); // Passive refresh
    }, 45000); // 45s refresh loop for tokens/wallets/entitlement
    return () => clearInterval(interval);
  }, [user?.$id, hydrateSubscriptionState]);

  useEffect(() => {
    const handler = () => {
      void hydrateSubscriptionState(true); // Force refresh on ledger events
    };
    window.addEventListener('kylrix:token-event', handler);
    return () => window.removeEventListener('kylrix:token-event', handler);
  }, [hydrateSubscriptionState]);

  const value: SubscriptionState = useMemo(
    () => ({
      currentTier,
      detectedRegion,
      paymentMethod,
      isLoading,
      prices,
      exchangeRates,
      tokenBalance,
      wallets,
      expiresAt,
      setPaymentMethod,
      setRegion: setRegionCode,
      refreshPrices: () => {},
      refreshEntitlement,
      refreshBalances,
    }),
    [
      currentTier,
      detectedRegion,
      paymentMethod,
      isLoading,
      prices,
      exchangeRates,
      tokenBalance,
      wallets,
      expiresAt,
      refreshEntitlement,
      refreshBalances],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return context;
}
