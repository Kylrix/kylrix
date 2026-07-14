import { KylrixTokenService } from './token';
import { WalletService, type WalletSummary } from './wallets';
import { verifyProEntitlementAction, hydrateSessionAction } from '@/app/(app)/(auth)/accounts/actions/billing';
import { account } from '../appwrite/client';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { normalizeBillingPrefsTier, type BillingUiTier } from '../subscription/tier-resolution';

interface BalanceData {
    amount: string;
    symbol: string;
}

interface EntitlementData {
    uiTier: BillingUiTier;
    active: boolean;
    expiresAt: string | null;
}

let balanceCache: { data: BalanceData; expiresAt: number } | null = null;
let walletsCache: { data: WalletSummary[]; expiresAt: number } | null = null;
let entitlementCache: { data: EntitlementData; expiresAt: number } | null = null;

let balanceInFlight: Promise<BalanceData> | null = null;
let walletsInFlight: Promise<WalletSummary[]> | null = null;
let entitlementInFlight: Promise<EntitlementData> | null = null;
let hydrationInFlight: Promise<any> | null = null;

const TTL = 30000; // 30s for passive reads
const DEBOUNCE_MS = 2000; // 2s minimum between forced refreshes

let lastBalanceFetch = 0;
let lastWalletsFetch = 0;
let lastEntitlementFetch = 0;

export const BillingCacheService = {
    async getBalance(userId: string, force = false): Promise<BalanceData> {
        const now = Date.now();
        if (!force && balanceCache && balanceCache.expiresAt > now) {
            return balanceCache.data;
        }

        if (force && now - lastBalanceFetch < DEBOUNCE_MS && balanceCache) {
            return balanceCache.data;
        }

        if (balanceInFlight) return balanceInFlight;

        balanceInFlight = KylrixTokenService.getUserBalance(userId)
            .then(res => {
                const data = { amount: res.amount, symbol: res.symbol };
                balanceCache = { data, expiresAt: Date.now() + TTL };
                lastBalanceFetch = Date.now();
                return data;
            })
            .finally(() => {
                balanceInFlight = null;
            });

        return balanceInFlight;
    },

    async getWallets(userId: string, force = false): Promise<WalletSummary[]> {
        const now = Date.now();
        if (!force && walletsCache && walletsCache.expiresAt > now) {
            return walletsCache.data;
        }

        if (force && now - lastWalletsFetch < DEBOUNCE_MS && walletsCache) {
            return walletsCache.data;
        }

        if (walletsInFlight) return walletsInFlight;

        walletsInFlight = WalletService.listMainWallets(userId)
            .then(data => {
                walletsCache = { data, expiresAt: Date.now() + TTL };
                lastWalletsFetch = Date.now();
                return data;
            })
            .finally(() => {
                walletsInFlight = null;
            });

        return walletsInFlight;
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
                const jwt = await account.createJWT().then((r: { jwt?: string }) => r?.jwt || '').catch(() => '');
                const result = await verifyProEntitlementAction(jwt || undefined);
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
            } catch {
                /* fall through */
            }

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
            this.getBalance(userId, force),
            this.getWallets(userId, force),
            this.getEntitlement(userId, force)
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
                balanceCache = {
                    data: { amount: b.balance.amount, symbol: b.balance.symbol },
                    expiresAt: Date.now() + TTL
                };
                entitlementCache = {
                    data: { uiTier: b.tier, active: b.active, expiresAt: b.expiresAt },
                    expiresAt: Date.now() + TTL
                };
                walletsCache = {
                    data: b.wallets as WalletSummary[],
                    expiresAt: Date.now() + TTL
                };
            }
            return data;
        } catch (err) {
            console.warn('[BillingCacheService] Server hydration failed, falling back to client SDK:', err);
            return null;
        }
    },

    invalidate() {
        balanceCache = null;
        walletsCache = null;
        entitlementCache = null;
    }
};
