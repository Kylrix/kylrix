import { createPublicClient, http, formatEther, parseEther, parseAbi } from 'viem';
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
  getPublicClient(chain: SupportedWalletChain) {
    const chainConfig = DRPC_CHAINS[chain];
    const networkName = DRPC_NETWORK_NAMES[chain];
    if (!chainConfig || !networkName) {
      throw new Error(`DRPC/Viem integration is not configured for chain: ${chain}`);
    }
    const apiKey = process.env.DRPC_API || 'an_drpc_key_placeholder';
    const rpcUrl = `https://lb.drpc.org/ogrpc?network=${networkName}&dkey=${apiKey}`;
    return createPublicClient({
      chain: chainConfig,
      transport: http(rpcUrl)
    });
  },

  /** Get live balance of native currency and multiple ERC20 tokens in a single batched Multicall3 request */
  async getBalancesMulticall(
    userId: string,
    chain: SupportedWalletChain,
    tokenAddresses: { address: string; symbol: string; decimals: number }[]
  ) {
    const wallets = await WalletService.listMainWallets(userId);
    const targetWallet = wallets.find(w => w.chain === chain);
    if (!targetWallet) {
      throw new Error(`No active main wallet found for chain: ${chain}`);
    }

    const client = this.getPublicClient(chain);
    const userAddress = targetWallet.address as `0x${string}`;

    const erc20Abi = parseAbi([
      'function balanceOf(address) view returns (uint256)',
    ]);

    const multicall3Abi = parseAbi([
      'function getEthBalance(address) view returns (uint256)',
    ]);

    const contracts = [
      {
        address: '0xcA11bde05977b3631167028862bE2a173976CA11' as `0x${string}`,
        abi: multicall3Abi,
        functionName: 'getEthBalance',
        args: [userAddress],
      },
      ...tokenAddresses.map(token => ({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      }))
    ];

    const results = await client.multicall({
      contracts
    });

    const nativeResult = results[0];
    const nativeValue = nativeResult.status === 'success' ? (nativeResult.result as bigint) : 0n;

    const balances = [
      {
        symbol: chain.toUpperCase(),
        formatted: parseFloat(formatEther(nativeValue)).toFixed(4),
        value: nativeValue.toString(),
      }
    ];

    tokenAddresses.forEach((token, index) => {
      const tokenResult = results[index + 1];
      const val = tokenResult?.status === 'success' ? (tokenResult.result as bigint) : 0n;
      const formatted = (Number(val) / Math.pow(10, token.decimals)).toFixed(4);
      balances.push({
        symbol: token.symbol,
        formatted,
        value: val.toString(),
      });
    });

    return balances;
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
