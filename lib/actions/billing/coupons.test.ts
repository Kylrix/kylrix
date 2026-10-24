import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimCouponAction, createBillingCheckoutSessionAction } from './billing';

const mockUser = {
  $id: 'usr_coupon_test_123',
  id: 'usr_coupon_test_123',
  email: 'test@kylrix.com',
  name: 'Test Coupon User',
};

const mockTursoCoupon = {
  id: 'cpn_test_123',
  createdBy: 'usr_admin',
  title: 'Test Pro Pass',
  note: 'Enjoy Pro',
  targetUserId: null,
  status: 'active',
  discountPercent: 100,
  discountPercentage: 100,
  redemptionLimit: 1,
  redemptionCount: 0,
  expiresAt: null,
  metadata: JSON.stringify({ planId: 'PRO_MONTH', months: 1 }),
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('@/lib/services/internal/billing', () => ({
  getAuthenticatedUserForBillingAction: vi.fn(async () => mockUser),
}));

vi.mock('@/lib/actions/turso-ops', () => ({
  getCouponTurso: vi.fn(async (id: string) => {
    if (id === mockTursoCoupon.id) {
      return { success: true, row: mockTursoCoupon };
    }
    return { success: false, row: null };
  }),
  listCouponsTurso: vi.fn(async () => ({ success: true, rows: [mockTursoCoupon] })),
  upsertCouponTurso: vi.fn(async () => ({ success: true })),
  upsertSubscriptionTurso: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/data', () => ({
  createSystemClient: vi.fn(() => ({
    databases: {
      getRow: vi.fn(async () => null),
      listRows: vi.fn(async () => ({ rows: [], total: 0 })),
      createRow: vi.fn(async (_db: string, table: string, id: string, data: any) => ({
        $id: id,
        ...data,
      })),
      updateRow: vi.fn(async () => ({})),
    },
    users: {
      getPrefs: vi.fn(async () => ({})),
      updatePrefs: vi.fn(async () => ({})),
    },
  })),
  APPWRITE_CONFIG: {
    DATABASES: { NOTE: 'passwordManagerDb', CHAT: 'passwordManagerDb' },
    TABLES: {
      NOTE: { SUBSCRIPTIONS: 'subscriptions', COUPONS: 'coupons' },
      CHAT: { ACCOUNT_EVENTS: 'account_events', PROFILES: 'profiles' },
    },
  },
  ID: {
    unique: () => 'sub_unique_123',
  },
  Permission: {
    read: () => 'read',
  },
  Role: {
    user: (id?: string) => `user:${id}`,
  },
}));

vi.mock('@/lib/entitlements', () => ({
  isBillingCommerceEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/services/internal/subscription-entitlement', () => ({
  getVerifiedProEntitlementForUser: vi.fn(async () => ({
    active: true,
    expiresAt: '2026-01-01T00:00:00.000Z',
    source: 'subscription',
    uiTier: 'PRO',
  })),
}));

vi.mock('@/lib/billing/subscription-notifications', () => ({
  notifySubscriptionActivated: vi.fn(async () => ({})),
}));

describe('Coupon Claim & Checkout with Turso backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates a newly created Turso-backed coupon in checkOnly mode', async () => {
    const res = await claimCouponAction('cpn_test_123', undefined, true);
    expect(res).toEqual(
      expect.objectContaining({
        ok: true,
        claimed: false,
        couponId: 'cpn_test_123',
        discountPercent: 100,
        planId: 'PRO_MONTH',
        requiresPayment: false,
      })
    );
  });

  it('successfully claims a newly created Turso-backed 100% free coupon', async () => {
    const res = await claimCouponAction('cpn_test_123', undefined, false);
    expect(res).toEqual(
      expect.objectContaining({
        ok: true,
        claimed: true,
        couponId: 'cpn_test_123',
        subscriptionId: expect.any(String),
      })
    );
  });

  it('successfully creates checkout session with 0 adjusted amount for 100% free coupon in createBillingCheckoutSessionAction', async () => {
    const session = await createBillingCheckoutSessionAction({
      planId: 'PRO_MONTH',
      method: 'CRYPTO',
      couponId: 'cpn_test_123',
    });
    expect(session).toEqual(
      expect.objectContaining({
        couponApplied: true,
        provider: 'COUPON',
      })
    );
  });
});
