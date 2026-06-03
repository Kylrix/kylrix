import { CDRClient } from '@piplabs/cdr-sdk';
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
