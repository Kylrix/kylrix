import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveAllUserIds, listWorkspacesTurso } from '@/lib/actions/turso-ops';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

describe('Workspace Discovery & User ID Aliasing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves legacy Appwrite user IDs and accounts via email alias matching', async () => {
    const sessionUserId = 'usr_ulid_session_123';
    const legacyAppwriteId = '67ffb09c00197408cc0e';
    const email = 'alex@kylrix.space';

    // Mock db.select for user lookups and account lookups
    vi.spyOn(db, 'select').mockImplementation((fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (condition: any) => {
              return {
                limit: async (num: number) => {
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
