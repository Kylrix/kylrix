import { describe, it, expect, vi } from 'vitest';
import { createKylrixTokenOperationsClient } from './client';

vi.mock('@/lib/actions/client-ops', () => ({
  runTokenOperation: vi.fn().mockImplementation((req) => Promise.resolve({ ok: true, req })),
}));

vi.mock('@/lib/actions/secure-ops', () => ({
  runTokenOperationSecure: vi.fn().mockImplementation((req) => Promise.resolve({ ok: true, req })),
}));

vi.mock('@/lib/actions/secure-ops/arbitrum-rail', () => ({
  createPaymentIntentAction: vi.fn().mockImplementation((req) => Promise.resolve({ intentId: 'intent-123', ...req })),
}));

describe('createKylrixTokenOperationsClient', () => {
  it('validates request actions and parameters correctly', async () => {
    const client = createKylrixTokenOperationsClient();

    // Invalid action / missing required fields
    await expect(client.execute(null as any)).rejects.toThrow('TOKEN_CLIENT_INVALID_ACTION');
    await expect(
      client.mintActivity({
        userId: '',
        idempotencyKey: 'key',
        activityType: 'daily_login',
        uniqueActors: 1,
        trustScore: 10,
        sourceType: 'app',
        sourceId: 'id1',
      })
    ).rejects.toThrow('TOKEN_CLIENT_INVALID_USERID');

    await expect(
      client.transfer({
        fromUserId: 'u1',
        toUserId: '',
        amountMicro: '100',
        idempotencyKey: 'k',
        sourceType: 'app',
        sourceId: 'id',
      })
    ).rejects.toThrow('TOKEN_CLIENT_INVALID_TOUSERID');

    await expect(
      client.fineToRoot({
        userId: 'u1',
        amountMicro: '',
        idempotencyKey: 'k',
        reason: 'abuse',
        sourceType: 'app',
        sourceId: 'id',
      })
    ).rejects.toThrow('TOKEN_CLIENT_INVALID_AMOUNTMICRO');

    await expect(
      client.lockClaim({
        userId: 'u1',
        amountMicro: '100',
        destinationWallet: '',
        chain: 'arbitrum',
        idempotencyKey: 'k',
      })
    ).rejects.toThrow('TOKEN_CLIENT_INVALID_DESTINATIONWALLET');

    await expect(
      client.settleClaim({
        userId: 'u1',
        amountMicro: '100',
        destinationWallet: '0x123',
        chain: 'arbitrum',
        onchainTxHash: '',
        idempotencyKey: 'k',
      })
    ).rejects.toThrow('TOKEN_CLIENT_INVALID_ONCHAINTXHASH');
  });

  it('executes server actions with resolved JWT and custom endpoint options', async () => {
    const getJwt = vi.fn().mockResolvedValue('jwt-token-xyz');
    const client = createKylrixTokenOperationsClient({
      endpoint: 'custom-endpoint',
      headers: { 'X-Custom': '1' },
      getJwt,
    });

    const state = await client.getState();
    expect(getJwt).toHaveBeenCalled();
    expect(state).toBeDefined();

    const init = await client.initializeState();
    expect(init).toBeDefined();

    const balance = await client.getBalance();
    expect(balance).toBeDefined();

    const ledger = await client.listLedger();
    expect(ledger).toBeDefined();
  });

  it('handles requestPaymentIntent correctly', async () => {
    const getJwt = vi.fn().mockResolvedValue('jwt-token-123');
    const client = createKylrixTokenOperationsClient({ getJwt });

    const res = await client.requestPaymentIntent('agent-1', 10, { ref: '123' }, 42161);
    expect(res).toEqual({
      jwt: 'jwt-token-123',
      agentId: 'agent-1',
      amount: 10,
      contextPayload: { ref: '123' },
      chainId: 42161,
      intentId: 'intent-123',
    });
  });
});
