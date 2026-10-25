import { ulid } from '@/lib/utils/ulid';
import { WalletService, type SupportedWalletChain } from './wallets';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface Web3Balance {
  formatted: string;
  value: bigint;
  symbol: string;
}

export const Web3WalletService = {
  async getBalancesMulticall(
    _userId: string,
    chain: SupportedWalletChain,
    _tokenAddresses: { address: string; symbol: string; decimals: number }[]
  ) {
    return [
      {
        symbol: chain.toUpperCase(),
        formatted: '0.0000',
        value: '0',
      },
    ];
  },

  async getBalance(_userId: string, chain: SupportedWalletChain): Promise<Web3Balance> {
    return {
      formatted: '0.0000',
      value: 0n,
      symbol: chain.toUpperCase(),
    };
  },

  async prepareTransfer(input: {
    userId: string;
    chain: SupportedWalletChain;
    recipientAddress: string;
    amountEther: string;
  }) {
    const wallets = await WalletService.listMainWallets(input.userId);
    const senderWallet = wallets.find((w) => w.chain === input.chain);

    return {
      from: senderWallet?.address || '0x0000000000000000000000000000000000000000',
      to: input.recipientAddress,
      value: '0',
      gasEstimate: '21000',
      gasPrice: '1000000000',
      estimatedFeeEther: '0.000021',
    };
  },

  async getTokenRegistry(_chain?: SupportedWalletChain) {
    return [];
  },

  async logTransaction(input: {
    userId: string;
    chain: SupportedWalletChain;
    hash: string;
    from: string;
    to: string;
    value: string;
    symbol: string;
  }) {
    const id = input.hash || ulid();
    const data = {
      id,
      userId: input.userId,
      chain: input.chain,
      hash: input.hash,
      from: input.from,
      to: input.to,
      value: input.value,
      symbol: input.symbol,
      timestamp: Date.now(),
    };

    try {
      await db.insert(schema.web3Transactions).values(data).onConflictDoNothing();
    } catch {}

    return { $id: id, ...data };
  },

  async getTransactionHistory(input: {
    userId: string;
    chain?: SupportedWalletChain;
    limit?: number;
    offset?: number;
  }) {
    try {
      const conditions = [eq(schema.web3Transactions.userId, input.userId)];
      if (input.chain) {
        conditions.push(eq(schema.web3Transactions.chain, input.chain));
      }

      const rows = await db
        .select()
        .from(schema.web3Transactions)
        .where(and(...conditions))
        .orderBy(desc(schema.web3Transactions.timestamp))
        .limit(input.limit || 50);

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        chain: row.chain,
        hash: row.hash,
        from: row.from,
        to: row.to,
        value: row.value,
        symbol: row.symbol,
        timestamp: row.timestamp,
      }));
    } catch {
      return [];
    }
  },
};
