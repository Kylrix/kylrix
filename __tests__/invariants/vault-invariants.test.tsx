import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TursoDatabaseAdapter, normalizeVaultItemData } from '@/lib/db/repository';

const mockVaultRows: any[] = [];

vi.mock('@/lib/realtime/partykit', () => ({
  broadcastRealtimeEvent: vi.fn(async () => {}),
}));

vi.mock('@/lib/db', async () => {
  const actualSchema = await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => {
            const list = table === actualSchema.vaultItems ? mockVaultRows : [];
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

describe('Vault & Secrets Invariants (vault-invariants.test.tsx)', () => {
  beforeEach(() => {
    mockVaultRows.length = 0;
  });

  describe('Zero-Knowledge Encryption & IV Validation', () => {
    it('normalizeVaultItemData ensures iv is ALWAYS a non-empty 12-byte hex string (never "" or null)', () => {
      // 1. When iv is omitted
      const norm1 = normalizeVaultItemData({
        title: 'API Key',
        password: 'encrypted_payload_1',
      });
      expect(norm1.iv).toBeDefined();
      expect(typeof norm1.iv).toBe('string');
      expect(norm1.iv.length).toBe(24); // 12 bytes = 24 hex chars
      expect(/^[0-9a-fA-F]{24}$/.test(norm1.iv)).toBe(true);

      // 2. When iv is empty string
      const norm2 = normalizeVaultItemData({
        title: 'Empty IV Credential',
        iv: '',
      });
      expect(norm2.iv).toBeDefined();
      expect(norm2.iv).not.toBe('');
      expect(norm2.iv.length).toBe(24);

      // 3. When iv is whitespace
      const norm3 = normalizeVaultItemData({
        title: 'Whitespace IV Credential',
        iv: '   ',
      });
      expect(norm3.iv).toBeDefined();
      expect(norm3.iv.length).toBe(24);

      // 4. When valid iv is provided, it is trimmed and preserved
      const validIv = '0123456789abcdef01234567';
      const norm4 = normalizeVaultItemData({
        title: 'Existing IV Credential',
        iv: `  ${validIv}  `,
      });
      expect(norm4.iv).toBe(validIv);
    });

    it('createRow for vault_items generates a valid 12-byte hex iv when missing', async () => {
      const adapter = new TursoDatabaseAdapter();
      const res = await adapter.createRow<any>('turso', 'vault_items', 'vault_test_1', {
        userId: 'usr_test_1',
        title: 'Database Access Token',
        encryptedData: 'encrypted_secret_data_xyz',
      });

      expect(res).toBeDefined();
      expect(mockVaultRows).toHaveLength(1);
      const inserted = mockVaultRows[0];
      expect(inserted.id).toBe('vault_test_1');
      expect(inserted.iv).toBeDefined();
      expect(inserted.iv.length).toBe(24);
      expect(/^[0-9a-fA-F]{24}$/.test(inserted.iv)).toBe(true);
    });

    it('serializes passwords, secrets, and custom fields into metadata without stripping existing fields', () => {
      const input = {
        name: 'OpenAI Production Key',
        password: 'sk-proj-super-secret-key',
        username: 'admin@kylrix.space',
        url: 'https://api.openai.com/v1',
        notes: 'Primary org token',
        customFields: JSON.stringify([{ label: 'Tier', value: 'Scale' }]),
        dek: 'encrypted_dek_blob',
        metadata: JSON.stringify({
          existingField: 'custom_value',
          keepMe: 42,
        }),
      };

      const normalized = normalizeVaultItemData(input);

      expect(normalized.title).toBe('OpenAI Production Key');
      expect(normalized.encryptedData).toBe('sk-proj-super-secret-key');

      const parsedMeta = JSON.parse(normalized.metadata);
      // Invariant: Existing metadata fields must not be stripped
      expect(parsedMeta.existingField).toBe('custom_value');
      expect(parsedMeta.keepMe).toBe(42);

      // Invariant: Passwords, secrets, and custom attributes are properly packed into metadata
      expect(parsedMeta.password).toBe('sk-proj-super-secret-key');
      expect(parsedMeta.username).toBe('admin@kylrix.space');
      expect(parsedMeta.url).toBe('https://api.openai.com/v1');
      expect(parsedMeta.notes).toBe('Primary org token');
      expect(parsedMeta.customFields).toBe(input.customFields);
      expect(parsedMeta.dek).toBe('encrypted_dek_blob');
    });
  });
});
