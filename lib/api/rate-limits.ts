import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlanServer } from '@/lib/services/internal/subscription-entitlement';

const DB = APPWRITE_CONFIG.DATABASES.FLOW;
const PAT_RATE = 'pat_rate_state';
const USER_RATE = 'api_user_rate_state';

export type ApiRateLimits = {
  perMinute: number;
  perHour: number;
};

/** Free is intentionally tiny; Pro/Teams plenty. */
export async function resolveApiRateLimits(userId: string): Promise<ApiRateLimits> {
  const paid = await hasPaidKylrixPlanServer(userId).catch(() => false);
  if (paid) {
    return { perMinute: 120, perHour: 5000 };
  }
  return { perMinute: 20, perHour: 200 };
}

function minuteKey(d = new Date()) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function hourKey(d = new Date()) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}`;
}

class RateLimitError extends Error {
  status = 429;
  code = 'rate_limited';
  retryAfterSec: number;
  constructor(message: string, retryAfterSec = 60) {
    super(message);
    this.retryAfterSec = retryAfterSec;
  }
}

async function bumpCounter(opts: {
  tableId: string;
  rowId: string;
  column: 'minuteCount' | 'hourCount';
  max: number;
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
      throw new RateLimitError(`Rate limit exceeded (${opts.column})`, 60);
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
        hourKey: hourKey(now),
        hourCount: 0,
        updatedAt: now.toISOString(),
      },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
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
        hourKey: hourKey(now),
        hourCount: 0,
        updatedAt: now.toISOString(),
      },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
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
  limits: ApiRateLimits;
}) {
  const tables = createSystemTablesDB();
  const now = new Date();
  const mKey = minuteKey(now);
  const hKey = hourKey(now);
  const rowId = opts.row.$id;

  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  let needPatch = false;

  if (opts.row.minuteKey !== mKey) {
    patch.minuteKey = mKey;
    patch.minuteCount = 0;
    needPatch = true;
  }
  if (opts.row.hourKey !== hKey) {
    patch.hourKey = hKey;
    patch.hourCount = 0;
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

  await bumpCounter({
    tableId: opts.tableId,
    rowId,
    column: 'minuteCount',
    max: opts.limits.perMinute,
  });
  await bumpCounter({
    tableId: opts.tableId,
    rowId,
    column: 'hourCount',
    max: opts.limits.perHour,
  });
}

/**
 * Enforce PAT + account rate limits with 1–2 row reads and atomic increments.
 */
export async function enforceApiRateLimits(params: {
  userId: string;
  patId: string;
}): Promise<{ limits: ApiRateLimits }> {
  const limits = await resolveApiRateLimits(params.userId);
  const patRow = await ensurePatRateRow(params.patId, params.userId);
  await rollAndBump({ tableId: PAT_RATE, row: patRow, limits });

  const userRow = await ensureUserRateRow(params.userId);
  await rollAndBump({ tableId: USER_RATE, row: userRow, limits });

  return { limits };
}

export { RateLimitError };
