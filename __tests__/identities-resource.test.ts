import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

let mockAccounts: any[] = [];
let mockResolvedUserIds: string[] = [];

vi.mock('@/lib/actions/turso-ops', () => ({
  resolveAllUserIds: vi.fn(async (userId: string) => mockResolvedUserIds.length ? mockResolvedUserIds : [userId]),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => mockAccounts),
      })),
    })),
  },
}));

describe('ApiResources.listIdentities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccounts = [];
    mockResolvedUserIds = [];
  });

  it('resolves connected identities excluding appwrite and lowecasing provider', async () => {
    const actor: ApiActor = {
      userId: 'user_primary_1',
      kind: 'pat',
      scopes: ['profile:read'],
      isAgent: false,
    };

    mockResolvedUserIds = ['user_primary_1', 'user_linked_2'];
    mockAccounts = [
      {
        id: 'acc_1',
        providerId: 'GitHub',
        accountId: '12345',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'acc_2',
        providerId: 'google',
        accountId: 'google_sub_67890',
        createdAt: new Date('2024-01-02'),
      },
      {
        id: 'acc_3',
        providerId: 'appwrite',
        accountId: 'appwrite_legacy_id',
        createdAt: new Date('2024-01-03'),
      },
    ];

    const result = await ApiResources.listIdentities(actor);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        id: 'acc_1',
        provider: 'github',
        accountId: '12345',
        connected: true,
        createdAt: mockAccounts[0].createdAt,
      },
      {
        id: 'acc_2',
        provider: 'google',
        accountId: 'google_sub_67890',
        connected: true,
        createdAt: mockAccounts[1].createdAt,
      },
    ]);
  });
});
