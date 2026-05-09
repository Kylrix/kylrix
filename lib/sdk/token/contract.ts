export type KylrixTokenEventType =
  | 'mint_activity'
  | 'transfer_out'
  | 'transfer_in'
  | 'fine'
  | 'recovery'
  | 'claim_lock'
  | 'claim_settled'
  | 'burn';

export type KylrixActivityType =
  | 'note_view'
  | 'share_public_note_moment'
  | 'chat_message'
  | 'call_participation'
  | 'comment'
  | 'moderation';

export interface KylrixTokenPolicy {
  symbol: '$KYLRIX';
  decimals: number;
  microUnit: bigint;
  maxSupplyMicro: bigint;
  yearlyEmissionBps: number;
  dailyMintCapMicro: bigint;
  maxSingleTransferMicro: bigint;
  spikeWindowMinutes: number;
  spikeEventThreshold: number;
  spikeTightenBps: number;
  reputationFloor: number;
  rootWalletId: string;
}

export interface KylrixActivitySignal {
  activityType: KylrixActivityType;
  uniqueActors: number;
  trustScore: number;
  recentSpikeFactorBps: number;
  accountAgeDays: number;
  userBaseCount?: number;
  recentActivityCount?: number;
}

export interface KylrixEmissionSnapshot {
  mintedMicro: bigint;
  burnedMicro: bigint;
  genesisAt: string | null;
  nowIso?: string;
}

export interface KylrixContractDecision {
  allowed: boolean;
  reason: string | null;
  amountMicro: bigint;
  tightenBps: number;
}

export const DEFAULT_KYLRIX_TOKEN_POLICY: KylrixTokenPolicy = {
  symbol: '$KYLRIX',
  decimals: 6,
  microUnit: 1_000_000n,
  maxSupplyMicro: 100_000_000n * 1_000_000n,
  yearlyEmissionBps: 1000, // 10% of max supply target per year.
  dailyMintCapMicro: 300_000n * 1_000_000n,
  maxSingleTransferMicro: 200_000n * 1_000_000n,
  spikeWindowMinutes: 30,
  spikeEventThreshold: 2_000,
  spikeTightenBps: 4000, // up to -40% rewards during detected spikes.
  reputationFloor: 20,
  rootWalletId: 'system:root',
};

const ACTIVITY_BASE_REWARD_MICRO: Record<KylrixActivityType, bigint> = {
  note_view: 25_000n, // 0.025
  share_public_note_moment: 650_000n, // 0.65
  chat_message: 15_000n, // 0.015
  call_participation: 70_000n, // 0.07
  comment: 20_000n, // 0.02
  moderation: 120_000n, // 0.12
};

const clampBps = (bps: number) => {
  if (!Number.isFinite(bps)) return 0;
  return Math.max(0, Math.min(10_000, Math.floor(bps)));
};

const applyBps = (value: bigint, bps: number) => (value * BigInt(clampBps(bps))) / 10_000n;

export function createKylrixTokenContract(policy: KylrixTokenPolicy = DEFAULT_KYLRIX_TOKEN_POLICY) {
  const normalizeMicro = (value: bigint) => (value < 0n ? 0n : value);

  const circulatingMicro = (snapshot: KylrixEmissionSnapshot) =>
    normalizeMicro(snapshot.mintedMicro - snapshot.burnedMicro);

  const getAgeDays = (snapshot: KylrixEmissionSnapshot) => {
    if (!snapshot.genesisAt) return 0;
    const start = new Date(snapshot.genesisAt).getTime();
    if (!Number.isFinite(start) || start <= 0) return 0;
    const end = new Date(snapshot.nowIso || new Date().toISOString()).getTime();
    const diff = Math.max(0, end - start);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const emissionBudgetForAge = (snapshot: KylrixEmissionSnapshot) => {
    const ageDays = Math.max(1, getAgeDays(snapshot));
    const perYear = applyBps(policy.maxSupplyMicro, policy.yearlyEmissionBps);
    const budget = (perYear * BigInt(ageDays)) / 365n;
    return normalizeMicro(budget);
  };

  const remainingEmissionBudget = (snapshot: KylrixEmissionSnapshot) => {
    const budget = emissionBudgetForAge(snapshot);
    const used = normalizeMicro(snapshot.mintedMicro);
    if (used >= budget) return 0n;
    return budget - used;
  };

  const computeTightenBps = (signal: KylrixActivitySignal) => {
    const spikePenalty = Math.min(policy.spikeTightenBps, Math.max(0, signal.recentSpikeFactorBps));
    const lowTrustPenalty = signal.trustScore < policy.reputationFloor ? 1500 : 0;
    const repeatPenalty = Math.min(5500, Math.max(0, (signal.recentActivityCount || 0) * 900));
    const ageBoost = signal.accountAgeDays >= 60 ? 800 : signal.accountAgeDays >= 14 ? 300 : 0;
    const tighten = clampBps(10_000 - spikePenalty - lowTrustPenalty - repeatPenalty + ageBoost);
    return tighten;
  };

  const decideMintForActivity = (
    snapshot: KylrixEmissionSnapshot,
    signal: KylrixActivitySignal,
    userDailyMintedMicro: bigint
  ): KylrixContractDecision => {
    const base = ACTIVITY_BASE_REWARD_MICRO[signal.activityType] || 0n;
    if (base <= 0n) {
      return { allowed: false, reason: 'UNSUPPORTED_ACTIVITY', amountMicro: 0n, tightenBps: 0 };
    }
    if (signal.uniqueActors <= 0) {
      return { allowed: false, reason: 'NO_UNIQUE_ACTIVITY', amountMicro: 0n, tightenBps: 0 };
    }

    const uniqueActorBoostBps = Math.min(5000, signal.uniqueActors * 70);
    const userBase = Math.max(1, signal.userBaseCount || 1);
    const networkScaleBps = userBase <= 500 ? 2500 : userBase <= 2_000 ? 1400 : userBase <= 10_000 ? 500 : -1200;
    const boosted = applyBps(base, Math.max(2000, 10_000 + uniqueActorBoostBps + networkScaleBps));
    const tightenBps = computeTightenBps(signal);
    let amount = applyBps(boosted, tightenBps);

    if (amount <= 0n) {
      return { allowed: false, reason: 'AMOUNT_ZERO_AFTER_TIGHTEN', amountMicro: 0n, tightenBps };
    }

    const remainingDaily = userDailyMintedMicro >= policy.dailyMintCapMicro ? 0n : policy.dailyMintCapMicro - userDailyMintedMicro;
    if (remainingDaily <= 0n) {
      return { allowed: false, reason: 'USER_DAILY_CAP_REACHED', amountMicro: 0n, tightenBps };
    }
    if (amount > remainingDaily) {
      amount = remainingDaily;
    }

    const remainingBudget = remainingEmissionBudget(snapshot);
    if (remainingBudget <= 0n) {
      return { allowed: false, reason: 'EMISSION_BUDGET_EXHAUSTED', amountMicro: 0n, tightenBps };
    }
    if (amount > remainingBudget) {
      amount = remainingBudget;
    }

    if (snapshot.mintedMicro + amount > policy.maxSupplyMicro) {
      amount = policy.maxSupplyMicro - snapshot.mintedMicro;
    }

    if (amount <= 0n) {
      return { allowed: false, reason: 'MAX_SUPPLY_REACHED', amountMicro: 0n, tightenBps };
    }

    return { allowed: true, reason: null, amountMicro: amount, tightenBps };
  };

  const validateTransfer = (amountMicro: bigint) => {
    if (amountMicro <= 0n) {
      return { allowed: false, reason: 'INVALID_TRANSFER_AMOUNT' };
    }
    if (amountMicro > policy.maxSingleTransferMicro) {
      return { allowed: false, reason: 'TRANSFER_LIMIT_EXCEEDED' };
    }
    return { allowed: true, reason: null };
  };

  return {
    policy,
    circulatingMicro,
    getAgeDays,
    emissionBudgetForAge,
    remainingEmissionBudget,
    decideMintForActivity,
    validateTransfer,
  };
}
