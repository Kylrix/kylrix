import { CDRClient, type StorageProvider } from '@piplabs/cdr-sdk';
import { initWasm } from '@piplabs/cdr-crypto';
import { createPublicClient, createWalletClient, http, defineChain } from 'viem';

export const aeneidTestnet = defineChain({
  id: 1315,
  name: 'Story Aeneid Testnet',
  network: 'story-aeneid',
  nativeCurrency: {
    decimals: 18,
    name: 'IP',
    symbol: 'IP',
  },
  rpcUrls: {
    default: { http: ['https://aeneid.storyrpc.io'] },
    public: { http: ['https://aeneid.storyrpc.io'] },
  },
  blockExplorers: {
    default: { name: 'Aeneid Explorer', url: 'https://aeneid.storyscan.xyz' },
  },
  testnet: true,
});

let wasmInitialized = false;

export async function ensureWasm() {
  if (wasmInitialized) return;
  if (typeof window !== 'undefined') {
    try {
      await initWasm();
      wasmInitialized = true;
      console.log('[Story-CDR] Cryptographic WASM module initialized successfully.');
    } catch (e) {
      console.warn('[Story-CDR] WASM initialization failed or skipped:', e);
    }
  }
}

export function getStoryCDRClient(account: any) {
  const publicClient = createPublicClient({
    chain: aeneidTestnet,
    transport: http('https://aeneid.storyrpc.io'),
  });

  const walletClient = createWalletClient({
    account,
    chain: aeneidTestnet,
    transport: http('https://aeneid.storyrpc.io'),
  });

  return new CDRClient({
    network: 'testnet',
    publicClient,
    walletClient,
    apiUrl: process.env.NEXT_PUBLIC_STORY_CDR_API_URL || 'https://aeneid-api.storyfoundation.org',
  });
}

export class InMemoryStorageProvider implements StorageProvider {
  private static store = new Map<string, Uint8Array>();

  async upload(data: Uint8Array): Promise<string> {
    // Generate a mock CID
    const hashHex = Array.from(data)
      .slice(0, 10)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const mockCid = `QmStoryDemoIPFS${hashHex}${Math.random().toString(36).substring(2, 10)}`;
    InMemoryStorageProvider.store.set(mockCid, data);
    return mockCid;
  }

  async download(cid: string): Promise<Uint8Array> {
    const data = InMemoryStorageProvider.store.get(cid);
    if (!data) {
      throw new Error(`CID not found in demo in-memory storage: ${cid}`);
    }
    return data;
  }
}
