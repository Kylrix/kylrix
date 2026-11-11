import { Permission, Query, Role } from '@/lib/data';
import { systemTables } from '@/lib/data';
import { APPWRITE_CONFIG } from '@/lib/data';
import { ledgerMeetsFeature } from '@/lib/config/pricing-plans';
import { getVerifiedProEntitlementForUser } from '@/lib/services/internal/subscription-entitlement';
import { BillingUiTier } from '@/lib/subscription/tier-resolution';

const DB = APPWRITE_CONFIG.DATABASES.FLOW;
const PAT_RATE = 'pat_rate_state';
const USER_RATE = 'api_user_rate_state';

export type ApiRateLimits = {
  tier: BillingUiTier;
  perMinute: number;
  perDay: number;
  remainingMinute: number;
  remainingDay: number;
  resetMinuteEpoch: number;
  resetDayEpoch: number;
};

export const TIER_RATE_LIMITS = {
  FREE: {
    windowMs: 60_000,
    maxRequests: 60,            // 60 req/min
    dailyToolInvocations: 1_000,
  },
  PRO: {
    windowMs: 60_000,
    maxRequests: 600,           // 600 req/min (10x Free)
    dailyToolInvocations: 50_000,
  },
  TEAMS: {
    windowMs: 60_000,
    maxRequests: 3_000,         // 3,000 req/min (50x Free)
    dailyToolInvocations: 500_000,
  },
} as const;

export async function resolveApiRateLimits(userId: string): Promise<{ tier: BillingUiTier; perMinute: number; perDay: number }> {
  try {
    const entitlement = await getVerifiedProEntitlementForUser(userId);
    const tier = entitlement.uiTier;
    if (tier === 'TEAMS' || ledgerMeetsFeature(tier, 'api_limits')) {
      return {
        tier,
        perMinute: TIER_RATE_LIMITS.TEAMS.maxRequests,
        perDay: TIER_RATE_LIMITS.TEAMS.dailyToolInvocations,
      };
    }
    if (tier === 'PRO' || tier === 'CONTRIBUTOR' || tier === 'LIFETIME' || tier === 'ORG' || ledgerMeetsFeature(tier, 'ai') || ledgerMeetsFeature(tier, 'sharing')) {
      return {
        tier,
        perMinute: TIER_RATE_LIMITS.PRO.maxRequests,
        perDay: TIER_RATE_LIMITS.PRO.dailyToolInvocations,
      };
    }
  } catch {}
  return {
    tier: 'FREE',
    perMinute: TIER_RATE_LIMITS.FREE.maxRequests,
    perDay: TIER_RATE_LIMITS.FREE.dailyToolInvocations,
  };
}

function minuteKey(d = new Date()) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function dayKey(d = new Date()) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

class RateLimitError extends Error {
  status = 429;
  code = 'rate_limit_exceeded';
  type: 'per_minute' | 'per_day';
  resetAt: number;
  retryAfterSec: number;
  tier?: BillingUiTier;

  constructor(message: string, type: 'per_minute' | 'per_day', resetAt: number, tier: BillingUiTier = 'FREE') {
    super(message);
    this.type = type;
    this.resetAt = resetAt;
    this.retryAfterSec = Math.max(1, Math.ceil(resetAt - Date.now() / 1000));
    this.tier = tier;
  }
}

async function bumpCounter(opts: {
  tableId: string;
  rowId: string;
  column: 'minuteCount' | 'hourCount';
  max: number;
  type: 'per_minute' | 'per_day';
  resetAt: number;
  tier?: BillingUiTier;
}) {
  const tables = systemTables();
  try {
    await tables.incrementRowColumn({
      databaseId: DB,
      tableId: opts.tableId,
      rowId: opts.rowId,
      column: opts.column,
      value: 1,
      max: opts.max,
    } as any);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (/max|maximum|limit/i.test(msg) || err?.code === 400) {
      const timeframe = opts.type === 'per_minute' ? '1-minute' : '24-hour';
      throw new RateLimitError(`You have exceeded your rolling ${timeframe} limit of ${opts.max} requests.`, opts.type, opts.resetAt, opts.tier || 'FREE');
    }
    throw err;
  }
}

async function ensurePatRateRow(patId: string, userId: string) {
  const tables = systemTables();
  const existing = await tables.listRows({
    databaseId: DB,
    tableId: PAT_RATE,
    queries: [Query.equal('patId', patId), Query.limit(1)],
  });
  if (existing.rows[0]) return existing.rows[0] as any;

  const now = new Date();
  try {
    return await tables.createRow({
      databaseId: DB,
      tableId: PAT_RATE,
      rowId: patId,
      data: {
        patId,
        userId,
        minuteKey: minuteKey(now),
        minuteCount: 0,
        hourKey: dayKey(now),
        hourCount: 0,
        updatedAt: now.toISOString(),
      },
      permissions: [
        Permission.read(Role.user(userId)),
      ],
    });
  } catch {
    const again = await tables.listRows({
      databaseId: DB,
      tableId: PAT_RATE,
      queries: [Query.equal('patId', patId), Query.limit(1)],
    });
    return again.rows[0] as any;
  }
}

async function ensureUserRateRow(userId: string) {
  const tables = systemTables();
  const existing = await tables.listRows({
    databaseId: DB,
    tableId: USER_RATE,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });
  if (existing.rows[0]) return existing.rows[0] as any;

  const now = new Date();
  try {
    return await tables.createRow({
      databaseId: DB,
      tableId: USER_RATE,
      rowId: userId,
      data: {
        userId,
        minuteKey: minuteKey(now),
        minuteCount: 0,
        hourKey: dayKey(now),
        hourCount: 0,
        updatedAt: now.toISOString(),
      },
      permissions: [
        Permission.read(Role.user(userId)),
      ],
    });
  } catch {
    const again = await tables.listRows({
      databaseId: DB,
      tableId: USER_RATE,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    });
    return again.rows[0] as any;
  }
}

async function rollAndBump(opts: {
  tableId: string;
  row: any;
  limits: { tier: BillingUiTier; perMinute: number; perDay: number };
}): Promise<{ remainingMinute: number; remainingDay: number; resetMinuteEpoch: number; resetDayEpoch: number }> {
  const tables = systemTables();
  const now = new Date();
  const mKey = minuteKey(now);
  const dKey = dayKey(now);
  const rowId = opts.row.$id;

  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  let needPatch = false;

  let currentMinCount = typeof opts.row.minuteCount === 'number' ? opts.row.minuteCount : 0;
  let currentDayCount = typeof opts.row.hourCount === 'number' ? opts.row.hourCount : 0;

  if (opts.row.minuteKey !== mKey) {
    patch.minuteKey = mKey;
    patch.minuteCount = 0;
    currentMinCount = 0;
    needPatch = true;
  }
  if (opts.row.hourKey !== dKey) {
    patch.hourKey = dKey;
    patch.hourCount = 0;
    currentDayCount = 0;
    needPatch = true;
  }

  if (needPatch) {
    await tables.updateRow({
      databaseId: DB,
      tableId: opts.tableId,
      rowId,
      data: patch,
    });
  }

  const resetMinuteEpoch = Math.floor((Math.floor(now.getTime() / 60000) * 60000 + 60000) / 1000);
  const resetDayEpoch = Math.floor((Math.floor(now.getTime() / 86400000) * 86400000 + 86400000) / 1000);

  await bumpCounter({
    tableId: opts.tableId,
    rowId,
    column: 'minuteCount',
    max: opts.limits.perMinute,
    type: 'per_minute',
    resetAt: resetMinuteEpoch,
    tier: opts.limits.tier,
  });
  await bumpCounter({
    tableId: opts.tableId,
    rowId,
    column: 'hourCount',
    max: opts.limits.perDay,
    type: 'per_day',
    resetAt: resetDayEpoch,
    tier: opts.limits.tier,
  });

  return {
    remainingMinute: Math.max(0, opts.limits.perMinute - (currentMinCount + 1)),
    remainingDay: Math.max(0, opts.limits.perDay - (currentDayCount + 1)),
    resetMinuteEpoch,
    resetDayEpoch,
  };
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function checkMemoryBurst(key: string, limit: number, tier: BillingUiTier = 'FREE'): { count: number; resetAt: number } {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    const next = { count: 1, resetAt: now + 60_000 };
    memoryBuckets.set(key, next);
    return next;
  }
  existing.count += 1;
  if (existing.count > limit) {
    const resetEpoch = Math.ceil(existing.resetAt / 1000);
    throw new RateLimitError(
      `You have exceeded your rolling 1-minute limit of ${limit} requests.`,
      'per_minute',
      resetEpoch,
      tier
    );
  }
  return existing;
}

/**
 * Enforce PAT + account rate limits with 1–2 row reads and atomic increments.
 */
export async function enforceApiRateLimits(params: {
  userId: string;
  patId: string;
}): Promise<{ limits: ApiRateLimits }> {
  const baseLimits = await resolveApiRateLimits(params.userId);

  // Fast in-memory shield: reject burst traffic without hitting the database cluster
  checkMemoryBurst(`pat:${params.patId}`, baseLimits.perMinute, baseLimits.tier);
  checkMemoryBurst(`user:${params.userId}`, baseLimits.perMinute, baseLimits.tier);

  const patRow = await ensurePatRateRow(params.patId, params.userId);
  const patStats = await rollAndBump({ tableId: PAT_RATE, row: patRow, limits: baseLimits });

  const userRow = await ensureUserRateRow(params.userId);
  const userStats = await rollAndBump({ tableId: USER_RATE, row: userRow, limits: baseLimits });

  return {
    limits: {
      tier: baseLimits.tier,
      perMinute: baseLimits.perMinute,
      perDay: baseLimits.perDay,
      remainingMinute: Math.min(patStats.remainingMinute, userStats.remainingMinute),
      remainingDay: Math.min(patStats.remainingDay, userStats.remainingDay),
      resetMinuteEpoch: patStats.resetMinuteEpoch,
      resetDayEpoch: patStats.resetDayEpoch,
    },
  };
}

export { RateLimitError };
