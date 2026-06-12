import crypto from 'crypto';
import { Permission, Role } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

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

function hashDocSegment(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 28);
}

export function blockBeePendingCheckoutDocId(paymentId: string): string {
  return `bbp_${hashDocSegment(`pend:${paymentId}`)}`;
}

export function blockBeeIpnReceiptDocId(paymentId: string): string {
  return `bbi_${hashDocSegment(`ipn:${paymentId}`)}`;
}

function isDuplicateDocumentError(e: unknown): boolean {
  const msg = String((e as any)?.message || e || '');
  const code = (e as any)?.code;
  return code === 409 || msg.includes('already exists') || msg.includes('duplicate');
}

export async function registerBlockBeePendingCheckout(meta: Omit<BlockBeePendingCheckoutMeta, 'createdAt'>) {
  const { databases } = createSystemClient();
  const docId = blockBeePendingCheckoutDocId(meta.paymentId);
  const payload: BlockBeePendingCheckoutMeta = {
    ...meta,
    createdAt: new Date().toISOString(),
  };

  try {
    await databases.createRow(
      CHAT_DB_ID,
      EVENTS_TABLE_ID,
      docId,
      {
        userId: meta.payerUserId,
        type: 'billing_checkout_pending',
        actorId: meta.payerUserId,
        relatedUserId: meta.payerUserId,
        status: 'pending',
        expiresAt: null,
        delta: null,
        metadata: JSON.stringify(payload),
      },
      [Permission.read(Role.user(meta.payerUserId))],
    );
  } catch (e) {
    if (isDuplicateDocumentError(e)) return;
    throw e;
  }
}

export async function getBlockBeePendingCheckout(paymentId: string) {
  const { databases } = createSystemClient();
  const docId = blockBeePendingCheckoutDocId(paymentId);
  try {
    const doc = await databases.getRow(CHAT_DB_ID, EVENTS_TABLE_ID, docId);
    if (String(doc.status || '').toLowerCase() !== 'pending') return null;
    const raw = doc.metadata;
    if (typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw) as BlockBeePendingCheckoutMeta;
    if (!parsed?.payerUserId || !parsed?.paymentId) return null;
    return { doc, meta: parsed };
  } catch {
    return null;
  }
}

export async function markBlockBeePendingCheckoutConsumed(paymentId: string) {
  const { databases } = createSystemClient();
  const docId = blockBeePendingCheckoutDocId(paymentId);
  try {
    const doc = await databases.getRow(CHAT_DB_ID, EVENTS_TABLE_ID, docId);
    const meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : {};
    await databases.updateRow(CHAT_DB_ID, EVENTS_TABLE_ID, docId, {
      status: 'applied',
      metadata: JSON.stringify({
        ...meta,
        consumedAt: new Date().toISOString(),
      }),
    });
  } catch {
    /* non-fatal */
  }
}

/** Acquire exclusive processing lock for this payment_id IPN (503 → BlockBee retries). */
export async function acquireBlockBeeIpnLock(paymentId: string, payerUserId: string): Promise<'owner' | 'skip' | 'retry'> {
  const { databases } = createSystemClient();
  const receiptId = blockBeeIpnReceiptDocId(paymentId);
  try {
    await databases.createRow(CHAT_DB_ID, EVENTS_TABLE_ID, receiptId, {
      userId: payerUserId,
      type: 'billing_ipn_lock',
      actorId: 'blockbee',
      relatedUserId: payerUserId,
      status: 'processing',
      expiresAt: null,
      delta: null,
      metadata: JSON.stringify({ paymentId, startedAt: new Date().toISOString() }),
    });
    return 'owner';
  } catch (e) {
    if (!isDuplicateDocumentError(e)) throw e;
    try {
      const existing = await databases.getRow(CHAT_DB_ID, EVENTS_TABLE_ID, receiptId);
      const st = String(existing.status || '').toLowerCase();
      if (st === 'applied' || st === 'completed') return 'skip';
      return 'retry';
    } catch {
      return 'retry';
    }
  }
}

export async function releaseBlockBeeIpnLock(paymentId: string) {
  const { databases } = createSystemClient();
  const receiptId = blockBeeIpnReceiptDocId(paymentId);
  try {
    await databases.deleteRow(CHAT_DB_ID, EVENTS_TABLE_ID, receiptId);
  } catch {
    /* ignore */
  }
}

export async function completeBlockBeeIpnLock(paymentId: string, payerUserId: string, snapshot: Record<string, unknown>) {
  const { databases } = createSystemClient();
  const receiptId = blockBeeIpnReceiptDocId(paymentId);
  await databases.updateRow(CHAT_DB_ID, EVENTS_TABLE_ID, receiptId, {
    userId: payerUserId,
    relatedUserId: payerUserId,
    status: 'applied',
    metadata: JSON.stringify({
      paymentId,
      completedAt: new Date().toISOString(),
      snapshot,
    }),
  });
}
