import { ID, Permission, Query, Role } from 'appwrite';
import { Buffer } from 'buffer';
import { HDNodeWallet } from 'ethers';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import { Ed25519Keypair as SuiEd25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { databases as tablesDB } from '../appwrite';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { ecosystemSecurity } from '../ecosystem/security';
import { updateUser } from '../appwrite';

bitcoin.initEccLib(ecc);

const bip32 = BIP32Factory(ecc);

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

const DEFAULT_MAIN_CHAINS: SupportedWalletChain[] = ['eth', 'usdc', 'sol', 'btc'];
const PUBLIC_CHAIN_PRIORITY: SupportedWalletChain[] = ['eth', 'usdc', 'sol', 'btc', 'sui', 'base', 'polygon', 'arbitrum'];

const ownerIdForUser = (userId: string) => `user:${userId}`;

const walletPermissions = (userId: string) => [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
];

const walletMapPermissions = (userId: string) => [
    Permission.read(Role.any()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
];

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
    mnemonic: bip39.generateMnemonic(128),
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

    switch (NETWORKS[rootChain].family) {
        case 'evm': {
            address = HDNodeWallet.fromPhrase(root.mnemonic, undefined, "m/44'/60'/0'/0/0").address;
            break;
        }
        case 'solana': {
            const seed = bip39.mnemonicToSeedSync(root.mnemonic);
            const derived = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString('hex'));
            const keypair = Keypair.fromSeed(derived.key.slice(0, 32));
            address = keypair.publicKey.toBase58();
            break;
        }
        case 'bitcoin': {
            const seed = bip39.mnemonicToSeedSync(root.mnemonic);
            const node = bip32.fromSeed(seed, bitcoin.networks.bitcoin).derivePath("m/84'/0'/0'/0/0");
            const payment = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(node.publicKey),
                network: bitcoin.networks.bitcoin,
            });

            if (!payment.address) {
                throw new Error('Failed to derive Bitcoin address');
            }

            address = payment.address;
            break;
        }
        case 'sui': {
            const keypair = SuiEd25519Keypair.deriveKeypair(root.mnemonic, "m/44'/784'/0'/0'/0'");
            address = keypair.toSuiAddress();
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
    const response = await tablesDB.listDocuments(PASSWORD_MANAGER_DB, WALLETS_TABLE, [
        Query.equal('ownerId', ownerIdForUser(userId)),
        Query.equal('type', 'main'),
        Query.limit(100),
    ]);

    return sortWallets(response.documents);
};

const createWalletRow = async (
    userId: string,
    chain: SupportedWalletChain,
    root: WalletRootEnvelope,
    cache: Map<SupportedWalletChain, string>
) => {
    const address = await deriveAddress(root, chain, cache);
    const encryptedSecret = await ecosystemSecurity.encrypt(JSON.stringify(root));

    return tablesDB.createDocument(
        PASSWORD_MANAGER_DB,
        WALLETS_TABLE,
        ID.unique(),
        {
            ownerId: ownerIdForUser(userId),
            address,
            chain,
            encryptedSecret,
            type: 'main',
        },
        walletPermissions(userId)
    );
};

const syncWalletMap = async (userId: string, wallets: any[]) => {
    const publicAddresses = Array.from(
        new Set(
            wallets
                .filter((wallet) => NETWORKS[wallet.chain as SupportedWalletChain]?.publicProfile)
                .map((wallet) => wallet.address.toLowerCase())
        )
    );

    const existing = await tablesDB.listDocuments(NOTE_DB, WALLET_MAP_TABLE, [
        Query.equal('userId', userId),
        Query.limit(100),
    ]);

    for (const row of existing.documents) {
        if (!publicAddresses.includes(row.walletAddressLower)) {
            await tablesDB.deleteDocument(NOTE_DB, WALLET_MAP_TABLE, row.$id);
        }
    }

    const existingAddresses = new Set(existing.documents.map((row: any) => row.walletAddressLower));

    for (const walletAddressLower of publicAddresses) {
        if (existingAddresses.has(walletAddressLower)) continue;

        try {
            await tablesDB.createDocument(
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

    await updateUser(userId, {
        walletAddress: serialized,
    } as any);

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
