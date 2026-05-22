import { ID, Query } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const VIEWS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.ENGAGEMENT_VIEWS;
const ROLLUPS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.ENGAGEMENT_VIEW_ROLLUPS;

type ViewerKind = 'user' | 'anon';

export interface TrackEngagementInput {
  appId: string;
  contentType: string;
  contentId: string;
  ownerUserId?: string | null;
  viewerKind: ViewerKind;
  viewerUserId?: string | null;
  viewerTokenHash?: string | null;
  fingerprint?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  receiptType?: 'seen' | 'delivered' | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

const safe = (value: unknown) => String(value || '').trim();
const nowIso = () => new Date().toISOString();

const hashWithSalt = (value: string) => {
  const salt = safe(process.env.VIEWER_HASH_SALT) || APPWRITE_CONFIG.PROJECT_ID;
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
};

const normalizeDay = (iso: string) => iso.slice(0, 10);
const normalizeMonth = (iso: string) => iso.slice(0, 7);

async function findEventByIdempotency(idempotencyKey: string) {
  const { databases } = createSystemClient();
  const result = await databases.listDocuments(DB_ID, VIEWS_TABLE, [
    Query.equal('idempotencyKey', idempotencyKey),
    Query.limit(1)]);
  return result.documents[0] || null;
}

async function upsertRollup(input: {
  rollupKey: string;
  metricType: string;
  appId: string;
  scopeType: string;
  scopeId: string;
  contentType?: string | null;
  contentId?: string | null;
  ownerUserId?: string | null;
  bucketDay: string;
  bucketMonth: string;
  incrementUnique: number;
  incrementTotal: number;
  incrementReceipts: number;
  trustDelta: number;
}) {
  const { databases } = createSystemClient();
  const currentTs = nowIso();
  const createPayload = {
    rowType: 'rollup',
    rollupKey: input.rollupKey,
    metricType: input.metricType,
    appId: input.appId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    contentType: input.contentType || null,
    contentId: input.contentId || null,
    ownerUserId: input.ownerUserId || null,
    bucketDay: input.bucketDay,
    bucketMonth: input.bucketMonth,
    uniqueViewCount: Math.max(0, input.incrementUnique),
    totalViewCount: Math.max(0, input.incrementTotal),
    receiptCount: Math.max(0, input.incrementReceipts),
    weightedScore: Math.max(0, input.incrementUnique + input.incrementTotal),
    trustScore: Math.max(0, input.trustDelta),
    lastEventAt: currentTs,
    updatedAt: currentTs,
    metadata: null,
  };

  try {
    await databases.createDocument(DB_ID, ROLLUPS_TABLE, ID.unique(), createPayload);
    return;
  } catch (error: any) {
    if (Number(error?.code || 0) !== 409) {
      throw error;
    }
  }

  const existingResult = await databases.listDocuments(DB_ID, ROLLUPS_TABLE, [
    Query.equal('rollupKey', input.rollupKey),
    Query.limit(1)]);
  const existing = existingResult.documents[0] as any;
  if (!existing) return;

  await databases.updateDocument(DB_ID, ROLLUPS_TABLE, existing.$id, {
    uniqueViewCount: Number(existing.uniqueViewCount || 0) + Math.max(0, input.incrementUnique),
    totalViewCount: Number(existing.totalViewCount || 0) + Math.max(0, input.incrementTotal),
    receiptCount: Number(existing.receiptCount || 0) + Math.max(0, input.incrementReceipts),
    weightedScore: Number(existing.weightedScore || 0) + Math.max(0, input.incrementUnique + input.incrementTotal),
    trustScore: Number(existing.trustScore || 0) + Math.max(0, input.trustDelta),
    lastEventAt: currentTs,
    updatedAt: currentTs,
  });
}

export async function trackEngagementView(input: TrackEngagementInput) {
  const appId = safe(input.appId);
  const contentType = safe(input.contentType);
  const contentId = safe(input.contentId);
  if (!appId || !contentType || !contentId) {
    throw new Error('INVALID_ENGAGEMENT_INPUT');
  }

  const occurredAt = safe(input.occurredAt) || nowIso();
  const bucketDay = normalizeDay(occurredAt);
  const bucketMonth = normalizeMonth(occurredAt);
  const viewerKind = input.viewerKind;

  const viewerTokenHash = safe(input.viewerTokenHash);
  const viewerUserId = safe(input.viewerUserId);
  const ownerUserId = safe(input.ownerUserId);
  const conversationId = safe(input.conversationId);
  const messageId = safe(input.messageId);
  const receiptType = safe(input.receiptType);
  const trustDelta = viewerKind === 'user' ? 3 : 1;

  const dedupeIdentity =
    viewerKind === 'user'
      ? `user:${viewerUserId}`
      : `anon:${viewerTokenHash || hashWithSalt(`${safe(input.ip)}:${safe(input.userAgent)}:${bucketDay}`)}`;

  const idempotencyKey = `v:${appId}:${contentType}:${contentId}:${receiptType || 'view'}:${dedupeIdentity}:${bucketDay}`;
  const existing = await findEventByIdempotency(idempotencyKey);
  if (existing) {
    return { accepted: true, deduped: true, event: existing };
  }

  const { databases } = createSystemClient();
  const eventId = createHash('sha256').update(idempotencyKey).digest('hex');
  const fingerprintHash = safe(input.fingerprint) ? hashWithSalt(safe(input.fingerprint)) : null;
  const ipHash = safe(input.ip) ? hashWithSalt(safe(input.ip)) : null;
  const uaHash = safe(input.userAgent) ? hashWithSalt(safe(input.userAgent)) : null;
  const isReceipt = Boolean(conversationId && messageId);

  const event = await databases.createDocument(DB_ID, VIEWS_TABLE, ID.unique(), {
    rowType: 'event',
    eventId,
    idempotencyKey,
    appId,
    contentType,
    contentId,
    ownerUserId: ownerUserId || null,
    viewerKind,
    viewerUserId: viewerUserId || null,
    viewerTokenHash: viewerTokenHash || null,
    fingerprintHash,
    ipHash,
    uaHash,
    conversationId: conversationId || null,
    messageId: messageId || null,
    receiptType: receiptType || null,
    isCounted: true,
    bucketDay,
    bucketMonth,
    occurredAt,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });

  const ownerScopeId = ownerUserId || 'unknown';
  await upsertRollup({
    rollupKey: `content:${contentType}:${contentId}:${bucketDay}`,
    metricType: 'content_daily',
    appId,
    scopeType: 'content',
    scopeId: `${contentType}:${contentId}`,
    contentType,
    contentId,
    ownerUserId: ownerUserId || null,
    bucketDay,
    bucketMonth,
    incrementUnique: 1,
    incrementTotal: 1,
    incrementReceipts: isReceipt ? 1 : 0,
    trustDelta,
  });

  await upsertRollup({
    rollupKey: `owner:${ownerScopeId}:${bucketMonth}`,
    metricType: 'owner_monthly',
    appId,
    scopeType: 'owner',
    scopeId: ownerScopeId,
    contentType,
    contentId,
    ownerUserId: ownerUserId || null,
    bucketDay,
    bucketMonth,
    incrementUnique: 1,
    incrementTotal: 1,
    incrementReceipts: isReceipt ? 1 : 0,
    trustDelta,
  });

  return { accepted: true, deduped: false, event };
}
