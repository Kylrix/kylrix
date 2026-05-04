import { describe, expect, it } from 'vitest';
import { createWalletService } from './index';

const service = createWalletService({
  tablesDB: {
    listRows: async () => ({ rows: [] }),
    getRow: async () => ({}),
    createRow: async (_db, _table, _rowId, data) => ({ $id: 'row', ...data }),
    deleteRow: async () => ({}),
  },
  security: {
    status: { isUnlocked: false },
    getMasterKey: () => null,
    encrypt: async (data) => data,
    decrypt: async (data) => data,
  },
  users: {
    updateProfile: async () => undefined,
    getProfileById: async () => null,
  },
  config: {
    passwordManagerDbId: 'password-manager',
    walletsTableId: 'wallets',
    noteDbId: 'note',
    walletMapTableId: 'wallet-map',
  },
});

describe('wallet service helpers', () => {
  it('builds a stable public wallet payload', () => {
    const payload = service.buildPublicWalletPayload([
      { chain: 'sol', address: 'sol-address' },
      { chain: 'eth', address: 'eth-address' },
    ]);

    expect(payload).toBe('{"eth":"eth-address","sol":"sol-address"}');
  });

  it('rejects wallet actions while locked', () => {
    expect(() => service.ensureWalletVaultUnlocked()).toThrow('Wallet vault is locked');
  });

  it('exposes the supported wallet chains', () => {
    expect(service.supportedChains).toContain('sol');
    expect(service.defaultChains).toEqual(['eth', 'usdc', 'sol', 'btc']);
  });
});
