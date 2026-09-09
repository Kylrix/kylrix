import { describe, it, expect } from 'vitest';
import {
  createKylrixTokenContract,
  DEFAULT_KYLRIX_TOKEN_POLICY,
  type KylrixEmissionSnapshot,
  type KylrixActivitySignal,
} from './contract';

describe('createKylrixTokenContract', () => {
  const contract = createKylrixTokenContract();

  it('uses default policy', () => {
    expect(contract.policy.symbol).toBe('$KYLRIX');
    expect(contract.policy.decimals).toBe(6);
  });

  it('calculates circulating micro tokens', () => {
    const snapshot: KylrixEmissionSnapshot = {
      mintedMicro: 1000n,
      burnedMicro: 200n,
      genesisAt: '2025-01-01T00:00:00Z',
    };
    expect(contract.circulatingMicro(snapshot)).toBe(800n);

    // Negative circulating prevented
    const snapshotNeg: KylrixEmissionSnapshot = {
      mintedMicro: 100n,
      burnedMicro: 200n,
      genesisAt: '2025-01-01T00:00:00Z',
    };
    expect(contract.circulatingMicro(snapshotNeg)).toBe(0n);
  });

  it('calculates age in days accurately', () => {
    expect(contract.getAgeDays({ mintedMicro: 0n, burnedMicro: 0n, genesisAt: null })).toBe(0);
    expect(contract.getAgeDays({ mintedMicro: 0n, burnedMicro: 0n, genesisAt: 'invalid-date' })).toBe(0);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(contract.getAgeDays({ mintedMicro: 0n, burnedMicro: 0n, genesisAt: twoDaysAgo })).toBe(2);
  });

  it('calculates emission budget and remaining budget', () => {
    const snapshot: KylrixEmissionSnapshot = {
      mintedMicro: 10_000n,
      burnedMicro: 0n,
      genesisAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const budget = contract.emissionBudgetForAge(snapshot);
    expect(budget).toBeGreaterThan(0n);

    const remaining = contract.remainingEmissionBudget(snapshot);
    expect(remaining).toBe(budget - 10_000n);

    // Exhausted budget
    const overSnapshot: KylrixEmissionSnapshot = {
      mintedMicro: budget + 5000n,
      burnedMicro: 0n,
      genesisAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(contract.remainingEmissionBudget(overSnapshot)).toBe(0n);
  });

  describe('decideMintForActivity', () => {
    const validSnapshot: KylrixEmissionSnapshot = {
      mintedMicro: 0n,
      burnedMicro: 0n,
      genesisAt: '2020-01-01T00:00:00.000Z',
    };

    const validSignal: KylrixActivitySignal = {
      activityType: 'note_create',
      uniqueActors: 5,
      trustScore: 50,
      recentSpikeFactorBps: 0,
      accountAgeDays: 30,
      userBaseCount: 200,
    };

    it('denies unsupported activity', () => {
      const res = contract.decideMintForActivity(
        validSnapshot,
        { ...validSignal, activityType: 'unknown_act' as any },
        0n
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('UNSUPPORTED_ACTIVITY');
    });

    it('denies zero or negative unique actors', () => {
      const res = contract.decideMintForActivity(validSnapshot, { ...validSignal, uniqueActors: 0 }, 0n);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('NO_UNIQUE_ACTIVITY');
    });

    it('allows valid minting decision with scale and age boost', () => {
      const res = contract.decideMintForActivity(validSnapshot, validSignal, 0n);
      expect(res.allowed).toBe(true);
      expect(res.amountMicro).toBeGreaterThan(0n);
    });

    it('handles various user base scales', () => {
      const scales = [50, 200, 2000, 20000, 100000];
      scales.forEach((userBaseCount) => {
        const res = contract.decideMintForActivity(validSnapshot, { ...validSignal, userBaseCount }, 0n);
        expect(res.allowed).toBe(true);
      });
    });

    it('applies penalties for low trust, recent activity, thermal score, and low friction activity types', () => {
      const penaltySignal: KylrixActivitySignal = {
        activityType: 'chat_message',
        uniqueActors: 1,
        trustScore: 10, // low trust penalty
        recentSpikeFactorBps: 2000, // spike penalty
        recentActivityCount: 10, // repeat penalty
        accountAgeDays: 5,
        thermalScore: 5, // high thermal penalty
      };
      const res = contract.decideMintForActivity(validSnapshot, penaltySignal, 0n);
      expect(res.tightenBps).toBeDefined();
    });

    it('denies when daily cap reached or limits amount to daily cap', () => {
      const capReachedRes = contract.decideMintForActivity(
        validSnapshot,
        validSignal,
        DEFAULT_KYLRIX_TOKEN_POLICY.dailyMintCapMicro
      );
      expect(capReachedRes.allowed).toBe(false);
      expect(capReachedRes.reason).toBe('USER_DAILY_CAP_REACHED');

      const nearCapRes = contract.decideMintForActivity(
        validSnapshot,
        validSignal,
        DEFAULT_KYLRIX_TOKEN_POLICY.dailyMintCapMicro - 100n
      );
      expect(nearCapRes.allowed).toBe(true);
      expect(nearCapRes.amountMicro).toBeLessThanOrEqual(100n);
    });

    it('denies when emission budget or max supply exhausted', () => {
      const budget = contract.emissionBudgetForAge(validSnapshot);
      const noBudgetSnapshot: KylrixEmissionSnapshot = {
        mintedMicro: budget + 1000n,
        burnedMicro: 0n,
        genesisAt: '2020-01-01T00:00:00.000Z',
      };
      const res = contract.decideMintForActivity(noBudgetSnapshot, validSignal, 0n);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('EMISSION_BUDGET_EXHAUSTED');
    });

    it('denies when max supply reached', () => {
      const maxSupplySnapshot: KylrixEmissionSnapshot = {
        mintedMicro: DEFAULT_KYLRIX_TOKEN_POLICY.maxSupplyMicro,
        burnedMicro: 0n,
        genesisAt: '2020-01-01T00:00:00.000Z',
      };
      const res = contract.decideMintForActivity(maxSupplySnapshot, validSignal, 0n);
      expect(res.allowed).toBe(false);
      expect(['EMISSION_BUDGET_EXHAUSTED', 'MAX_SUPPLY_REACHED']).toContain(res.reason);
    });
  });

  describe('validateTransfer', () => {
    it('invalidates zero or negative transfer amounts', () => {
      expect(contract.validateTransfer(0n)).toEqual({ allowed: false, reason: 'INVALID_TRANSFER_AMOUNT' });
      expect(contract.validateTransfer(-100n)).toEqual({ allowed: false, reason: 'INVALID_TRANSFER_AMOUNT' });
    });

    it('invalidates transfer amounts above single transfer limit', () => {
      const overLimit = DEFAULT_KYLRIX_TOKEN_POLICY.maxSingleTransferMicro + 1n;
      expect(contract.validateTransfer(overLimit)).toEqual({ allowed: false, reason: 'TRANSFER_LIMIT_EXCEEDED' });
    });

    it('validates correct transfer amounts', () => {
      expect(contract.validateTransfer(100n)).toEqual({ allowed: true, reason: null });
    });
  });
});
