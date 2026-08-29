import type { NextRequest } from 'next/server';

/**
 * In-process edge shield — first line of defense before Appwrite rate-state writes.
 * Per serverless instance; pairs with DB-backed PAT limits in rate-limits.ts.
 */

export type ShieldVerdict =
  | { allowed: true; remaining?: number }
  | { allowed: false; retryAfterSec: number; reason: 'burst' | 'quota' | 'blocked'; tier: string };

type Bucket = {
  hits: number[];
  blockedUntil?: number;
};

const buckets = new Map<string, Bucket>();

const SHIELD_PRESETS = {
  /** Coarse IP ceiling for all /api/v1 traffic (middleware + guard). */
  apiIp: {
    windowMs: 60_000,
    max: 180,
    burstWindowMs: 5_000,
    burstMax: 55,
    blockMs: 90_000,
  },
  /** Unauthenticated API probes (missing/invalid bearer). */
  apiAnon: {
    windowMs: 60_000,
    max: 40,
    burstWindowMs: 5_000,
    burstMax: 15,
    blockMs: 120_000,
  },
  /** MCP handshake methods without auth (initialize, tools/list, ping). */
  mcpPublic: {
    windowMs: 60_000,
    max: 45,
    burstWindowMs: 5_000,
    burstMax: 22,
    blockMs: 120_000,
  },
  /** Short burst before DB incrementRowColumn (per PAT / user bucket). */
  patBurst: {
    windowMs: 5_000,
    max: 28,
    burstWindowMs: 1_000,
    burstMax: 12,
    blockMs: 45_000,
  },
  /** SSE session opens per IP. */
  mcpSseOpen: {
    windowMs: 60_000,
    max: 12,
    burstWindowMs: 10_000,
    burstMax: 6,
    blockMs: 180_000,
  },
} as const;

function pruneHits(hits: number[], windowMs: number, now: number) {
  return hits.filter((t) => now - t < windowMs);
}

function checkShield(
  key: string,
  preset: (typeof SHIELD_PRESETS)[keyof typeof SHIELD_PRESETS],
): ShieldVerdict {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
      reason: 'blocked',
      tier: key,
    };
  }
  if (bucket.blockedUntil && now >= bucket.blockedUntil) {
    bucket.blockedUntil = undefined;
    bucket.hits = [];
  }

  bucket.hits.push(now);
  bucket.hits = pruneHits(bucket.hits, preset.windowMs, now);

  if (preset.burstWindowMs && preset.burstMax) {
    const burstCount = bucket.hits.filter((t) => now - t < preset.burstWindowMs).length;
    if (burstCount > preset.burstMax) {
      bucket.blockedUntil = now + preset.blockMs;
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil(preset.blockMs / 1000)),
        reason: 'burst',
        tier: key,
      };
    }
  }

  if (bucket.hits.length > preset.max) {
    bucket.blockedUntil = now + preset.blockMs;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(preset.blockMs / 1000)),
      reason: 'quota',
      tier: key,
    };
  }

  return { allowed: true, remaining: preset.max - bucket.hits.length };
}

export function getClientIp(req: NextRequest | Request): string {
  const forwarded =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-vercel-forwarded-for') ||
    req.headers.get('cf-connecting-ip');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

export function enforceApiIpShield(req: NextRequest | Request): ShieldVerdict {
  const ip = getClientIp(req);
  return checkShield(`api_ip:${ip}`, SHIELD_PRESETS.apiIp);
}

export function enforceApiAnonShield(req: NextRequest | Request): ShieldVerdict {
  const ip = getClientIp(req);
  return checkShield(`api_anon:${ip}`, SHIELD_PRESETS.apiAnon);
}

export function enforceMcpPublicShield(req: NextRequest | Request): ShieldVerdict {
  const ip = getClientIp(req);
  return checkShield(`mcp_pub:${ip}`, SHIELD_PRESETS.mcpPublic);
}

export function enforcePatBurstShield(patKey: string): ShieldVerdict {
  const safe = String(patKey || 'unknown').slice(0, 64);
  return checkShield(`pat_burst:${safe}`, SHIELD_PRESETS.patBurst);
}

export function enforceMcpSseOpenShield(req: NextRequest | Request): ShieldVerdict {
  const ip = getClientIp(req);
  return checkShield(`mcp_sse:${ip}`, SHIELD_PRESETS.mcpSseOpen);
}

export class EdgeShieldError extends Error {
  status = 429;
  code = 'edge_rate_limited';
  retryAfterSec: number;
  reason: 'burst' | 'quota' | 'blocked';
  tier: string;

  constructor(verdict: Extract<ShieldVerdict, { allowed: false }>) {
    super('Too many requests. Slow down and retry shortly.');
    this.retryAfterSec = verdict.retryAfterSec;
    this.reason = verdict.reason;
    this.tier = verdict.tier;
  }
}

export function assertShieldAllowed(verdict: ShieldVerdict): void {
  if (!verdict.allowed) {
    throw new EdgeShieldError(verdict);
  }
}

/** Periodic cleanup — server-only. */
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      const stale =
        (!bucket.blockedUntil || now > bucket.blockedUntil) &&
        bucket.hits.every((t) => now - t > 120_000);
      if (stale) buckets.delete(key);
    }
  }, 300_000);
}
