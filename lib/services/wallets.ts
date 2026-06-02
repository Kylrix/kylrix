import { ID, Permission, Query, Role } from 'appwrite';
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
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { ecosystemSecurity } from '../ecosystem/security';
import { UsersService } from './users';

const PASSWORD_MANAGER_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const WALLETS_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS;
const NOTE_DB = APPWRITE_CONFIG.DATABASES.KYLRIXNOTE;
const WALLET_MAP_TABLE = APPWRITE_CONFIG.TABLES.KYLRIXNOTE.WALLET_MAP;

export type SupportedWalletChain =
    | 'eth'
    | 'usdc'
    | 'sol'
    | 'btc'
    | 'sui'
    | 'base'
    | 'polygon'
    | 'arbitrum';

type WalletFamily = 'evm' | 'solana' | 'bitcoin' | 'sui';

interface WalletRootEnvelope {
    version: 't4.wallet.root.v1';
    walletId: string;
    mnemonic: string;
    createdAt: string;
}

interface WalletNetworkDefinition {
    chain: SupportedWalletChain;
    label: string;
    symbol: string;
    family: WalletFamily;
    publicProfile: boolean;
    aliasOf?: SupportedWalletChain;
}

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

const NETWORKS: Record<SupportedWalletChain, WalletNetworkDefinition> = {
    eth: {
        chain: 'eth',
        label: 'Ethereum',
        symbol: 'ETH',
        family: 'evm',
        publicProfile: true,
    },
    usdc: {
        chain: 'usdc',
        label: 'USDC',
        symbol: 'USDC',
        family: 'evm',
        publicProfile: true,
        aliasOf: 'eth',
    },
    sol: {
        chain: 'sol',
        label: 'Solana',
        symbol: 'SOL',
        family: 'solana',
        publicProfile: true,
    },
    btc: {
        chain: 'btc',
        label: 'Bitcoin',
        symbol: 'BTC',
        family: 'bitcoin',
        publicProfile: true,
    },
    sui: {
        chain: 'sui',
        label: 'Sui',
        symbol: 'SUI',
        family: 'sui',
        publicProfile: true,
    },
    base: {
        chain: 'base',
        label: 'Base',
        symbol: 'BASE',
        family: 'evm',
        publicProfile: true,
        aliasOf: 'eth',
    },
    polygon: {
        chain: 'polygon',
        label: 'Polygon',
        symbol: 'POL',
        family: 'evm',
        publicProfile: true,
        aliasOf: 'eth',
    },
    arbitrum: {
        chain: 'arbitrum',
        label: 'Arbitrum',
        symbol: 'ARB',
        family: 'evm',
        publicProfile: true,
        aliasOf: 'eth',
    },
};

const DEFAULT_MAIN_CHAINS: SupportedWalletChain[] = ['sol', 'eth', 'usdc', 'btc'];
const PUBLIC_CHAIN_PRIORITY: SupportedWalletChain[] = ['sol', 'eth', 'usdc', 'btc', 'sui', 'base', 'polygon', 'arbitrum'];

const ownerIdForUser = (userId: string) => `user:${userId}`;

const walletPermissions = (userId: string) => [
    Permission.read(Role.user(userId))];

const walletMapPermissions = (userId: string) => [
    Permission.read(Role.any())];

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

const parseRootEnvelope = async (encryptedSecret: string): Promise<WalletRootEnvelope> => {
    const decrypted = await ecosystemSecurity.decrypt(encryptedSecret);
    const parsed = JSON.parse(decrypted);

    if (parsed?.version !== 't4.wallet.root.v1' || !parsed?.mnemonic) {
        throw new Error('Unsupported wallet secret envelope');
    }

    return parsed as WalletRootEnvelope;
};

const listWalletRows = async (userId: string) => {
    const response = await tablesDB.listRows(PASSWORD_MANAGER_DB, WALLETS_TABLE, [
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
    const encryptedSecret = await ecosystemSecurity.encrypt(JSON.stringify(root));

    const walletId = `main-${chain}-${userId}`;

    try {
        return await tablesDB.createRow(
            PASSWORD_MANAGER_DB,
            WALLETS_TABLE,
            walletId,
            {
                ownerId: ownerIdForUser(userId),
                address,
                chain,
                encryptedSecret,
                type: 'main',
            },
            walletPermissions(userId)
        );
    } catch (error: any) {
        if (error?.code === 409) {
            return await tablesDB.getRow(PASSWORD_MANAGER_DB, WALLETS_TABLE, walletId);
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

    const existing = await tablesDB.listRows(NOTE_DB, WALLET_MAP_TABLE, [
        Query.equal('userId', userId),
        Query.limit(100)]);

    for (const row of existing.rows) {
        if (!publicAddresses.includes(row.walletAddressLower)) {
            await tablesDB.deleteRow(NOTE_DB, WALLET_MAP_TABLE, row.$id);
        }
    }

    const existingAddresses = new Set(existing.rows.map((row: any) => row.walletAddressLower));

    for (const walletAddressLower of publicAddresses) {
        if (existingAddresses.has(walletAddressLower)) continue;

        try {
            await tablesDB.createRow(
                NOTE_DB,
                WALLET_MAP_TABLE,
                ID.unique(),
                {
                    walletAddressLower,
                    userId,
                    updatedAt: new Date().toISOString(),
                },
                walletMapPermissions(userId)
            );
        } catch (error) {
            console.warn('[WalletService] Failed to sync walletMap row', error);
        }
    }
};

const publishWalletAddresses = async (userId: string, wallets: any[]) => {
    const serialized = buildPublicWalletPayload(wallets);

    await UsersService.updateProfile(userId, {
        walletAddress: serialized,
    });

    await syncWalletMap(userId, wallets);
};

export const WalletService = {
    defaultChains: DEFAULT_MAIN_CHAINS,
    supportedChains: Object.keys(NETWORKS) as SupportedWalletChain[],
    networkDefinitions: NETWORKS,

    async listMainWallets(userId: string): Promise<WalletSummary[]> {
        const rows = await listWalletRows(userId);
        return rows.map(toWalletSummary);
    },

    async ensureMainWallets(userId: string): Promise<WalletSummary[]> {
        if (!ecosystemSecurity.status.isUnlocked || !ecosystemSecurity.getMasterKey()) {
            throw new Error('Wallet vault is locked');
        }

        const existingRows = await listWalletRows(userId);
        const cache = new Map<SupportedWalletChain, string>();
        const root = existingRows[0] ? await parseRootEnvelope(existingRows[0].encryptedSecret) : createRootEnvelope();
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

        if (!ecosystemSecurity.status.isUnlocked || !ecosystemSecurity.getMasterKey()) {
            throw new Error('Wallet vault is locked');
        }

        const existingRows = await listWalletRows(userId);
        if (!existingRows.length) {
            await this.ensureMainWallets(userId);
            return this.addNetwork(userId, chain);
        }

        if (existingRows.some((wallet) => wallet.chain === chain)) {
            return existingRows.map(toWalletSummary);
        }

        const root = await parseRootEnvelope(existingRows[0].encryptedSecret);
        const created = await createWalletRow(userId, chain, root, new Map());
        const allWallets = sortWallets([...existingRows, created]);

        await publishWalletAddresses(userId, allWallets);

        return allWallets.map(toWalletSummary);
    },
};
