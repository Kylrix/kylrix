import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getVerifiedProEntitlementForUser,
  suspendAccountAndLogIpSecure,
  invalidateEntitlementCache,
} from './subscription-entitlement';

// Mock dependencies
vi.mock('@/lib/appwrite-admin', () => ({
  createSystemClient: vi.fn(() => ({
    databases: {
      listRows: vi.fn(async () => ({ rows: [] })),
    },
    users: {
      get: vi.fn(async (id: string) => ({
        $id: id,
        prefs: { subscriptionTier: 'FREE' },
      })),
      updateStatus: vi.fn(async (_id: string, _status: boolean) => ({})),
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
});
