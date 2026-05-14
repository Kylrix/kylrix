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
  | 'note_create'
  | 'share_public_note_moment'
  | 'chat_message'
  | 'call_initiate'
  | 'call_participate'
  | 'comment_add'
  | 'group_chat_create'
  | 'first_reply_to_stranger'
  | 'referral_signup'
  | 'referral_engagement_30d'
  | 'content_featured'
  | 'daily_login'
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
  thermalScore?: number;  // NEW: 0 to 5
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
  daily_login: 50_000n,          // 0.05
  note_view: 25_000n,            // 0.025
  note_create: 80_000n,          // 0.08
  share_public_note_moment: 650_000n,  // 0.65
  chat_message: 40_000n,         // 0.04
  call_initiate: 200_000n,       // 0.2
  call_participate: 150_000n,    // 0.15
  comment_add: 35_000n,          // 0.035
  group_chat_create: 120_000n,   // 0.12
  first_reply_to_stranger: 100_000n,   // 0.1
  referral_signup: 1_500_000n,   // 1.5
  referral_engagement_30d: 500_000n,   // 0.5
  content_featured: 300_000n,    // 0.3
  moderation: 120_000n,          // 0.12
};

const clampBps = (bps: number) => {
  if (!Number.isFinite(bps)) return 0;
  return Math.max(0, Math.min(10_000, Math.floor(bps)));
};

const applyBps = (value: bigint, bps: number) => (value * BigInt(clampBps(bps))) / 10_000n;

export function createKylrixTokenContract(policy: KylrixTokenPolicy = DEFAULT_KYLRIX_TOKEN_POLICY) {
  const normalizeMicro = (value: bigint) => (value < 0n ? 0n : value);

  const computeThermalScore = (recentEvents: any[]): number => {
    // recentEvents = last 5 mints for the user
    if (!recentEvents || recentEvents.length === 0) return 0;
    
    let thermal = 0;
    const now = Date.now();
    for (const evt of recentEvents) {
      const ageMs = now - new Date(evt.createdAt).getTime();
      const ageSecs = Math.max(1, ageMs / 1000);
      // Exponential decay: e^(-t/3600) means 37% remaining after 1h
      thermal += Math.exp(-ageSecs / 3600);
    }
    return thermal; // 0 = cold, 5 = very hot
  };

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

  const computeTightenBps = (signal: KylrixActivitySignal, thermal: number) => {
    const spikePenalty = Math.min(policy.spikeTightenBps, Math.max(0, signal.recentSpikeFactorBps));
    const lowTrustPenalty = signal.trustScore < policy.reputationFloor ? 1500 : 0;
    const repeatPenalty = Math.min(5500, Math.max(0, (signal.recentActivityCount || 0) * 900));
    const thermalPenalty = Math.min(7000, Math.floor(thermal * 1500)); // New: -70% max if hot
    const ageBoost = signal.accountAgeDays >= 60 ? 800 : signal.accountAgeDays >= 14 ? 300 : 0;
    
    // Activity-specific penalties for low-friction activities (prevent spam)
    const activityPenalty = (
      signal.activityType === 'chat_message' ? 800 :
      signal.activityType === 'note_view' ? 600 :
      signal.activityType === 'daily_login' ? 200 :
      0
    );
    
    const tighten = clampBps(10_000 - spikePenalty - lowTrustPenalty - repeatPenalty - thermalPenalty - activityPenalty + ageBoost);
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

    const uniqueActorBoostBps = Math.min(8000, signal.uniqueActors * 120); // Slightly increase base boost
    const userBase = Math.max(1, signal.userBaseCount || 1);
    const networkScaleBps = 
      userBase <= 100 ? 4000 :      // Early: +40% bonus (attract first users)
      userBase <= 500 ? 2500 :      // Growth: +25% bonus
      userBase <= 5000 ? 1000 :     // Established: +10% bonus
      userBase <= 50000 ? -500 :    // Scale: -5% reduction
      -2000;                        // Mature: -20% reduction

    const boosted = applyBps(base, Math.max(2000, 10_000 + uniqueActorBoostBps + networkScaleBps));
    const tightenBps = computeTightenBps(signal, signal.thermalScore || 0);
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
