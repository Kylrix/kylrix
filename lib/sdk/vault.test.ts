import { describe, expect, it, vi } from 'vitest';
import { KylrixVault } from './vault';

describe('KylrixVault', () => {
  it('should successfully get credentials with standard queries', async () => {
    const mockRows = [
      { $id: 'cred-1', label: 'GitHub Personal Token' },
      { $id: 'cred-2', label: 'Vercel API Key' }];

    const mockSdk = {
      listRows: vi.fn().mockResolvedValue({
        rows: mockRows,
        rows: mockRows,
        total: 2,
      }),
      createRow: vi.fn(),
    };

    const vault = new KylrixVault(mockSdk);
    const queries = ['equal("userId", "user-123")'];

    const result = await vault.getCredentials('db-id', 'table-id', queries);

    expect(mockSdk.listRows).toHaveBeenCalledTimes(1);
    expect(mockSdk.listRows).toHaveBeenCalledWith('db-id', 'table-id', queries);
    expect(result.rows).toEqual(mockRows);
    expect(result.total).toBe(2);
  });

  it('should use default empty query list when no queries are specified', async () => {
    const mockSdk = {
      listRows: vi.fn().mockResolvedValue({
        rows: [],
        rows: [],
      }),
      createRow: vi.fn(),
    };

    const vault = new KylrixVault(mockSdk);
    await vault.getCredentials('db-id', 'table-id');

    expect(mockSdk.listRows).toHaveBeenCalledWith('db-id', 'table-id', []);
  });

  it('should successfully save encrypted credentials', async () => {
    const encryptedData = {
      label: 'My Secret',
      cipherText: 'encrypted-base64-payload',
      iv: 'random-iv-base64',
    };

    const mockSdk = {
      listRows: vi.fn(),
      createRow: vi.fn().mockImplementation(async (db, table, data) => ({
        $id: 'cred-123',
        ...data,
      })),
    };

    const vault = new KylrixVault(mockSdk);
    const result = await vault.saveCredential('db-id', 'table-id', encryptedData);

    expect(mockSdk.createRow).toHaveBeenCalledTimes(1);
    expect(mockSdk.createRow).toHaveBeenCalledWith('db-id', 'table-id', encryptedData);
    expect(result).toHaveProperty('$id', 'cred-123');
    expect(result.cipherText).toBe('encrypted-base64-payload');
  });

  it('should successfully retrieve vault settings for a user', async () => {
    const mockSettings = {
      $id: 'settings-123',
      userId: 'user-789',
      twoFactorEnabled: true,
    };

    const mockSdk = {
      listRows: vi.fn().mockResolvedValue({
        rows: [mockSettings],
        rows: [mockSettings],
      }),
      createRow: vi.fn(),
    };

    const vault = new KylrixVault(mockSdk);
    const result = await vault.getVaultSettings('db-id', 'table-id', 'user-789');

    expect(mockSdk.listRows).toHaveBeenCalledTimes(1);
    expect(mockSdk.listRows).toHaveBeenCalledWith('db-id', 'table-id', [
      'equal("userId", "user-789")']);
    expect(result).toEqual(mockSettings);
  });

  it('should return null when no vault settings are found', async () => {
    const mockSdk = {
      listRows: vi.fn().mockResolvedValue({
        rows: [],
        rows: [],
      }),
      createRow: vi.fn(),
    };

    const vault = new KylrixVault(mockSdk);
    const result = await vault.getVaultSettings('db-id', 'table-id', 'user-789');

    expect(result).toBeNull();
  });
});
