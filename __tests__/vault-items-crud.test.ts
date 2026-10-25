import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCredential, updateCredential } from '@/lib/data';
import { TursoDatabaseAdapter } from '@/lib/db/repository';
import { upsertVaultItemTurso, upsertTotpSecretTurso } from '@/lib/actions/turso-ops';

vi.mock('@/lib/realtime/partykit', () => ({
  broadcastRealtimeEvent: vi.fn(async () => {}),
}));

const mockVaultRows: any[] = [];
const mockTotpRows: any[] = [];

vi.mock('@/lib/db', async () => {
  const actualSchema = await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => {
            const list = table === actualSchema.vaultItems ? mockVaultRows : mockTotpRows;
            const res = list.slice();
            const promise: any = Promise.resolve(res);
            promise.limit = (n: number) => Promise.resolve(res.slice(0, n));
            return promise;
          },
        }),
      }),
      insert: (table: any) => ({
        values: (val: any) => {
          const handleInsert = () => {
            if (table === actualSchema.vaultItems) {
              const idx = mockVaultRows.findIndex((r) => r.id === val.id);
              if (idx >= 0) mockVaultRows[idx] = val;
              else mockVaultRows.push(val);
            } else if (table === actualSchema.totpSecrets) {
              const idx = mockTotpRows.findIndex((r) => r.id === val.id);
              if (idx >= 0) mockTotpRows[idx] = val;
              else mockTotpRows.push(val);
            }
            return Promise.resolve();
          };
          const res = handleInsert();
          (res as any).onConflictDoUpdate = (_opts: any) => handleInsert();
          (res as any).onConflictDoNothing = () => handleInsert();
          return res;
        },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => {
            if (table === actualSchema.vaultItems && mockVaultRows.length > 0) {
              Object.assign(mockVaultRows[0], data);
            } else if (table === actualSchema.totpSecrets && mockTotpRows.length > 0) {
              Object.assign(mockTotpRows[0], data);
            }
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    },
  };
});

describe('Vault Items & Credentials Normalization and CRUD', () => {
  beforeEach(() => {
    mockVaultRows.length = 0;
    mockTotpRows.length = 0;
  });

  it('creates secret using createCredential with raw encrypted_data field', async () => {
    const adapter = new TursoDatabaseAdapter();
    const created = await adapter.createRow<any>('turso', 'credentials', 'cred_raw_1', {
      userId: 'user_123',
      name: 'Zup GitHub and Google oauth',
      itemType: 'login',
      encrypted_data: 'W; a}: XP@QRE<Dyb)',
      username: 'Test',
    });

    expect(created).toBeDefined();
    expect(mockVaultRows.length).toBe(1);

    const inserted = mockVaultRows[0];
    expect(inserted.title).toBe('Zup GitHub and Google oauth');
    expect(inserted.type).toBe('login');
    expect(inserted.encryptedData).toBe('W; a}: XP@QRE<Dyb)');
    expect(inserted.encrypted_data).toBeUndefined();
    expect(inserted.password).toBeUndefined();
  });

  it('creates secret using createCredential with legacy fields (name, itemType, password)', async () => {
    const credentialData = {
      userId: 'user_123',
      itemType: 'login',
      name: 'GitHub Credentials',
      username: 'jules@example.com',
      password: 'encrypted_pass_abc',
      url: 'https://github.com',
      notes: 'Work account',
      customFields: JSON.stringify([{ id: '1', label: '2FA', value: 'backup' }]),
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-10-22T00:00:00.000Z',
    };

    const created = await createCredential(credentialData, { skipPending: true });

    expect(created).toBeDefined();
    expect(mockVaultRows.length).toBe(1);

    const row = mockVaultRows[0];
    expect(row.title).toBe('GitHub Credentials');
    expect(row.type).toBe('login');
    expect(row.encryptedData).toBe('encrypted_pass_abc');
    expect(row.userId).toBe('user_123');

    const meta = JSON.parse(row.metadata);
    expect(meta.name).toBe('GitHub Credentials');
    expect(meta.username).toBe('jules@example.com');
    expect(meta.password).toBe('encrypted_pass_abc');
    expect(meta.url).toBe('https://github.com');
    expect(meta.notes).toBe('Work account');

    expect(created.name).toBe('GitHub Credentials');
    expect(created.username).toBe('jules@example.com');
    expect(created.password).toBe('encrypted_pass_abc');
    expect(created.itemType).toBe('login');
  });

  it('updates secret using updateCredential with legacy fields', async () => {
    const adapter = new TursoDatabaseAdapter();
    const created = await adapter.createRow<any>('turso', 'credentials', 'cred_999', {
      userId: 'user_123',
      name: 'Initial Name',
      itemType: 'login',
      password: 'pass1',
      username: 'user1',
    });

    expect(created.name).toBe('Initial Name');
    expect(mockVaultRows.length).toBe(1);

    const updated = await updateCredential('cred_999', {
      userId: 'user_123',
      name: 'Updated Name',
      password: 'pass2_updated',
      username: 'user2_updated',
    }, { skipPending: true });

    expect(updated).toBeDefined();
    expect(mockVaultRows[0].title).toBe('Updated Name');
    expect(mockVaultRows[0].encryptedData).toBe('pass2_updated');

    const meta = JSON.parse(mockVaultRows[0].metadata);
    expect(meta.username).toBe('user2_updated');
  });

  it('upsertVaultItemTurso normalizes legacy fields correctly', async () => {
    const res = await upsertVaultItemTurso({
      id: 'cred_turso_1',
      userId: 'user_456',
      name: 'API Key Production',
      itemType: 'env',
      password: 'sk_live_12345',
      username: 'api_client',
      notes: 'Stripe live key',
    });

    expect(res.success).toBe(true);
    expect(mockVaultRows.length).toBe(1);

    const inserted = mockVaultRows[0];
    expect(inserted.title).toBe('API Key Production');
    expect(inserted.type).toBe('env');
    expect(inserted.encryptedData).toBe('sk_live_12345');

    const meta = JSON.parse(inserted.metadata);
    expect(meta.notes).toBe('Stripe live key');
    expect(meta.username).toBe('api_client');
  });

  it('upsertTotpSecretTurso normalizes legacy fields correctly', async () => {
    const res = await upsertTotpSecretTurso({
      id: 'totp_turso_1',
      userId: 'user_456',
      accountName: 'Google Workspace',
      secretKey: 'JBSWY3DPEHPK3PXP',
      issuer: 'Google',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    expect(res.success).toBe(true);
    expect(mockTotpRows.length).toBe(1);

    const inserted = mockTotpRows[0];
    expect(inserted.account).toBe('Google Workspace');
    expect(inserted.encryptedSecret).toBe('JBSWY3DPEHPK3PXP');

    const meta = JSON.parse(inserted.metadata);
    expect(meta.issuer).toBe('Google');
    expect(meta.algorithm).toBe('SHA1');
    expect(meta.digits).toBe(6);
    expect(meta.period).toBe(30);
  });
});
