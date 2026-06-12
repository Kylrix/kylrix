import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { mainnet, base, arbitrum, polygon } from 'viem/chains';
import { WalletService, type SupportedWalletChain } from './wallets';

// DRPC configuration mapping
const DRPC_CHAINS: Record<string, any> = {
  eth: mainnet,
  base: base,
  arbitrum: arbitrum,
  polygon: polygon
};

const DRPC_NETWORK_NAMES: Record<string, string> = {
  eth: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon'
};

export interface Web3Balance {
  formatted: string;
  value: bigint;
  symbol: string;
}

export const Web3WalletService = {
  /** Create a viem public client for a specified chain using DRPC endpoint */
  getPublicClient(chain: SupportedWalletChain) {
    const config = DRPC_CONFIGS[chain];
    if (!config) {
      throw new Error(`DRPC/Viem integration is not configured for chain: ${chain}`);
    }
    return createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl)
    });
  },

  /** Get live balance of an EVM wallet address */
  async getBalance(userId: string, chain: SupportedWalletChain): Promise<Web3Balance> {
    const wallets = await WalletService.listMainWallets(userId);
    const targetWallet = wallets.find(w => w.chain === chain);
    if (!targetWallet) {
      throw new Error(`No active main wallet found for chain: ${chain}`);
    }

    const client = this.getPublicClient(chain);
    const balance = await client.getBalance({
      address: targetWallet.address as `0x${string}`
    });

    return {
      formatted: parseFloat(formatEther(balance)).toFixed(4),
      value: balance,
      symbol: chain.toUpperCase()
    };
  },

  /** Prepare transaction payload params for in-app sending */
  async prepareTransfer(input: {
    userId: string;
    chain: SupportedWalletChain;
    recipientAddress: string;
    amountEther: string;
  }) {
    const wallets = await WalletService.listMainWallets(input.userId);
    const senderWallet = wallets.find(w => w.chain === input.chain);
    if (!senderWallet) {
      throw new Error(`No sender wallet found for chain: ${input.chain}`);
    }

    const client = this.getPublicClient(input.chain);
    const value = parseEther(input.amountEther);

    // Fetch gas parameters dynamically via DRPC
    const gasEstimate = await client.estimateGas({
      account: senderWallet.address as `0x${string}`,
      to: input.recipientAddress as `0x${string}`,
      value
    });

    const gasPrice = await client.getGasPrice();

    return {
      from: senderWallet.address,
      to: input.recipientAddress,
      value: value.toString(),
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice.toString(),
      estimatedFeeEther: formatEther(gasEstimate * gasPrice)
    };
  }
};
