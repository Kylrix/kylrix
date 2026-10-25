import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeKeychainRow } from '../lib/vault/normalize-keychain';
import { masterPassCrypto } from '../lib/masterpass-crypto';
import { ecosystemSecurity } from '../lib/ecosystem/security';

// Mock DB to prevent remote Turso HTTP requests during vitest runs
vi.mock('../lib/db', () => {
  const whereMock = vi.fn().mockImplementation(() => {
    const p = Promise.resolve([]);
    (p as any).limit = vi.fn().mockResolvedValue([]);
    return p;
  });

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereMock,
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: 'mock' }]),
          onConflictDoNothing: vi.fn().mockResolvedValue([{ id: 'mock' }]),
          then: (resolve: any) => resolve([{ id: 'mock' }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    },
    schema: {
      keychain: {
        id: 'id',
        userId: 'user_id',
        type: 'type',
      },
    },
  };
});

describe('MasterPass Unlock Performance & Keychain Normalization', () => {
  const mockUserId = 'user_test_masterpass_perf_123';
  const testPassword = 'CorrectMasterPassword123!';

  beforeEach(() => {
    masterPassCrypto.lock();
    ecosystemSecurity.lock();
  });

  it('normalizeKeychainRow correctly transforms raw Turso DB rows', () => {
    const rawTursoRow = {
      id: 'keychain_user123_password',
      userId: 'user123',
      account: 'masterpass',
      type: 'password',
      encryptedPayload: 'SGVsbG9Xb3JsZFdyYXBwZWRLZXk=',
      nonce: 'U2FsdEJhc2U2NEp1c3RUZXN0aW5n',
      metadata: JSON.stringify({
        isArgon: true,
        params: { algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 },
        authPass: true,
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const normalized = normalizeKeychainRow(rawTursoRow);

    expect(normalized).not.toBeNull();
    expect(normalized.$id).toBe('keychain_user123_password');
    expect(normalized.wrappedKey).toBe('SGVsbG9Xb3JsZFdyYXBwZWRLZXk=');
    expect(normalized.salt).toBe('U2FsdEJhc2U2NEp1c3RUZXN0aW5n');
    expect(normalized.isArgon).toBe(true);
    expect(normalized.params).toEqual({
      algo: 'Argon2id',
      memory: 65536,
      iterations: 3,
      parallelism: 4,
    });
  });

  it('masterPassCrypto unlocks in milliseconds (<1500ms) with raw Turso row', async () => {
    // 1. Setup vault in memory
    await masterPassCrypto.setupVault(testPassword, mockUserId);
    expect(masterPassCrypto.isVaultUnlocked()).toBe(true);

    const rawMek = await masterPassCrypto.exportKey();
    expect(rawMek).not.toBeNull();

    // Lock vault
    masterPassCrypto.lock();
    ecosystemSecurity.lock();
    expect(masterPassCrypto.isVaultUnlocked()).toBe(false);

    // 2. Derive key and wrap MEK manually to create a realistic raw DB row
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const { argon2id } = await import('hash-wasm');
    const hash = await argon2id({
      password: testPassword,
      salt,
      parallelism: 4,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'binary',
    });

    const authKey = await crypto.subtle.importKey(
      'raw',
      hash as any,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encryptedMek = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      authKey,
      rawMek!
    );

    const combined = new Uint8Array(iv.length + encryptedMek.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedMek), iv.length);

    const wrappedKeyBase64 = btoa(String.fromCharCode(...combined));
    const saltBase64 = btoa(String.fromCharCode(...salt));

    const rawTursoRow = {
      id: `keychain_${mockUserId}_password`,
      userId: mockUserId,
      account: 'masterpass',
      type: 'password',
      encryptedPayload: wrappedKeyBase64,
      nonce: saltBase64,
      metadata: JSON.stringify({
        isArgon: true,
        params: { algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 },
        authPass: true,
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Spy on fetchKeychain to return un-normalized raw DB row
    vi.spyOn(ecosystemSecurity, 'fetchKeychain').mockResolvedValue(rawTursoRow);

    // Measure unlock time
    const startTime = Date.now();
    const success = await masterPassCrypto.unlock(testPassword, mockUserId, false);
    const durationMs = Date.now() - startTime;

    expect(success).toBe(true);
    expect(masterPassCrypto.isVaultUnlocked()).toBe(true);

    // Verification: Unlocking must complete in milliseconds (<1500ms), NOT minutes!
    console.log(`[Test] MasterPass unlock duration with raw Turso row: ${durationMs}ms`);
    expect(durationMs).toBeLessThan(1500);
  });
});
