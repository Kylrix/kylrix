import { verifyProEntitlementAction, hydrateSessionAction } from '@/lib/actions/billing/billing';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { type BillingUiTier } from '../subscription/tier-resolution';

interface BalanceData {
  amount: string;
  symbol: string;
}

export interface WalletSummary {
  id: string;
  chain: string;
  label: string;
  symbol: string;
  family: string;
  address: string;
  type?: string;
  publicProfile?: boolean;
}

interface EntitlementData {
  uiTier: BillingUiTier;
  active: boolean;
  expiresAt: string | null;
}

let entitlementCache: { data: EntitlementData; expiresAt: number } | null = null;
let entitlementInFlight: Promise<EntitlementData> | null = null;
let hydrationInFlight: Promise<any> | null = null;

const TTL = 30000;
const DEBOUNCE_MS = 2000;

let lastEntitlementFetch = 0;

export const BillingCacheService = {
  async getBalance(_userId: string, _force = false): Promise<BalanceData> {
    return { amount: '0', symbol: 'KYLRIX' };
  },

  async getWallets(_userId: string, _force = false): Promise<WalletSummary[]> {
    return [];
  },

  async getEntitlement(userId: string, force = false): Promise<EntitlementData> {
    if (isSelfHostedDeployment()) {
      const open = getOpenSuiteEntitlement();
      const data = {
        uiTier: open.uiTier,
        active: open.active,
        expiresAt: open.expiresAt,
      };
      entitlementCache = { data, expiresAt: Date.now() + TTL };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`kylrix_entitlement_${userId}`, JSON.stringify(data));
      }
      return data;
    }

    const now = Date.now();
    if (!force && entitlementCache && entitlementCache.expiresAt > now) {
      return entitlementCache.data;
    }

    if (force && now - lastEntitlementFetch < DEBOUNCE_MS && entitlementCache) {
      return entitlementCache.data;
    }

    if (entitlementInFlight) return entitlementInFlight;

    entitlementInFlight = (async () => {
      try {
        const result = await verifyProEntitlementAction();
        if (result.authenticated) {
          const data = {
            uiTier: result.uiTier as BillingUiTier,
            active: result.active,
            expiresAt: result.expiresAt,
          };
          entitlementCache = { data, expiresAt: Date.now() + TTL };
          lastEntitlementFetch = Date.now();
          if (typeof window !== 'undefined') {
            localStorage.setItem(`kylrix_entitlement_${userId}`, JSON.stringify(data));
          }
          return data;
        }
      } catch {}

      const data = { uiTier: 'FREE' as BillingUiTier, active: false, expiresAt: null };
      entitlementCache = { data, expiresAt: Date.now() + TTL };
      lastEntitlementFetch = Date.now();
      return data;
    })().finally(() => {
      entitlementInFlight = null;
    });

    return entitlementInFlight;
  },

  /** Synchronous read of cached entitlement (memory → localStorage). */
  peekEntitlement(userId: string): EntitlementData | null {
    const now = Date.now();
    if (entitlementCache && entitlementCache.expiresAt > now) {
      return entitlementCache.data;
    }
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`kylrix_entitlement_${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as EntitlementData;
    } catch {
      return null;
    }
  },

  async hydrate(userId: string, force = false) {
    if (hydrationInFlight) return hydrationInFlight;

    hydrationInFlight = Promise.all([
      this.getEntitlement(userId, force),
    ]).finally(() => {
      hydrationInFlight = null;
    });

    return hydrationInFlight;
  },

  async hydrateFromServer() {
    try {
      const data = await hydrateSessionAction();

      if (data.billing) {
        const b = data.billing;
        entitlementCache = {
          data: { uiTier: b.tier, active: b.active, expiresAt: b.expiresAt },
          expiresAt: Date.now() + TTL,
        };
      }
      return data;
    } catch (err) {
      console.warn('[BillingCacheService] Server hydration failed, falling back to client SDK:', err);
      return null;
    }
  },

  invalidate() {
    entitlementCache = null;
  },
};
