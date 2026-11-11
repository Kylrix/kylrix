import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiActor } from './guard';

vi.mock('../services/internal/subscription-entitlement', () => ({
  hasPaidKylrixPlanServer: vi.fn(async (userId: string) => userId !== 'free_user'),
  getVerifiedProEntitlementForUser: vi.fn(async (userId: string) => ({
    active: userId !== 'free_user',
    expiresAt: null,
    source: 'subscription_row',
    uiTier: userId === 'free_user' ? 'FREE' : 'PRO',
  })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}));

describe('Paid Guardrails & Public Pull Access Unit Tests', () => {
  const freeActor: ApiActor = {
    userId: 'free_user',
    kind: 'session',
    scopes: ['notes:write', 'notes:read'],
  };

  const proActor: ApiActor = {
    userId: 'pro_user',
    kind: 'session',
    scopes: ['notes:write', 'notes:read'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assertPaidActor throws PaymentRequiredError for free-tier actors', async () => {
    const { assertPaidActor, PaymentRequiredError } = await import('./resources');
    await expect(assertPaidActor(freeActor)).rejects.toThrow(PaymentRequiredError);
  }, 15000);

  it('assertPaidActor succeeds for paid/pro-tier actors', async () => {
    const { assertPaidActor } = await import('./resources');
    await expect(assertPaidActor(proActor)).resolves.not.toThrow();
  }, 15000);

  it('PaymentRequiredError has 402 status code', async () => {
    const { PaymentRequiredError } = await import('./resources');
    const err = new PaymentRequiredError('Custom message');
    expect(err.status).toBe(402);
    expect(err.code).toBe('payment_required');
    expect(err.message).toBe('Custom message');
  });

  it('resolves correct tiered rate limits for Free vs Pro vs Teams', async () => {
    const { resolveApiRateLimits, TIER_RATE_LIMITS } = await import('./rate-limits');
    const freeLimits = await resolveApiRateLimits('free_user');
    expect(freeLimits.tier).toBe('FREE');
    expect(freeLimits.perMinute).toBe(TIER_RATE_LIMITS.FREE.maxRequests);
    expect(freeLimits.perDay).toBe(TIER_RATE_LIMITS.FREE.dailyToolInvocations);

    const proLimits = await resolveApiRateLimits('pro_user');
    expect(proLimits.tier).toBe('PRO');
    expect(proLimits.perMinute).toBe(TIER_RATE_LIMITS.PRO.maxRequests);
    expect(proLimits.perDay).toBe(TIER_RATE_LIMITS.PRO.dailyToolInvocations);
  });

  it('jsonErr formats 429 RateLimitError with X-RateLimit-Tier and upgrade link', async () => {
    const { jsonErr } = await import('./guard');
    const { RateLimitError } = await import('./rate-limits');
    const err = new RateLimitError('Rate limit exceeded', 'per_minute', 1234567890, 'FREE');
    const res = jsonErr(err);
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Tier')).toBe('FREE');
    const body = await res.json();
    expect(body.tier).toBe('FREE');
    expect(body.upgrade_url).toBe('https://www.kylrix.space/pricing');
  });
});
