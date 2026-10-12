import { describe, it, expect } from 'vitest';
import { analyzeBitwardenExport, validateBitwardenExport } from './bitwarden-mapper';
import { BITWARDEN_ITEM_TYPES } from './bitwarden-types';

describe('bitwarden-mapper', () => {
  const validExport = {
    encrypted: false,
    folders: [{ id: 'f-1', name: 'Work' }],
    items: [
      {
        id: 'item-1',
        type: BITWARDEN_ITEM_TYPES.LOGIN,
        name: 'GitHub',
        folderId: 'f-1',
        notes: 'Personal account',
        favorite: true,
        creationDate: '2025-01-01T00:00:00Z',
        revisionDate: '2025-01-02T00:00:00Z',
        login: {
          username: 'octocat',
          password: 'super-secret-password',
          totp: 'JBSWY3DPEHPK3PXP',
          uris: [{ uri: 'https://github.com' }],
        },
        fields: [{ name: 'Security PIN', value: '1234' }],
      },
      {
        id: 'item-2',
        type: BITWARDEN_ITEM_TYPES.NOTE, // non-login item, skipped
        name: 'Secure Note',
      },
      {
        id: 'item-3',
        type: BITWARDEN_ITEM_TYPES.LOGIN,
        name: 'Incomplete Item',
        login: { username: '', password: '' }, // missing required fields, skipped
      },
    ],
  };

  it('validates bitwarden export structure correctly', () => {
    expect(validateBitwardenExport(validExport)).toBe(true);
    expect(validateBitwardenExport(null)).toBe(false);
    expect(validateBitwardenExport({})).toBe(false);
    expect(validateBitwardenExport({ encrypted: false, folders: [] })).toBe(false);
  });

  it('analyzes and maps Bitwarden export data correctly', () => {
    const userId = 'user-123';
    const result = analyzeBitwardenExport(validExport as any, userId);

    expect(result.folders.length).toBe(1);
    expect(result.folders[0].name).toBe('Work');

    expect(result.credentials.length).toBe(1);
    expect(result.credentials[0].name).toBe('GitHub');
    expect(result.credentials[0].username).toBe('octocat');
    expect(result.credentials[0].password).toBe('super-secret-password');
    expect(result.credentials[0].url).toBe('https://github.com');
    expect(result.credentials[0].customFields).toBe(JSON.stringify({ 'Security PIN': '1234' }));

    expect(result.totpSecrets.length).toBe(1);
    expect(result.totpSecrets[0].secretKey).toBe('JBSWY3DPEHPK3PXP');

    expect(result.mapping.statistics.totalItems).toBe(3);
    expect(result.mapping.statistics.credentialsCount).toBe(1);
    expect(result.mapping.statistics.skippedItems).toBe(2);
  });
});
