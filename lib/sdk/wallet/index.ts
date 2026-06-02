import { Query } from 'appwrite';
import { Buffer } from 'buffer';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import * as secp256k1 from '@noble/secp256k1';
import * as ed25519 from '@noble/ed25519';
import { base58, bech32 } from '@scure/base';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ripemd160 as hash160 } from '@noble/hashes/ripemd160';
import { blake2b } from '@noble/hashes/blake2.js';

export type SupportedWalletChain =
  | 'eth'
  | 'usdc'
  | 'sol'
  | 'btc'
  | 'sui'
  | 'base'
  | 'polygon'
  | 'arbitrum';

export type WalletFamily = 'evm' | 'solana' | 'bitcoin' | 'sui';

export interface WalletSummary {
  id: string;
  chain: SupportedWalletChain;
  label: string;
  symbol: string;
  family: WalletFamily;
  address: string;
  type: 'main' | 'burner' | 'agent_sub_wallet';
  publicProfile: boolean;
}

export interface WalletNetworkDefinition {
  chain: SupportedWalletChain;
  label: string;
  symbol: string;
  family: WalletFamily;
  publicProfile: boolean;
  aliasOf?: SupportedWalletChain;
}

export interface WalletTablesDB {
  listRows(databaseId: string, tableId: string, queries?: string[]): Promise<{ rows: any[] }>;
  getRow(databaseId: string, tableId: string, rowId: string): Promise<any>;
  createRow(databaseId: string, tableId: string, rowId: string, data: Record<string, unknown>, permissions?: string[]): Promise<any>;
  deleteRow(databaseId: string, tableId: string, rowId: string): Promise<any>;
}

export interface WalletSecurityAdapter {
  status: { isUnlocked: boolean };
  getMasterKey(): CryptoKey | null;
  encrypt(data: string): Promise<string>;
  decrypt(data: string): Promise<string>;
}

export interface WalletUserAdapter {
  updateProfile(userId: string, data: Record<string, unknown>): Promise<void>;
  getProfileById(userId: string): Promise<{ publicKey?: string | null } | null>;
  ensureProfileForUser?(input: { $id: string; email: string }): Promise<void>;
}

export interface WalletPermissionsAdapter {
  walletPermissions(userId: string): string[];
  walletMapPermissions(userId: string): string[];
}

export interface WalletServiceConfig {
  passwordManagerDbId: string;
  walletsTableId: string;
  noteDbId: string;
  walletMapTableId: string;
}

export interface WalletServiceDeps {
  tablesDB: WalletTablesDB;
  security: WalletSecurityAdapter;
  users: WalletUserAdapter;
  config: WalletServiceConfig;
  permissions?: WalletPermissionsAdapter;
}

interface WalletRootEnvelope {
  version: 't4.wallet.root.v1';
  walletId: string;
  mnemonic: string;
  createdAt: string;
}

const NETWORKS: Record<SupportedWalletChain, WalletNetworkDefinition> = {
  eth: { chain: 'eth', label: 'Ethereum', symbol: 'ETH', family: 'evm', publicProfile: true },
  usdc: { chain: 'usdc', label: 'USDC', symbol: 'USDC', family: 'evm', publicProfile: true, aliasOf: 'eth' },
  sol: { chain: 'sol', label: 'Solana', symbol: 'SOL', family: 'solana', publicProfile: true },
  btc: { chain: 'btc', label: 'Bitcoin', symbol: 'BTC', family: 'bitcoin', publicProfile: true },
  sui: { chain: 'sui', label: 'Sui', symbol: 'SUI', family: 'sui', publicProfile: true },
  base: { chain: 'base', label: 'Base', symbol: 'BASE', family: 'evm', publicProfile: true, aliasOf: 'eth' },
  polygon: { chain: 'polygon', label: 'Polygon', symbol: 'POL', family: 'evm', publicProfile: true, aliasOf: 'eth' },
  arbitrum: { chain: 'arbitrum', label: 'Arbitrum', symbol: 'ARB', family: 'evm', publicProfile: true, aliasOf: 'eth' },
};

export const DEFAULT_MAIN_CHAINS: SupportedWalletChain[] = ['sol', 'eth', 'usdc', 'btc'];
export const PUBLIC_CHAIN_PRIORITY: SupportedWalletChain[] = ['sol', 'eth', 'usdc', 'btc', 'sui', 'base', 'polygon', 'arbitrum'];

const ownerIdForUser = (userId: string) => `user:${userId}`;

const walletPermissions = (deps: WalletServiceDeps, userId: string) =>
  deps.permissions?.walletPermissions(userId);

const walletMapPermissions = (deps: WalletServiceDeps, userId: string) =>
  deps.permissions?.walletMapPermissions(userId);

const sortWallets = (wallets: any[]) =>
  [...wallets].sort((a, b) => {
    const aIndex = PUBLIC_CHAIN_PRIORITY.indexOf(a.chain as SupportedWalletChain);
    const bIndex = PUBLIC_CHAIN_PRIORITY.indexOf(b.chain as SupportedWalletChain);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

const getRootChain = (chain: SupportedWalletChain): SupportedWalletChain => NETWORKS[chain].aliasOf || chain;

const toWalletSummary = (row: any): WalletSummary => ({
  id: row.$id,
  chain: row.chain,
  label: NETWORKS[row.chain as SupportedWalletChain]?.label || row.chain,
  symbol: NETWORKS[row.chain as SupportedWalletChain]?.symbol || row.chain.toUpperCase(),
  family: NETWORKS[row.chain as SupportedWalletChain]?.family || 'evm',
  address: row.address,
  type: row.type,
  publicProfile: NETWORKS[row.chain as SupportedWalletChain]?.publicProfile ?? false,
});

const createRootEnvelope = (): WalletRootEnvelope => ({
  version: 't4.wallet.root.v1',
  walletId: crypto.randomUUID(),
  mnemonic: bip39.generateMnemonic(wordlist, 128),
  createdAt: new Date().toISOString(),
});

const buildPublicWalletPayload = (wallets: any[]): string | null => {
  const byChain = new Map(wallets.map((wallet) => [wallet.chain, wallet.address]));
  const published: Record<string, string> = {};

  for (const chain of PUBLIC_CHAIN_PRIORITY) {
    if (!NETWORKS[chain].publicProfile) continue;
    const address = byChain.get(chain);
    if (!address) continue;
    published[chain] = address;
  }

  const orderedChains = Object.keys(published);
  while (orderedChains.length > 0) {
    const candidate = orderedChains.reduce<Record<string, string>>((acc, chain) => {
      acc[chain] = published[chain];
      return acc;
    }, {});
    const serialized = JSON.stringify(candidate);

    if (serialized.length <= 256) {
      return serialized;
    }

    orderedChains.pop();
  }

  return null;
};

const deriveAddress = async (
  root: WalletRootEnvelope,
  chain: SupportedWalletChain,
  cache: Map<SupportedWalletChain, string>
): Promise<string> => {
  const rootChain = getRootChain(chain);
  const cached = cache.get(rootChain);
  if (cached) {
    return cached;
  }

  let address = '';
  const seed = await bip39.mnemonicToSeed(root.mnemonic);
  const rootKey = HDKey.fromMasterSeed(seed);

  switch (NETWORKS[rootChain].family) {
    case 'evm': {
      // m/44'/60'/0'/0/0
      const child = rootKey.derive("m/44'/60'/0'/0/0");
      if (!child.privateKey) throw new Error('Failed to derive EVM key');
      const pubKey = secp256k1.getPublicKey(child.privateKey, false).slice(1);
      const hash = keccak_256(pubKey);
      address = '0x' + Buffer.from(hash.slice(-20)).toString('hex').toLowerCase();
      break;
    }
    case 'solana': {
      // m/44'/501'/0'/0'
      const child = rootKey.derive("m/44'/501'/0'/0'");
      if (!child.privateKey) throw new Error('Failed to derive Solana key');
      const pubKey = await ed25519.getPublicKey(child.privateKey);
      address = base58.encode(pubKey);
      break;
    }
    case 'bitcoin': {
      // m/84'/0'/0'/0/0 (Native SegWit P2WPKH)
      const child = rootKey.derive("m/84'/0'/0'/0/0");
      if (!child.publicKey) throw new Error('Failed to derive Bitcoin key');
      const pkh = hash160(child.publicKey);
      const words = bech32.toWords(pkh);
      address = bech32.encode('bc', [0, ...words]);
      break;
    }
    case 'sui': {
      // m/44'/784'/0'/0'/0'
      const child = rootKey.derive("m/44'/784'/0'/0'/0'");
      if (!child.privateKey) throw new Error('Failed to derive Sui key');
      const pubKey = await ed25519.getPublicKey(child.privateKey);
      const tmp = new Uint8Array(33);
      tmp.set([0x00]); // Flag for Ed25519 in Sui
      tmp.set(pubKey, 1);
      const hash = blake2b(tmp, { outputLength: 32 });
      address = '0x' + Buffer.from(hash).toString('hex').slice(0, 64);
      break;
    }
    default: {
      throw new Error(`Unsupported wallet family for ${chain}`);
    }
  }

  cache.set(rootChain, address);
  return address;
};

const parseRootEnvelope = async (security: WalletSecurityAdapter, encryptedSecret: string): Promise<WalletRootEnvelope> => {
  const decrypted = await security.decrypt(encryptedSecret);
  const parsed = JSON.parse(decrypted);

  if (parsed?.version !== 't4.wallet.root.v1' || !parsed?.mnemonic) {
    throw new Error('Unsupported wallet secret envelope');
  }

  return parsed as WalletRootEnvelope;
};

const ensureUnlocked = (security: WalletSecurityAdapter) => {
  if (!security.status.isUnlocked || !security.getMasterKey()) {
    throw new Error('Wallet vault is locked');
  }
};

export function createWalletService(deps: WalletServiceDeps) {
  const listWalletRows = async (userId: string) => {
    const response = await deps.tablesDB.listRows(deps.config.passwordManagerDbId, deps.config.walletsTableId, [
      Query.equal('ownerId', ownerIdForUser(userId)),
      Query.equal('type', 'main'),
      Query.limit(100)]);

    return sortWallets(response.rows);
  };

  const createWalletRow = async (
    userId: string,
    chain: SupportedWalletChain,
    root: WalletRootEnvelope,
    cache: Map<SupportedWalletChain, string>
  ) => {
    const address = await deriveAddress(root, chain, cache);
    const encryptedSecret = await deps.security.encrypt(JSON.stringify(root));
    const walletId = `main-${chain}-${userId}`;

    try {
      return await deps.tablesDB.createRow(
        deps.config.passwordManagerDbId,
        deps.config.walletsTableId,
        walletId,
        {
          ownerId: ownerIdForUser(userId),
          address,
          chain,
          encryptedSecret,
          type: 'main',
        },
        walletPermissions(deps, userId)
      );
    } catch (error: any) {
      if (error?.code === 409) {
        return await deps.tablesDB.getRow(deps.config.passwordManagerDbId, deps.config.walletsTableId, walletId);
      }
      throw error;
    }
  };

  const syncWalletMap = async (userId: string, wallets: any[]) => {
    const publicAddresses = Array.from(
      new Set(
        wallets
          .filter((wallet) => NETWORKS[wallet.chain as SupportedWalletChain]?.publicProfile)
          .map((wallet) => wallet.address.toLowerCase())
      )
    );

    const existing = await deps.tablesDB.listRows(deps.config.noteDbId, deps.config.walletMapTableId, [
      Query.equal('userId', userId),
      Query.limit(100)]);

    for (const row of existing.rows) {
      if (!publicAddresses.includes(row.walletAddressLower)) {
        await deps.tablesDB.deleteRow(deps.config.noteDbId, deps.config.walletMapTableId, row.$id);
      }
    }

    const existingAddresses = new Set(existing.rows.map((row: any) => row.walletAddressLower));

    for (const walletAddressLower of publicAddresses) {
      if (existingAddresses.has(walletAddressLower)) continue;

      try {
        await deps.tablesDB.createRow(
          deps.config.noteDbId,
          deps.config.walletMapTableId,
          crypto.randomUUID(),
          {
            walletAddressLower,
            userId,
            updatedAt: new Date().toISOString(),
          },
          walletMapPermissions(deps, userId)
        );
      } catch (error) {
        console.warn('[WalletService] Failed to sync walletMap row', error);
      }
    }
  };

  const publishWalletAddresses = async (userId: string, wallets: any[]) => {
    const serialized = buildPublicWalletPayload(wallets);

    await deps.users.updateProfile(userId, {
      walletAddress: serialized,
    });

    await syncWalletMap(userId, wallets);
  };

  const service = {
    defaultChains: DEFAULT_MAIN_CHAINS,
    supportedChains: Object.keys(NETWORKS) as SupportedWalletChain[],
    networkDefinitions: NETWORKS,
    buildPublicWalletPayload,
    ensureWalletVaultUnlocked: () => ensureUnlocked(deps.security),

    async listMainWallets(userId: string): Promise<WalletSummary[]> {
      const rows = await listWalletRows(userId);
      return rows.map(toWalletSummary);
    },

    async listAllWallets(userId: string): Promise<WalletSummary[]> {
      const response = await deps.tablesDB.listRows(deps.config.passwordManagerDbId, deps.config.walletsTableId, [
        Query.equal('ownerId', ownerIdForUser(userId)),
        Query.limit(100)]);

      return response.rows.map(toWalletSummary);
    },

    async createBurnerWallet(userId: string): Promise<WalletSummary[]> {
      ensureUnlocked(deps.security);

      const root = createRootEnvelope();
      const cache = new Map<SupportedWalletChain, string>();
      const createdRows: any[] = [];

      for (const chain of DEFAULT_MAIN_CHAINS) {
        const address = await deriveAddress(root, chain, cache);
        const encryptedSecret = await deps.security.encrypt(JSON.stringify(root));
        const walletId = `burner-${root.walletId.slice(0, 8)}-${chain}-${userId}`;

        const created = await deps.tablesDB.createRow(
          deps.config.passwordManagerDbId,
          deps.config.walletsTableId,
          walletId,
          {
            ownerId: ownerIdForUser(userId),
            address,
            chain,
            encryptedSecret,
            type: 'burner',
          },
          walletPermissions(deps, userId)
        );
        createdRows.push(created);
      }

      return createdRows.map(toWalletSummary);
    },

    async ensureMainWallets(userId: string): Promise<WalletSummary[]> {
      ensureUnlocked(deps.security);

      const existingRows = await listWalletRows(userId);
      const cache = new Map<SupportedWalletChain, string>();
      const root = existingRows[0] ? await parseRootEnvelope(deps.security, existingRows[0].encryptedSecret) : createRootEnvelope();

      const walletsByChain = new Map(existingRows.map((wallet) => [wallet.chain as SupportedWalletChain, wallet]));
      const createdRows: any[] = [];

      for (const chain of DEFAULT_MAIN_CHAINS) {
        if (walletsByChain.has(chain)) continue;

        const created = await createWalletRow(userId, chain, root, cache);
        walletsByChain.set(chain, created);
        createdRows.push(created);
      }

      const allWallets = sortWallets([...existingRows, ...createdRows]);
      await publishWalletAddresses(userId, allWallets);

      return allWallets.map(toWalletSummary);
    },

    async addNetwork(userId: string, chain: SupportedWalletChain): Promise<WalletSummary[]> {
      if (!NETWORKS[chain]) {
        throw new Error(`Unsupported wallet network: ${chain}`);
      }

      ensureUnlocked(deps.security);

      const existingRows = await listWalletRows(userId);
      if (!existingRows.length) {
        await service.ensureMainWallets(userId);
        return service.addNetwork(userId, chain);
      }

      if (existingRows.some((wallet) => wallet.chain === chain)) {
        return existingRows.map(toWalletSummary);
      }

      const root = await parseRootEnvelope(deps.security, existingRows[0].encryptedSecret);
      const created = await createWalletRow(userId, chain, root, new Map());
      const allWallets = sortWallets([...existingRows, created]);

      await publishWalletAddresses(userId, allWallets);

      return allWallets.map(toWalletSummary);
    },

    async getWalletSecret(userId: string): Promise<string> {
      ensureUnlocked(deps.security);

      const response = await deps.tablesDB.listRows(deps.config.passwordManagerDbId, deps.config.walletsTableId, [
        Query.equal('ownerId', ownerIdForUser(userId)),
        Query.equal('type', 'main'),
        Query.limit(1)]);

      if (response.rows.length === 0) {
        throw new Error('No wallets found');
      }

      const root = await parseRootEnvelope(deps.security, response.rows[0].encryptedSecret);
      return root.mnemonic;
    },

    async derivePrivateKey(userId: string, chain: SupportedWalletChain): Promise<string> {
      ensureUnlocked(deps.security);

      const mnemonic = await service.getWalletSecret(userId);
      const rootChain = getRootChain(chain);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const rootKey = HDKey.fromMasterSeed(seed);

      switch (NETWORKS[rootChain].family) {
        case 'evm': {
          const child = rootKey.derive("m/44'/60'/0'/0/0");
          if (!child.privateKey) throw new Error('Failed to derive EVM key');
          return Buffer.from(child.privateKey).toString('hex');
        }
        case 'solana': {
          const child = rootKey.derive("m/44'/501'/0'/0'");
          if (!child.privateKey) throw new Error('Failed to derive Solana key');
          // Solana private key is seed + pubkey in some formats, but seed is enough for others.
          // lib/services/wallets.ts used Keypair.fromSeed(derived.key.slice(0, 32))
          return Buffer.from(child.privateKey).toString('hex');
        }
        case 'bitcoin': {
          const child = rootKey.derive("m/84'/0'/0'/0/0");
          if (!child.privateKey) throw new Error('Failed to derive Bitcoin key');
          // WIF generation requires more work or keep bitcoinjs-lib.
          // Actually, if we're only DERIVING, we can return the hex.
          return Buffer.from(child.privateKey).toString('hex');
        }
        case 'sui': {
          const child = rootKey.derive("m/44'/784'/0'/0'/0'");
          if (!child.privateKey) throw new Error('Failed to derive Sui key');
          return Buffer.from(child.privateKey).toString('hex');
        }
        default: {
          throw new Error(`Unsupported wallet family for ${chain}`);
        }
      }
    },

    async publishWalletAddresses(userId: string, wallets: any[]) {
      return publishWalletAddresses(userId, wallets);
    },

    async syncWalletMap(userId: string, wallets: any[]) {
      return syncWalletMap(userId, wallets);
    },
  };

  return service;
}

export { NETWORKS as WALLET_NETWORKS };
