import { KylrixTokenService } from './token';
import { WalletService, type WalletSummary } from './wallets';

interface BalanceData {
    amount: string;
    symbol: string;
}

let balanceCache: { data: BalanceData; expiresAt: number } | null = null;
let walletsCache: { data: WalletSummary[]; expiresAt: number } | null = null;
let balanceInFlight: Promise<BalanceData> | null = null;
let walletsInFlight: Promise<WalletSummary[]> | null = null;

const TTL = 30000; // 30s for passive reads
const DEBOUNCE_MS = 2000; // 2s minimum between forced refreshes

let lastBalanceFetch = 0;
let lastWalletsFetch = 0;

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

    invalidate() {
        balanceCache = null;
        walletsCache = null;
    }
};
