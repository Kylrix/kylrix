import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type BlockBeePendingCheckoutMeta = {
  paymentId: string;
  payerUserId: string;
  planId: string;
  months: number;
  countryCode: string;
  expectedAmountUsd: number;
  giftRecipientId?: string | null;
  giftRecipientName?: string | null;
  giftMessage?: string | null;
  couponId?: string | null;
  createdAt: string;
};

export async function registerBlockBeePendingCheckout(meta: Omit<BlockBeePendingCheckoutMeta, 'createdAt'>) {
  try {
    const id = `bbp_${meta.paymentId}`;
    await db.insert(schema.billingTransactions).values({
      id,
      paymentId: meta.paymentId,
      userId: meta.payerUserId,
      plan: meta.planId,
      amountUsd: String(meta.expectedAmountUsd),
      status: 'pending',
      couponId: meta.couponId || null,
      metadata: JSON.stringify(meta),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).onConflictDoNothing();
  } catch {}
}

export async function getBlockBeePendingCheckout(paymentId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.billingTransactions)
      .where(eq(schema.billingTransactions.paymentId, paymentId))
      .limit(1);

    if (rows.length > 0 && rows[0].metadata) {
      const parsed = JSON.parse(rows[0].metadata) as BlockBeePendingCheckoutMeta;
      return { doc: rows[0], meta: parsed };
    }
  } catch {}
  return null;
}

export async function markBlockBeePendingCheckoutConsumed(paymentId: string) {
  try {
    await db
      .update(schema.billingTransactions)
      .set({ status: 'completed', updatedAt: new Date().toISOString() })
      .where(eq(schema.billingTransactions.paymentId, paymentId));
  } catch {}
}

export async function acquireBlockBeeIpnLock(_paymentId: string, _payerUserId: string): Promise<'owner' | 'skip' | 'retry'> {
  return 'owner';
}

export async function releaseBlockBeeIpnLock(_paymentId: string) {}

export async function completeBlockBeeIpnLock(paymentId: string, _payerUserId: string, _snapshot: Record<string, unknown>) {
  await markBlockBeePendingCheckoutConsumed(paymentId);
}
