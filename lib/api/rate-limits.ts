import { Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
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

/**
 * Tier limits:
 * - Free: 10 req / min, 100 req / day
 * - Pro: 50 req / min, 500 req / day
 * - Teams (or Org/Lifetime): 100 req / min, 1,000 req / day
 */
export async function resolveApiRateLimits(userId: string): Promise<{ tier: BillingUiTier; perMinute: number; perDay: number }> {
  try {
    const entitlement = await getVerifiedProEntitlementForUser(userId);
    const tier = entitlement.uiTier;
    if (tier === 'TEAMS' || tier === 'ORG' || tier === 'LIFETIME') {
      return { tier, perMinute: 100, perDay: 1000 };
    }
    if (tier === 'PRO') {
      return { tier, perMinute: 50, perDay: 500 };
    }
  } catch {}
  return { tier: 'FREE', perMinute: 10, perDay: 100 };
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

  constructor(message: string, type: 'per_minute' | 'per_day', resetAt: number) {
    super(message);
    this.type = type;
    this.resetAt = resetAt;
    this.retryAfterSec = Math.max(1, Math.ceil(resetAt - Date.now() / 1000));
  }
}

async function bumpCounter(opts: {
  tableId: string;
  rowId: string;
  column: 'minuteCount' | 'hourCount';
  max: number;
  type: 'per_minute' | 'per_day';
  resetAt: number;
}) {
  const tables = createSystemTablesDB();
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
      throw new RateLimitError(`You have exceeded your rolling ${timeframe} limit of ${opts.max} requests.`, opts.type, opts.resetAt);
    }
    throw err;
  }
}

async function ensurePatRateRow(patId: string, userId: string) {
  const tables = createSystemTablesDB();
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
  const tables = createSystemTablesDB();
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
  const tables = createSystemTablesDB();
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
  });
  await bumpCounter({
    tableId: opts.tableId,
    rowId,
    column: 'hourCount',
    max: opts.limits.perDay,
    type: 'per_day',
    resetAt: resetDayEpoch,
  });

  return {
    remainingMinute: Math.max(0, opts.limits.perMinute - (currentMinCount + 1)),
    remainingDay: Math.max(0, opts.limits.perDay - (currentDayCount + 1)),
    resetMinuteEpoch,
    resetDayEpoch,
  };
}

/**
 * Enforce PAT + account rate limits with 1–2 row reads and atomic increments.
 */
export async function enforceApiRateLimits(params: {
  userId: string;
  patId: string;
}): Promise<{ limits: ApiRateLimits }> {
  const baseLimits = await resolveApiRateLimits(params.userId);
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
