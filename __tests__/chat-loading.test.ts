import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConversationsAction } from '@/lib/actions/chat';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

vi.mock('@/lib/actions/secure-ops', () => ({
  getActor: vi.fn(),
}));

vi.mock('@/lib/actions/turso-ops', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    resolveAllUserIds: vi.fn(),
    listConversationsTurso: vi.fn(),
  };
});

describe('Chat Loading & Actor User ID Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversationsAction authorization bridging', () => {
    it('authorizes when validatedUserId matches a bridged actor ID', async () => {
      const { getActor } = await import('@/lib/actions/secure-ops');
      const { resolveAllUserIds, listConversationsTurso: mockList } = await import('@/lib/actions/turso-ops');

      const sessionUlid = '01JACTORULID1234567890ABCDEF';
      const legacyAccountId = '67ffb09c123456789abcdef0';

      (getActor as any).mockResolvedValue({
        $id: sessionUlid,
        email: 'test@example.com',
      });

      (resolveAllUserIds as any).mockResolvedValue([sessionUlid, legacyAccountId]);
      (mockList as any).mockResolvedValue({
        success: true,
        rows: [
          {
            id: 'conv-1',
            creatorId: legacyAccountId,
            participants: JSON.stringify([legacyAccountId]),
            lastMessageText: 'Hello world',
          },
        ],
      });

      const result = await getConversationsAction({
        userId: legacyAccountId,
      });

      expect(result).toBeDefined();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe('conv-1');
    });

    it('rejects with UNAUTHORIZED_CONVERSATIONS_LIST if validatedUserId is not among actorIds', async () => {
      const { getActor } = await import('@/lib/actions/secure-ops');
      const { resolveAllUserIds } = await import('@/lib/actions/turso-ops');

      const sessionUlid = '01JACTORULID1234567890ABCDEF';
      const unauthorizedId = 'unauthorized_user_999999999';

      (getActor as any).mockResolvedValue({
        $id: sessionUlid,
      });
      (resolveAllUserIds as any).mockResolvedValue([sessionUlid]);

      await expect(
        getConversationsAction({
          userId: unauthorizedId,
        }),
      ).rejects.toThrow('UNAUTHORIZED_CONVERSATIONS_LIST');
    });
  });

  describe('listConversationsTurso cross-ID resolution', () => {
    it('queries conversations across all resolved user IDs', async () => {
      const actualTursoOps = await vi.importActual<any>('@/lib/actions/turso-ops');
      const resolveSpy = vi.spyOn(actualTursoOps, 'resolveAllUserIds').mockResolvedValue(['session-id', 'legacy-id']);

      const mockConversationRows = [
        {
          id: 'conv-created',
          creatorId: 'legacy-id',
          participants: '["legacy-id", "peer-1"]',
          lastMessageAt: '2025-01-02T10:00:00Z',
          updatedAt: '2025-01-02T10:00:00Z',
        },
        {
          id: 'conv-member',
          creatorId: 'peer-2',
          participants: '["peer-2", "session-id"]',
          lastMessageAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T10:00:00Z',
        },
      ];

      vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
        return {
          from: (table: any) => {
            return {
              where: (_cond: any) => {
                if (table === schema.conversationMembers) {
                  return Promise.resolve([{ conversationId: 'conv-member' }]);
                }
                const queryObj: any = {
                  orderBy: (_order: any) => {
                    const orderObj: any = Promise.resolve(mockConversationRows);
                    orderObj.limit = async (_l: number) => mockConversationRows;
                    return orderObj;
                  },
                };
                return queryObj;
              },
            };
          },
        } as any;
      });

      const res = await actualTursoOps.listConversationsTurso('session-id');
      expect(res.success).toBe(true);
      expect(res.rows.length).toBe(2);
      resolveSpy.mockRestore();
    });
  });
});
