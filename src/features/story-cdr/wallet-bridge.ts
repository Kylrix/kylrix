import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { WalletService } from '@/lib/services/wallets';
import { aeneidTestnet, getStoryCDRClient, ensureWasm } from './client';

export async function getStorySignerAndClient(userId: string) {
  const privateKeyHex = await WalletService.derivePrivateKey(userId, 'eth');
  const formattedKey = privateKeyHex.startsWith('0x') ? privateKeyHex as `0x${string}` : `0x${privateKeyHex}` as `0x${string}`;
  
  const account = privateKeyToAccount(formattedKey);
  
  await ensureWasm();
  
  const client = getStoryCDRClient(account);
  
  return {
    account,
    client,
  };
}
