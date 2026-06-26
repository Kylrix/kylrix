import { createPublicClient, http, formatEther, parseEther, parseAbi } from 'viem';
import { mainnet, base, arbitrum, polygon } from 'viem/chains';
import { WalletService, type SupportedWalletChain } from './wallets';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { Query, Permission, Role } from 'appwrite';

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
  },

  /** Retrieve registered ERC20 token contracts from the master Token Registry Table */
  async getTokenRegistry(chain?: SupportedWalletChain) {
    const queries = [];
    if (chain) {
      queries.push(Query.equal('chain', chain));
    }
    queries.push(Query.limit(100));

    const response = await tablesDB.listRows(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.TOKEN_REGISTRY,
      queries
    );

    return response.rows.map((row: any) => ({
      address: row.address,
      symbol: row.symbol,
      decimals: Number(row.decimals),
      iconUrl: row.iconUrl || null
    }));
  },

  /** Log a finalized transaction to the local history Table */
  async logTransaction(input: {
    userId: string;
    chain: SupportedWalletChain;
    hash: string;
    from: string;
    to: string;
    value: string;
    symbol: string;
  }) {
    const data = {
      userId: input.userId,
      chain: input.chain,
      hash: input.hash,
      from: input.from,
      to: input.to,
      value: input.value,
      symbol: input.symbol,
      timestamp: Date.now()
    };

    const rowId = input.hash;

    try {
      return await tablesDB.createRow(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.WEB3_TRANSACTIONS,
        rowId,
        data,
        [
          Permission.read(Role.user(input.userId)),
          Permission.write(Role.user(input.userId))
        ]
      );
    } catch (e: any) {
      if (e?.code === 409) {
        return await tablesDB.getRow(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TABLES.WEB3_TRANSACTIONS,
          rowId
        );
      }
      throw e;
    }
  },

  /** Fetch paginated transaction history for a user */
  async getTransactionHistory(input: {
    userId: string;
    chain?: SupportedWalletChain;
    limit?: number;
    offset?: number;
  }) {
    const queries = [
      Query.equal('userId', input.userId),
      Query.orderDesc('timestamp'),
      Query.limit(input.limit || 50),
      Query.offset(input.offset || 0)
    ];

    if (input.chain) {
      queries.push(Query.equal('chain', input.chain));
    }

    const response = await tablesDB.listRows(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.WEB3_TRANSACTIONS,
      queries
    );

    return response.rows.map((row: any) => ({
      id: row.$id,
      userId: row.userId,
      chain: row.chain,
      hash: row.hash,
      from: row.from,
      to: row.to,
      value: row.value,
      symbol: row.symbol,
      timestamp: row.timestamp
    }));
  }
};
