'use server';

import { ID, Permission, Query, Role } from 'node-appwrite';
import { getActor } from '@/lib/actions/secure-ops';
import { createAdminClient, createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { requireAdmin } from '@/lib/services/internal/admin';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const COUPONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.COUPONS;

export async function listCouponsAction(jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  const { databases } = createAdminClient(user.email);
  const result = await databases.listRows(NOTE_DB_ID, COUPONS_TABLE_ID, [
    Query.orderDesc('$createdAt'),
    Query.limit(100)
  ]);
  return result.rows;
}

function parseMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function invalidateCouponAction(couponId: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);
  
  const { databases } = createAdminClient(user.email);
  await databases.updateRow(NOTE_DB_ID, COUPONS_TABLE_ID, couponId, {
    status: 'revoked'
  });
  return { success: true };
}

export async function deleteCouponByIdAction(couponId: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const { databases } = createAdminClient(user.email);
  await databases.deleteRow(NOTE_DB_ID, COUPONS_TABLE_ID, couponId);
  return { success: true, deletedId: couponId };
}

export async function deleteCouponsBulkAction(
  filter: {
    mode: 'open' | 'active' | 'used' | 'user';
    targetUserId?: string;
  },
  jwt?: string
) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const { databases } = createAdminClient(user.email);
  let pageOffset = 0;
  const batchSize = 100;
  let allRows: any[] = [];

  while (true) {
    const res = await databases.listRows(NOTE_DB_ID, COUPONS_TABLE_ID, [
      Query.limit(batchSize),
      Query.offset(pageOffset)
    ]);
    allRows = allRows.concat(res.rows);
    if (res.rows.length < batchSize) break;
    pageOffset += batchSize;
  }

  let toDelete: any[] = [];

  if (filter.mode === 'open') {
    toDelete = allRows.filter((row: any) => {
      const meta = parseMetadata(row.metadata);
      const scope = meta?.coupon?.scope || meta?.scope || (row.targetUserId || row.relatedUserId ? 'targeted' : 'open');
      return scope === 'open' || (!row.targetUserId && !row.relatedUserId);
    });
  } else if (filter.mode === 'active') {
    toDelete = allRows.filter((row: any) => String(row.status || 'active').toLowerCase() === 'active');
  } else if (filter.mode === 'used') {
    toDelete = allRows.filter((row: any) => {
      const status = String(row.status || '').toLowerCase();
      const count = Number(row.redemptionCount || 0);
      const limit = Number(row.redemptionLimit || 1);
      return status === 'used' || (limit > 0 && count >= limit);
    });
  } else if (filter.mode === 'user') {
    if (!filter.targetUserId) {
      throw new Error('Target user ID is required to delete coupons by user');
    }
    const uid = filter.targetUserId;
    toDelete = allRows.filter((row: any) => row.targetUserId === uid || row.relatedUserId === uid || row.userId === uid);
  }

  let deletedCount = 0;
  for (const row of toDelete) {
    try {
      await databases.deleteRow(NOTE_DB_ID, COUPONS_TABLE_ID, row.$id);
      deletedCount++;
    } catch (err) {
      console.warn(`[Admin] Failed to delete coupon ${row.$id}:`, err);
    }
  }

  return { success: true, count: deletedCount };
}

export async function createCouponAction(input: {
  userIds?: string[];
  discountPercent: number;
  status?: string;
  expiresAt?: string;
  title?: string;
  note?: string;
  redemptionLimit?: number;
  months?: number;
  planId?: string;
  metadata?: Record<string, unknown>;
}, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  const { databases } = createAdminClient(user.email);
  const systemClient = createSystemClient();
  const recipients = (input.userIds || []).map((id: any) => String(id || '').trim()).filter(Boolean);
  const scope = recipients.length > 0 ? 'targeted' : 'open';
  const targets = recipients.length > 0 ? recipients : [null];
  const created: any[] = [];
  
  for (const targetUserId of targets) {
    const row = await databases.createRow(
      NOTE_DB_ID,
      COUPONS_TABLE_ID,
      ID.unique(),
      {
        discountPercent: Number(input.discountPercent),
        discountPercentage: Number(input.discountPercent),
        status: String(input.status || 'active').toLowerCase(),
        expiresAt: input.expiresAt || null,
        redemptionLimit: targetUserId ? 1 : Math.max(1, Number(input.redemptionLimit || 1)),
        redemptionCount: 0,
        targetUserId: targetUserId || null,
        createdBy: user.$id,
        title: input.title || null,
        note: input.note || null,
        metadata: JSON.stringify({
          ...(input.metadata || {}),
          scope,
          source: 'admin.coupons.action',
          months: input.months ? Number(input.months) : 1,
          planId: input.planId || 'PRO_MONTH'})},
      targetUserId ? [Permission.read(Role.user(targetUserId))] : [Permission.read(Role.user(user.$id))]);
    created.push(row);

    // Dispatch email if targeted
    if (targetUserId) {
      try {
        const { users: systemUsers } = systemClient;
        const targetAccount = await systemUsers.get(targetUserId);
        if (targetAccount && targetAccount.email) {
          const { dispatchEmail } = await import('@/lib/services/internal/emailDispatch');
          await dispatchEmail({
            eventType: 'coupon_issued', 
            sourceApp: 'accounts',
            recipientEmails: [targetAccount.email],
            recipientIds: [targetUserId],
            actorId: user.$id,
            actorName: 'Kylrix Admin',
            metadata: {
              subject: 'You received a Kylrix Coupon!',
              couponId: row.$id,
              discountPercent: Number(input.discountPercent),
              couponUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.space'}/billing/coupon/${row.$id}`
            }
          });
        }
      } catch (err) {
        console.warn('[Admin] Failed to send coupon email to target:', err);
      }
    }
  }
  return { count: created.length, coupons: created };
}

export async function getMyCouponsAction(jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  const systemClient = createSystemClient();
  const { databases } = systemClient;
  const result = await databases.listRows(NOTE_DB_ID, COUPONS_TABLE_ID, [
    Query.equal('targetUserId', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(50)
  ]);
  return result.rows;
}
