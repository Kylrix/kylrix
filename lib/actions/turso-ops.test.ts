import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveAllUserIds, listNotesTurso, listGoalsTurso } from '@/lib/actions/turso-ops';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

describe('Workspace Discovery & User ID Aliasing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries notes and goals with desc(updatedAt) ordering', async () => {
    let notesQueryHasOrderBy = false;
    let goalsQueryHasOrderBy = false;

    vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (_condition: any) => {
              return {
                orderBy: (_orderClause: any) => {
                  if (table === schema.notes) notesQueryHasOrderBy = true;
                  if (table === schema.goals) goalsQueryHasOrderBy = true;
                  return Promise.resolve([
                    { id: '1', title: 'Item 1', updatedAt: '2025-01-02T00:00:00Z' },
                    { id: '2', title: 'Item 2', updatedAt: '2025-01-01T00:00:00Z' },
                  ]);
                },
                limit: async (_num: number) => [],
              };
            },
          };
        },
      } as any;
    });

    const notesRes = await listNotesTurso('test_user_id');
    const goalsRes = await listGoalsTurso('test_user_id');

    expect(notesRes.success).toBe(true);
    expect(notesQueryHasOrderBy).toBe(true);
    expect(goalsRes.success).toBe(true);
    expect(goalsQueryHasOrderBy).toBe(true);
  });

  it('resolves legacy Appwrite user IDs and accounts via email alias matching', async () => {
    const sessionUserId = 'usr_ulid_session_123';
    const legacyAppwriteId = '67ffb09c00197408cc0e';
    const email = 'alex@kylrix.space';

    // Mock db.select for user lookups and account lookups
    vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (_condition: any) => {
              return {
                limit: async (_num: number) => {
                  if (table === schema.user) {
                    return [
                      {
                        id: sessionUserId,
                        appwriteAccountId: legacyAppwriteId,
                        email,
                      },
                    ];
                  }
                  if (table === schema.account) {
                    return [
                      {
                        userId: sessionUserId,
                        accountId: legacyAppwriteId,
                      },
                    ];
                  }
                  if (table === schema.workspaceMembers || table === schema.collaborators) {
                    return [];
                  }
                  return [];
                },
              };
            },
          };
        },
      } as any;
    });

    const resolvedIds = await resolveAllUserIds(sessionUserId);
    expect(resolvedIds).toContain(sessionUserId);
    expect(resolvedIds).toContain(legacyAppwriteId);
  });
});
