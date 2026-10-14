import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const InternalKylrixTokenService = {
  async getState() {
    return { initialized: true, state: null };
  },

  async initializeState() {
    return { initialized: true };
  },

  async mintForActivity(input: any) {
    return { accepted: true, amountMicro: '0', amount: '0', symbol: '$KYLRIX' };
  },

  async transfer(input: any) {
    return { accepted: true, amountMicro: '0', amount: '0', symbol: '$KYLRIX' };
  },

  async zapObject(input: any) {
    return { accepted: true, amountMicro: '0', amount: '0', symbol: '$KYLRIX' };
  },

  async fineToRoot(input: any) {
    return { accepted: true };
  },

  async lockClaim(input: any) {
    return { accepted: true };
  },

  async settleClaim(input: any) {
    return { accepted: true };
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
          userId,
          amountMicro: micro.toString(),
          amount,
          symbol: '$KYLRIX',
        };
      }
    } catch {}

    return {
      userId,
      amountMicro: '0',
      amount: '0',
      symbol: '$KYLRIX',
    };
  },
};
