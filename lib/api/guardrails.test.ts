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
  });

  it('assertPaidActor succeeds for paid/pro-tier actors', async () => {
    const { assertPaidActor } = await import('./resources');
    await expect(assertPaidActor(proActor)).resolves.not.toThrow();
  });

  it('PaymentRequiredError has 402 status code', async () => {
    const { PaymentRequiredError } = await import('./resources');
    const err = new PaymentRequiredError('Custom message');
    expect(err.status).toBe(402);
    expect(err.code).toBe('payment_required');
    expect(err.message).toBe('Custom message');
  });
});
