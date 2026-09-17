import { describe, it, expect } from 'vitest';
import { callKeeperHubMCPTool, buildKeeperHubReceipt } from './client';
import { executeKeeperHubTransactionAction, dryRunKeeperHubTransactionAction } from '@/lib/actions/keeperhub';

describe('KeeperHub MCP Client & Actions', () => {
  it('builds a valid deterministic execution receipt', () => {
    const receipt = buildKeeperHubReceipt({
      recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      amount: '0.001',
      symbol: 'ETH',
      targetChain: 'Ethereum Sepolia',
      chainId: 11155111,
    });

    expect(receipt).toBeDefined();
    expect(receipt.status).toBe('Confirmed');
    expect(receipt.executionLayer).toBe('KeeperHub Turnkey Enclave');
    expect(receipt.recipient).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    expect(receipt.amount).toBe('0.001');
    expect(receipt.symbol).toBe('ETH');
    expect(receipt.chainId).toBe(11155111);
    expect(receipt.policy.allowlistVerified).toBe(true);
    expect(receipt.explorerUrl).toContain('sepolia.etherscan.io');
  });

  it('executes MCP tool call and returns deterministic receipt fallback', async () => {
    const res = await callKeeperHubMCPTool('execute_transfer', {
      recipient: '0x3a19F02b48d2A4210D49C73351C9B38908fC8201',
      amount: '0.005',
      symbol: 'ETH',
      network: 'Ethereum Sepolia',
      chainId: 11155111,
    });

    expect(res.success).toBe(true);
    expect(res.receipt).toBeDefined();
    expect(res.receipt?.recipient).toBe('0x3a19F02b48d2A4210D49C73351C9B38908fC8201');
    expect(res.receipt?.amount).toBe('0.005');
  });

  it('runs server action executeKeeperHubTransactionAction', async () => {
    const res = await executeKeeperHubTransactionAction({
      recipient: '0x9b1C28e7eF8682613d5A0a427B9e49aEDd13e312',
      amount: '0.001',
      symbol: 'ETH',
      network: 'Ethereum Sepolia',
      chainId: 11155111,
      intent: 'Fund bounty: Send 0.001 Sepolia ETH',
    });

    expect(res.success).toBe(true);
    expect(res.receipt).toBeDefined();
    expect(res.receipt?.recipient).toBe('0x9b1C28e7eF8682613d5A0a427B9e49aEDd13e312');
  });

  it('runs dryRunKeeperHubTransactionAction', async () => {
    const res = await dryRunKeeperHubTransactionAction({
      recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      amount: '0.001',
      symbol: 'ETH',
    });

    expect(res.success).toBe(true);
    expect(res.verified).toBe(true);
    expect(res.maxFeeGwei).toBeGreaterThan(0);
  });
});
