import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listVaultItemsTurso, listTotpSecretsTurso } from '@/lib/actions/turso-ops';
import { ProjectsService } from '@/lib/data';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

describe('Workspace Vault, TOTP & Tagged Resources Optimization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries workspace credentials matching workspaceId or attached workspaceObjects', async () => {
    const wsId = 'ws_custom_123';
    const userId = 'usr_123';

    vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (_condition: any) => {
              if (table === schema.workspaceObjects) {
                return Promise.resolve([
                  { entityId: 'attached_cred_1' },
                ]);
              }
              if (table === schema.vaultItems) {
                return Promise.resolve([
                  {
                    id: 'attached_cred_1',
                    userId: 'other_user',
                    title: 'Workspace Secret',
                    type: 'login',
                    encryptedData: 'enc_data',
                    metadata: JSON.stringify({ name: 'Workspace Secret' }),
                    workspaceId: wsId,
                    isTrashed: false,
                  },
                ]);
              }
              return Promise.resolve([]);
            },
          };
        },
      } as any;
    });

    const res = await listVaultItemsTurso(userId, wsId);
    expect(res.success).toBe(true);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('attached_cred_1');
    expect(res.rows[0].name).toBe('Workspace Secret');
  });

  it('queries workspace totp secrets matching attached workspaceObjects', async () => {
    const wsId = 'ws_custom_totp_456';
    const userId = 'usr_456';

    vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (_condition: any) => {
              if (table === schema.workspaceObjects) {
                return Promise.resolve([
                  { entityId: 'attached_totp_1' },
                ]);
              }
              if (table === schema.totpSecrets) {
                return Promise.resolve([
                  {
                    id: 'attached_totp_1',
                    userId: 'other_user',
                    account: 'alice@example.com',
                    encryptedSecret: 'BASE32SECRET',
                    metadata: JSON.stringify({ issuer: 'GitHub', accountName: 'alice@example.com' }),
                    createdAt: '2025-01-01T00:00:00Z',
                  },
                ]);
              }
              return Promise.resolve([]);
            },
          };
        },
      } as any;
    });

    const res = await listTotpSecretsTurso(userId, wsId);
    expect(res.success).toBe(true);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('attached_totp_1');
    expect(res.rows[0].issuer).toBe('GitHub');
  });

  it('deduplicates concurrent listTaggedResources calls within 5 seconds', async () => {
    const wsId = 'ws_stampede_test';
    let queryCount = 0;

    vi.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => {
          return {
            where: (_cond: any) => {
              if (table === schema.workspaceObjects) {
                queryCount += 1;
                return Promise.resolve([]);
              }
              return Promise.resolve([]);
            },
          };
        },
      } as any;
    });

    // Concurrently invoke listTaggedResources 5 times (simulating multi-context mount)
    const results = await Promise.all([
      ProjectsService.listTaggedResources(wsId),
      ProjectsService.listTaggedResources(wsId),
      ProjectsService.listTaggedResources(wsId),
      ProjectsService.listTaggedResources(wsId),
      ProjectsService.listTaggedResources(wsId),
    ]);

    // All results should succeed
    expect(results).toHaveLength(5);
    for (const res of results) {
      expect(res).toBeDefined();
      expect(res.notes).toEqual([]);
    }

    // Crucially: workspaceObjects query was only executed once due to in-flight promise deduplication
    expect(queryCount).toBe(1);
  });
});
