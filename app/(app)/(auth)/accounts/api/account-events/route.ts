import { NextRequest, NextResponse } from 'next/server';
import { Permission, Query, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

type AccountEventType =
  | 'referral'
  | 'reputation'
  | 'report'
  | 'coupon'
  | 'username_change'
  | 'verification'
  | 'profile_sync';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

const ADMIN_ONLY_TYPES = new Set<AccountEventType>(['coupon', 'referral', 'verification', 'reputation']);
const SELF_SYNC_TYPES = new Set<AccountEventType>(['username_change', 'profile_sync']);

function isAdminUser(user: any) {
  return Array.isArray(user?.labels) && user.labels.includes('admin');
}

function normalizeUsername(input: string | null | undefined) {
  if (!input) return null;
  const cleaned = input
    .toString()
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return cleaned || null;
}

function normalizeType(input: unknown): AccountEventType | null {
  if (typeof input !== 'string') return null;
  const type = input.trim().toLowerCase() as AccountEventType;
  const allowed: AccountEventType[] = ['referral', 'reputation', 'report', 'coupon', 'username_change', 'verification', 'profile_sync'];
  return allowed.includes(type) ? type : null;
}

function normalizeUserIds(body: any, fallbackUserId: string): string[] {
  const ids = Array.isArray(body?.userIds)
    ? body.userIds
    : body?.userId
      ? [body.userId]
      : fallbackUserId
        ? [fallbackUserId]
        : [];

  return Array.from(new Set(ids.map((id: any) => String(id || '').trim()).filter(Boolean)));
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

function parseCouponTitle(body: any, rawMetadata: any) {
  const title = typeof body?.title === 'string'
    ? body.title.trim()
    : typeof rawMetadata === 'object' && rawMetadata && typeof rawMetadata.title === 'string'
      ? rawMetadata.title.trim()
      : '';
  return title || null;
}

function parseExpiresAt(body: any, rawMetadata: any) {
  const expiresAt = typeof body?.expiresAt === 'string'
    ? body.expiresAt.trim()
    : typeof rawMetadata === 'object' && rawMetadata && typeof rawMetadata.expiresAt === 'string'
      ? rawMetadata.expiresAt.trim()
      : '';
  return expiresAt || null;
}

function isCouponAppliedStatus(status: string) {
  return ['active', 'pending', 'expired', 'revoked', 'redeemed', 'used', 'applied'].includes(status);
}

function parseReportReason(body: any, rawMetadata: any) {
  const reason = typeof body?.reason === 'string'
    ? body.reason.trim()
    : typeof rawMetadata === 'object' && rawMetadata && typeof rawMetadata.reason === 'string'
      ? rawMetadata.reason.trim()
      : '';
  return reason || null;
}

async function getProfileByUserId(databases: ReturnType<typeof createAdminClient>['databases'], userId: string) {
  const result = await databases.listDocuments(CHAT_DB_ID, PROFILES_TABLE_ID, [
    Query.equal('userId', userId),
    Query.limit(2),
  ]);

  return {
    profile: result.documents[0] || null,
    total: result.total,
  };
}

function buildDefaultStatus(type: AccountEventType) {
  switch (type) {
    case 'coupon':
      return 'active';
    case 'verification':
      return 'pending';
    case 'username_change':
    case 'profile_sync':
      return 'synced';
    case 'report':
      return 'pending';
    case 'referral':
    case 'reputation':
    default:
      return 'active';
  }
}

async function syncProfileForEvent(
  databases: ReturnType<typeof createAdminClient>['databases'],
  type: AccountEventType,
  targetUserId: string,
  body: any,
) {
  if (!SELF_SYNC_TYPES.has(type)) {
    return { synced: false, before: null, after: null };
  }

  const { profile } = await getProfileByUserId(databases, targetUserId);
  if (!profile) {
    throw new Error(`Profile not found for ${targetUserId}`);
  }

  const metadata = typeof body?.metadata === 'object' && body?.metadata ? body.metadata : {};
  const patch: Record<string, unknown> = {};

  if (type === 'username_change') {
    const nextUsername = normalizeUsername(body?.newUsername || metadata?.newUsername || metadata?.username);
    if (!nextUsername) {
      throw new Error('newUsername is required for username_change events');
    }
    patch.username = nextUsername;
  }

  const allowedKeys = ['username', 'displayName', 'bio', 'avatar', 'publicKey', 'walletAddress', 'status'];
  for (const key of allowedKeys) {
    const value = body?.profilePatch?.[key] ?? metadata?.patch?.[key] ?? body?.[key];
    if (value !== undefined) {
      if (key === 'username' && typeof value === 'string') {
        const normalized = normalizeUsername(value);
        if (!normalized) {
          throw new Error('Invalid username');
        }
        patch[key] = normalized;
      } else {
        patch[key] = value;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return {
      synced: false,
      before: profile,
      after: profile,
    };
  }

  const updated = await databases.updateDocument(CHAT_DB_ID, PROFILES_TABLE_ID, profile.$id, patch);
  return {
    synced: true,
    before: profile,
    after: updated,
  };
}

async function createEventRows(
  databases: ReturnType<typeof createAdminClient>['databases'],
  actorId: string,
  type: AccountEventType,
  targetUserIds: string[],
  body: any,
) {
  const rawMetadata = body?.metadata;
  const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : buildDefaultStatus(type);
  const relatedUserId = typeof body?.relatedUserId === 'string' ? body.relatedUserId.trim() : null;
  const delta = typeof body?.delta === 'number' ? body.delta : (typeof body?.delta === 'string' ? Number(body.delta) : null);
  const discountPercent = typeof body?.discountPercent === 'number'
    ? body.discountPercent
    : typeof body?.discountPercent === 'string'
      ? Number(body.discountPercent)
      : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).discountPercent === 'number'
        ? (rawMetadata as any).discountPercent
        : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).discountPercent === 'string'
          ? Number((rawMetadata as any).discountPercent)
      : null;
  const expiresAt = typeof body?.expiresAt === 'string' ? body.expiresAt : null;
  const couponTitle = type === 'coupon' ? parseCouponTitle(body, rawMetadata) : null;
  const couponExpiresAt = type === 'coupon' ? parseExpiresAt(body, rawMetadata) : expiresAt;
  const isCouponMetadataObject = typeof rawMetadata === 'object' && rawMetadata && !Array.isArray(rawMetadata);
  const reportReason = type === 'report' ? parseReportReason(body, rawMetadata) : null;
  const reportContextType = type === 'report'
    ? (typeof body?.contextType === 'string'
      ? body.contextType.trim().toLowerCase()
      : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).contextType === 'string'
        ? String((rawMetadata as any).contextType).trim().toLowerCase()
        : null)
    : null;
  const reportContextId = type === 'report'
    ? (typeof body?.contextId === 'string'
      ? body.contextId.trim()
      : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).contextId === 'string'
        ? String((rawMetadata as any).contextId).trim()
        : null)
    : null;
  const reportContextUrl = type === 'report'
    ? (typeof body?.contextUrl === 'string'
      ? body.contextUrl.trim()
      : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).contextUrl === 'string'
        ? String((rawMetadata as any).contextUrl).trim()
        : null)
    : null;
  const reportNotes = type === 'report'
    ? (typeof body?.notes === 'string'
      ? body.notes.trim()
      : typeof rawMetadata === 'object' && rawMetadata && typeof (rawMetadata as any).notes === 'string'
        ? String((rawMetadata as any).notes).trim()
        : null)
    : null;

  if (type === 'coupon' && (discountPercent === null || Number.isNaN(discountPercent))) {
    throw new Error('discountPercent is required for coupon events');
  }

  if (type === 'report' && !reportReason) {
    throw new Error('reason is required for report events');
  }

  if (type === 'coupon' && targetUserIds.length === 0) {
    throw new Error('At least one target userId is required for coupon events');
  }

  if (type === 'coupon') {
    if (!isCouponAppliedStatus(status)) {
      throw new Error('Invalid coupon status');
    }
  }

  const metadata = serializeMetadata(rawMetadata);
  const permissionsFor = (targetUserId: string) => [Permission.read(Role.user(targetUserId))];

  const rows = [];
  for (const targetUserId of targetUserIds) {
    const syncResult = await syncProfileForEvent(databases, type, targetUserId, body).catch((error) => {
      if (type === 'username_change' || type === 'profile_sync') {
        throw error;
      }
      return { synced: false, before: null, after: null };
    });

    const eventMetadata: Record<string, unknown> = {
      ...(typeof rawMetadata === 'object' && rawMetadata ? rawMetadata : {}),
    };

    if (type === 'report') {
      delete eventMetadata.delta;
      delete eventMetadata.discountPercent;
      eventMetadata.report = {
        reporterId: actorId,
        targetUserId,
        reason: reportReason,
        contextType: reportContextType,
        contextId: reportContextId,
        contextUrl: reportContextUrl,
        notes: reportNotes,
        reviewState: 'unverified',
      };
    }

    if (syncResult.synced) {
      eventMetadata.syncStatus = 'applied';
    } else if (SELF_SYNC_TYPES.has(type)) {
      eventMetadata.syncStatus = 'pending';
    }

    if (syncResult.before || syncResult.after) {
      (eventMetadata as any).profileBefore = syncResult.before ? {
        userId: syncResult.before.userId,
        username: syncResult.before.username,
        displayName: syncResult.before.displayName,
        avatar: syncResult.before.avatar,
        publicKey: syncResult.before.publicKey,
        walletAddress: syncResult.before.walletAddress,
      } : null;
      (eventMetadata as any).profileAfter = syncResult.after ? {
        userId: syncResult.after.userId,
        username: syncResult.after.username,
        displayName: syncResult.after.displayName,
        avatar: syncResult.after.avatar,
        publicKey: syncResult.after.publicKey,
        walletAddress: syncResult.after.walletAddress,
      } : null;
    }

    const payload: Record<string, unknown> = {
      userId: targetUserId,
      type,
      actorId,
      relatedUserId: type === 'report' ? targetUserId : relatedUserId,
      status: type === 'report' ? 'pending' : status,
      delta: type === 'report' ? null : (delta === null || Number.isNaN(delta) ? null : delta),
      discountPercent: type === 'report' ? null : (discountPercent === null || Number.isNaN(discountPercent) ? null : discountPercent),
      expiresAt: couponExpiresAt,
      metadata: isCouponMetadataObject
        ? JSON.stringify({
            ...eventMetadata,
            coupon: {
              title: couponTitle,
              discountPercent: discountPercent === null || Number.isNaN(discountPercent) ? null : discountPercent,
              targetUserId,
              createdBy: actorId,
            },
          })
        : Object.keys(eventMetadata).length > 0 ? JSON.stringify(eventMetadata) : metadata,
    };

    const row = await databases.createDocument(
      CHAT_DB_ID,
      EVENTS_TABLE_ID,
      `evt-${Date.now()}-${targetUserId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`,
      payload,
      permissionsFor(targetUserId),
    );

    rows.push(row);
  }

  return rows;
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const type = normalizeType(body?.type);
    if (!type) {
      return NextResponse.json({ error: 'Invalid or missing type' }, { status: 400, headers: corsHeaders });
    }

    if (ADMIN_ONLY_TYPES.has(type) && !isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    if (SELF_SYNC_TYPES.has(type) && !isAdminUser(user)) {
      const requestedUserId = String(body?.userId || user.$id);
      if (requestedUserId !== user.$id) {
        return NextResponse.json({ error: 'Forbidden: you can only sync your own profile' }, { status: 403, headers: corsHeaders });
      }
    }

    if (type === 'report' && !body?.userId && !Array.isArray(body?.userIds)) {
      return NextResponse.json({ error: 'userId is required for reports' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const targetUserIds = SELF_SYNC_TYPES.has(type)
      ? normalizeUserIds(body, user.$id)
      : normalizeUserIds(body, '');

    if ((type === 'coupon' || type === 'referral' || type === 'verification' || type === 'reputation' || type === 'report') && targetUserIds.length === 0) {
      return NextResponse.json({ error: 'At least one target userId is required' }, { status: 400, headers: corsHeaders });
    }

    const rows = await createEventRows(databases, user.$id, type, targetUserIds, body);

    return NextResponse.json(
      {
        success: true,
        type,
        count: rows.length,
        rows,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to create event rows';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Account Events API] Error:', error);
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

    const body = await req.json();
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const patch: Record<string, unknown> = {};

    if (body.status !== undefined) patch.status = String(body.status).trim().toLowerCase();
    if (body.delta !== undefined) patch.delta = Number(body.delta);
    if (body.discountPercent !== undefined) patch.discountPercent = Number(body.discountPercent);
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt || null;
    if (body.metadata !== undefined) patch.metadata = serializeMetadata(body.metadata);
    if (body.relatedUserId !== undefined) patch.relatedUserId = body.relatedUserId || null;

    const updated = await databases.updateDocument(CHAT_DB_ID, EVENTS_TABLE_ID, eventId, patch);

    return NextResponse.json(
      {
        success: true,
        eventId,
        row: updated,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to update event row';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Account Events API] Patch error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
