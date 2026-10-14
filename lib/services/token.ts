import {
  createKylrixTokenContract,
  DEFAULT_KYLRIX_TOKEN_POLICY,
  type KylrixActivityType,
} from '@/sdk/token';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const contract = createKylrixTokenContract();

export const KylrixTokenService = {
  contract,

  async getState() {
    return {
      symbol: contract.policy.symbol,
      decimals: contract.policy.decimals,
    };
  },

  async getSystemOverview() {
    return {
      symbol: contract.policy.symbol,
      decimals: contract.policy.decimals,
      maxSupplyMicro: contract.policy.maxSupplyMicro.toString(),
      totalMintedMicro: '0',
      totalBurnedMicro: '0',
      circulatingMicro: '0',
      rootBalanceMicro: '0',
      genesisAt: null,
      riskLevel: 'normal',
      contractVersion: 'kylrix-token-v1',
    };
  },

  async getUserBalance(userId: string) {
    try {
      const rows = await db
        .select({ balanceAfterMicro: schema.kylrixTokenLedger.balanceAfterMicro })
        .from(schema.kylrixTokenLedger)
        .where(eq(schema.kylrixTokenLedger.userId, userId))
        .orderBy(desc(schema.kylrixTokenLedger.createdAt))
        .limit(1);

      if (rows.length > 0 && rows[0].balanceAfterMicro) {
        const micro = BigInt(rows[0].balanceAfterMicro);
        const amount = (Number(micro) / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
        return {
          amountMicro: micro.toString(),
          amount,
          symbol: contract.policy.symbol,
        };
      }
    } catch {}

    return {
      amountMicro: '0',
      amount: '0',
      symbol: contract.policy.symbol,
    };
  },

  async mintForActivity(_input: {
    userId: string;
    idempotencyKey: string;
    activityType: KylrixActivityType;
    uniqueActors: number;
    trustScore: number;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
  },

  async transfer(_input: any) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
  },

  async listUserLedger(userId: string, limit = 100) {
    try {
      const rows = await db
        .select()
        .from(schema.kylrixTokenLedger)
        .where(eq(schema.kylrixTokenLedger.userId, userId))
        .orderBy(desc(schema.kylrixTokenLedger.createdAt))
        .limit(limit);

      return rows;
    } catch {
      return [];
    }
  },

  async evaluateUserRisk(userId: string) {
    return {
      userId,
      suspicious: false,
      reasons: [],
    };
  },

  async applyFineToRoot(_input: any) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
  },

  async lockClaim(_input: any) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
  },

  async settleClaim(_input: any) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
  },
};
