import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UsersService } from './users';

export type SupportedWalletChain =
    | 'eth'
    | 'usdc'
    | 'sol'
    | 'btc'
    | 'sui'
    | 'base'
    | 'polygon'
    | 'arbitrum';

export interface WalletSummary {
    id: string;
    chain: SupportedWalletChain;
    label: string;
    symbol: string;
    family: string;
    address: string;
    type: 'main' | 'burner' | 'agent_sub_wallet';
    publicProfile: boolean;
}

export const WalletService = {
    defaultChains: ['sol', 'eth', 'usdc', 'btc'],
    supportedChains: ['eth', 'usdc', 'sol', 'btc', 'sui', 'base', 'polygon', 'arbitrum'],

    async listMainWallets(userId: string): Promise<WalletSummary[]> {
        try {
            const rows = await db
                .select()
                .from(schema.wallets)
                .where(eq(schema.wallets.ownerId, `user:${userId}`));

            return rows.map((r) => ({
                id: r.id,
                chain: (r.chain || 'eth') as SupportedWalletChain,
                label: r.chain || 'Wallet',
                symbol: (r.chain || 'eth').toUpperCase(),
                family: 'evm',
                address: r.address,
                type: 'main',
                publicProfile: true,
            }));
        } catch {
            return [];
        }
    },

    async ensureMainWallets(userId: string): Promise<WalletSummary[]> {
        return this.listMainWallets(userId);
    },

    async addNetwork(userId: string, _chain: SupportedWalletChain): Promise<WalletSummary[]> {
        return this.listMainWallets(userId);
    },

    async derivePrivateKey(_userId: string, _chain: SupportedWalletChain): Promise<string> {
        throw new Error('Wallet vault is locked or key unavailable');
    },

    async exportMnemonic(_userId: string): Promise<string> {
        throw new Error('Wallet vault is locked or key unavailable');
    },
};
