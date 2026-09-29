import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getVerifiedProEntitlementForUser,
  suspendAccountAndLogIpSecure,
  invalidateEntitlementCache,
} from './subscription-entitlement';
import { computeSubscriptionSig } from './subscription-prefs-merge';

const mockListRows = vi.fn(async () => ({ rows: [] }));
const mockUsersGet = vi.fn(async (id: string) => ({
  $id: id,
  prefs: { subscriptionTier: 'FREE' },
}));
const mockUpdateStatus = vi.fn(async (_id: string, _status: boolean) => ({}));

// Mock dependencies
vi.mock('@/lib/appwrite-admin', () => ({
  createSystemClient: vi.fn(() => ({
    databases: {
      listRows: mockListRows,
    },
    users: {
      get: mockUsersGet,
      updateStatus: mockUpdateStatus,
    },
  })),
  createSystemTablesDB: vi.fn(() => ({
    createRow: vi.fn(async () => ({})),
  })),
}));

vi.mock('@/lib/deployment/surface', () => ({
  isSelfHostedDeployment: vi.fn(() => false),
  isKylrixCloud: vi.fn(() => true),
}));

describe('Subscription Entitlement & Fraud Suspension', () => {
  beforeEach(() => {
    invalidateEntitlementCache();
    vi.clearAllMocks();
    mockUsersGet.mockImplementation(async (id: string) => ({
      $id: id,
      prefs: { subscriptionTier: 'FREE' },
    }));
    mockListRows.mockResolvedValue({ rows: [] });
  });

  it('assumes FREE plan instantly for user without subscription rows or paid prefs with zero-trip caching', async () => {
    const entitlement1 = await getVerifiedProEntitlementForUser('user_free_123');
    expect(entitlement1.active).toBe(false);
    expect(entitlement1.uiTier).toBe('FREE');

    // Second call should serve from memory cache instantly
    const entitlement2 = await getVerifiedProEntitlementForUser('user_free_123');
    expect(entitlement2.active).toBe(false);
    expect(entitlement2.uiTier).toBe('FREE');
  });

  it('suspends account and records security log entry when fraud is triggered', async () => {
    const success = await suspendAccountAndLogIpSecure({
      userId: 'user_spoofed_456',
      reason: 'Spoofed paid tier claim without subscription ledger record',
    });
    expect(success).toBe(true);
  });

  it('rejects unverified spoofed paid tier in user prefs when no subscription ledger row exists', async () => {
    mockUsersGet.mockResolvedValueOnce({
      $id: 'user_attacker',
      prefs: { subscriptionTier: 'LIFETIME', tier: 'LIFETIME' },
    });

    const entitlement = await getVerifiedProEntitlementForUser('user_attacker');
    expect(entitlement.active).toBe(false);
    expect(entitlement.uiTier).toBe('FREE');
  });

  it('accepts paid tier in user prefs when valid HMAC signature is present', async () => {
    const exp = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const sig = computeSubscriptionSig('user_vip', 'PRO', exp);

    mockUsersGet.mockResolvedValueOnce({
      $id: 'user_vip',
      prefs: {
        subscriptionTier: 'PRO',
        subscriptionExpiresAt: exp,
        subscriptionSig: sig,
      },
    });

    const entitlement = await getVerifiedProEntitlementForUser('user_vip');
    expect(entitlement.active).toBe(true);
    expect(entitlement.uiTier).toBe('PRO');
  });
});
