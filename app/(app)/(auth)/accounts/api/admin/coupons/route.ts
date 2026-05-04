import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { notifyGiftCouponIssued } from '@/lib/billing/subscription-notifications';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

function isAdminUser(user: any) {
  return Array.isArray(user?.labels) && user.labels.includes('admin');
}

function normalizeUserIds(input: unknown) {
  const ids = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

function parsePositiveInteger(value: unknown, field: string, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function parseStatus(value: unknown) {
  if (value === undefined || value === null || value === '') return 'active';
  const status = String(value).trim().toLowerCase();
  const allowed = new Set(['active', 'pending', 'expired', 'revoked', 'redeemed', 'used', 'applied']);
  if (!allowed.has(status)) {
    throw new Error('Invalid coupon status');
  }
  return status;
}

function serializeMetadata(metadata: unknown) {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata === 'string') return metadata;
  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({ value: String(metadata) });
  }
}

function buildCouponEventPayload(input: {
  actorId: string;
  targetUserId: string | null;
  discountPercent: number;
  expiresAt?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
  userId?: string;
  title?: string | null;
  scope: 'targeted' | 'open';
}) {
  return {
    userId: input.targetUserId || input.actorId,
    type: 'coupon',
    actorId: input.actorId,
    relatedUserId: input.targetUserId,
    status: input.status || 'active',
    discountPercent: input.discountPercent,
    expiresAt: input.expiresAt || null,
    delta: null,
    metadata: serializeMetadata({
      ...(input.metadata || {}),
      coupon: {
        userId: input.targetUserId,
        title: input.title || null,
        discountPercent: input.discountPercent,
        createdBy: input.actorId,
        scope: input.scope,
        targetUserId: input.targetUserId,
      },
    }),
  };
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get('userId');
    const statusFilter = url.searchParams.get('status');

    const { databases } = createAdminClient();
    const queries = [Query.equal('type', 'coupon')];
    if (targetUserId) {
      queries.push(Query.or([
        Query.equal('userId', targetUserId),
        Query.equal('relatedUserId', targetUserId),
      ]));
    }
    if (statusFilter) {
      queries.push(Query.equal('status', statusFilter.toLowerCase()));
    }
    queries.push(Query.orderDesc('$createdAt'));
    queries.push(Query.limit(100));
    queries.push(Query.select([
      '$id',
      'userId',
      'relatedUserId',
      'actorId',
      'type',
      'status',
      'discountPercent',
      'expiresAt',
      'metadata',
      '$createdAt',
    ]));

    const result = await databases.listDocuments(CHAT_DB_ID, EVENTS_TABLE_ID, queries);
    const coupons = result.documents;

    return NextResponse.json({ success: true, coupons }, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message || 'Failed to load coupons';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Admin Coupons API] GET error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserIds = normalizeUserIds(body?.userIds || body?.targetUserIds || body?.userId);
    const scope = targetUserIds.length > 0 ? 'targeted' : 'open';

    const discountPercent = parsePositiveInteger(body?.discountPercent, 'discountPercent', 1, 100);
    if (discountPercent === null) {
      return NextResponse.json({ error: 'discountPercent is required' }, { status: 400, headers: corsHeaders });
    }

    const expiresAt = typeof body?.expiresAt === 'string' && body.expiresAt.trim() ? body.expiresAt.trim() : null;
    const status = parseStatus(body?.status);
    const title = typeof body?.title === 'string' ? body.title.trim() : null;
    const metadata = typeof body?.metadata === 'object' && body.metadata ? body.metadata : null;
    const note = typeof body?.note === 'string' ? body.note.trim() : null;

    if (metadata && (metadata as any).couponCode) {
      throw new Error('couponCode is not supported; coupons are account-targeted only');
    }

    const { databases } = createAdminClient();
    const created: any[] = [];

    const recipients = targetUserIds.length > 0 ? targetUserIds : [null];

    for (const targetUserId of recipients) {
      const payload = buildCouponEventPayload({
        actorId: user.$id,
        targetUserId,
        discountPercent,
        expiresAt,
        status,
        metadata: {
          ...(metadata || {}),
          note,
          title,
          source: 'admin.coupons',
        },
        title,
        scope,
      });

      const row = await databases.createDocument(
        CHAT_DB_ID,
        EVENTS_TABLE_ID,
        ID.unique(),
        payload,
        targetUserId ? [Permission.read(Role.user(targetUserId))] : [Permission.read(Role.user(user.$id))],
      );
      created.push(row);

      if (targetUserId) {
        await notifyGiftCouponIssued({
          recipientUserId: targetUserId,
          giverName: user.name || user.email || 'Kylrix Accounts',
          plan: 'PRO_MONTH',
          months: 1,
          expiresAt: expiresAt,
          couponStatus: status,
          giftMessage: note || title || 'A subscription coupon has been created for your account.',
          claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.com'}/coupon/${row.$id}`,
        }).catch((error) => {
          console.warn('[Admin Coupons API] Failed to send coupon email:', error);
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        count: created.length,
        coupons: created,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to create coupon';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Admin Coupons API] POST error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function PATCH(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const couponId = typeof body?.couponId === 'string' ? body.couponId.trim() : '';
    if (!couponId) {
      return NextResponse.json({ error: 'couponId is required' }, { status: 400, headers: corsHeaders });
    }

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) patch.status = parseStatus(body.status);
    if (body.discountPercent !== undefined) {
      const discountPercent = parsePositiveInteger(body.discountPercent, 'discountPercent', 1, 100);
      if (discountPercent === null) {
        throw new Error('discountPercent is required');
      }
      patch.discountPercent = discountPercent;
    }
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt || null;
    if (body.metadata !== undefined) {
      const nextMetadata = typeof body.metadata === 'object' && body.metadata ? body.metadata : null;
      if (nextMetadata && (nextMetadata as any).couponCode) {
        throw new Error('couponCode is not supported; coupons are account-targeted only');
      }
      patch.metadata = serializeMetadata({
        ...(nextMetadata || {}),
        source: 'admin.coupons.patch',
      });
    }

    const { databases } = createAdminClient();
    const updated = await databases.updateDocument(CHAT_DB_ID, EVENTS_TABLE_ID, couponId, patch);

    return NextResponse.json(
      {
        success: true,
        coupon: updated,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to update coupon';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Admin Coupons API] PATCH error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
