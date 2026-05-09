import { ID, Permission, Query, Role } from 'appwrite';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  createKylrixTokenContract,
  DEFAULT_KYLRIX_TOKEN_POLICY,
  type KylrixActivitySignal,
  type KylrixActivityType,
  type KylrixTokenEventType,
} from '@/lib/sdk/token';

const TOKEN_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const TOKEN_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.KYLRIX_TOKEN_LEDGER;
const STATE_ROW_ID = 'state';
const DECIMALS = DEFAULT_KYLRIX_TOKEN_POLICY.decimals;

type TokenRowType = 'event' | 'state';

interface TokenEventPayload {
  txId: string;
  idempotencyKey: string;
  eventType: KylrixTokenEventType;
  userId: string;
  counterpartyUserId?: string | null;
  amountMicro: bigint;
  deltaMicro: bigint;
  balanceAfterMicro?: bigint | null;
  status?: 'pending' | 'settled' | 'rejected';
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface TokenState {
  rowType: 'state';
  txId: string;
  idempotencyKey: string;
  genesisAt: string | null;
  contractVersion: string;
  maxSupplyMicro: string;
  totalMintedMicro: string;
  totalBurnedMicro: string;
  circulatingMicro: string;
  rootBalanceMicro: string;
  riskLevel: 'normal' | 'tightened' | 'critical';
  createdAt: string;
  lastActivityAt: string | null;
  lastSpikeAt: string | null;
  updatedAt: string;
}

const contract = createKylrixTokenContract();

const defaultState = (): TokenState => ({
  rowType: 'state',
  txId: 'state:singleton',
  idempotencyKey: 'state:singleton',
  genesisAt: null,
  contractVersion: 'kylrix-token-v1',
  maxSupplyMicro: contract.policy.maxSupplyMicro.toString(),
  totalMintedMicro: '0',
  totalBurnedMicro: '0',
  circulatingMicro: '0',
  rootBalanceMicro: '0',
  riskLevel: 'normal',
  createdAt: new Date().toISOString(),
  lastActivityAt: null,
  lastSpikeAt: null,
  updatedAt: new Date().toISOString(),
});

const parseMicro = (value: unknown) => {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.floor(value));
    return BigInt(String(value || '0'));
  } catch {
    return 0n;
  }
};

const toMicroString = (value: bigint) => value.toString();

const nowIso = () => new Date().toISOString();

const tokenPermissionsForUser = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
];

/** Mirrors internal ledger: read for `userId`; add counterparty read for paired flows (transfer_out/in, fine/recovery). */
const tokenPermissionsForSystemEvent = (userId: string, counterpartyUserId?: string | null) => {
  const grants = new Set<string>();
  grants.add(Permission.read(Role.user(userId)));
  if (counterpartyUserId) {
    grants.add(Permission.read(Role.user(counterpartyUserId)));
  }
  return Array.from(grants);
};

const statePermissions = [
  Permission.read(Role.users()),
];

async function getStateRow(): Promise<any | null> {
  try {
    return await tablesDB.getRow({
      databaseId: TOKEN_DB_ID,
      tableId: TOKEN_TABLE_ID,
      rowId: STATE_ROW_ID,
    });
  } catch {
    return null;
  }
}

async function ensureStateRow() {
  const existing = await getStateRow();
  if (existing) return existing;
  const state = defaultState();
  return await tablesDB.createRow({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    rowId: STATE_ROW_ID,
    data: state,
    permissions: statePermissions,
  });
}

async function updateStateRow(patch: Partial<TokenState>) {
  const state = await ensureStateRow();
  const next = {
    ...state,
    ...patch,
    updatedAt: nowIso(),
  };
  return await tablesDB.updateRow({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    rowId: STATE_ROW_ID,
    data: next,
  });
}

async function lookupEventByIdempotency(idempotencyKey: string) {
  const result = await tablesDB.listRows({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    queries: [
      Query.equal('rowType', 'event'),
      Query.equal('idempotencyKey', idempotencyKey),
      Query.limit(1),
    ],
  });
  return result.rows?.[0] || null;
}

async function listUserLedgerEventsDescending(userId: string, limit: number) {
  const base = [Query.equal('rowType', 'event'), Query.equal('userId', userId)];
  try {
    const result = await tablesDB.listRows({
      databaseId: TOKEN_DB_ID,
      tableId: TOKEN_TABLE_ID,
      queries: [...base, Query.orderDesc('$createdAt'), Query.limit(limit)],
    });
    return result.rows ?? [];
  } catch {
    const result = await tablesDB.listRows({
      databaseId: TOKEN_DB_ID,
      tableId: TOKEN_TABLE_ID,
      queries: [...base, Query.orderDesc('createdAt'), Query.limit(limit)],
    });
    return result.rows ?? [];
  }
}

async function getUserLatestBalanceMicro(userId: string) {
  const rows = await listUserLedgerEventsDescending(userId, 200);
  for (const row of rows) {
    const bal = (row as { balanceAfterMicro?: unknown }).balanceAfterMicro;
    if (bal === null || bal === undefined) continue;
    if (String(bal).trim() === '') continue;
    return parseMicro(bal);
  }
  return 0n;
}

async function getUserDailyMintedMicro(userId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const result = await tablesDB.listRows({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    queries: [
      Query.equal('rowType', 'event'),
      Query.equal('userId', userId),
      Query.equal('eventType', 'mint_activity'),
      Query.greaterThanEqual('createdAt', since.toISOString()),
      Query.limit(5000),
    ],
  });
  return (result.rows || []).reduce((sum: bigint, row: any) => sum + parseMicro(row.amountMicro), 0n);
}

async function getRecentVolume(windowMinutes: number) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const result = await tablesDB.listRows({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    queries: [
      Query.equal('rowType', 'event'),
      Query.greaterThanEqual('createdAt', since),
      Query.limit(5000),
    ],
  });
  return result.rows?.length || 0;
}

async function getUserRecentOperationCount(userId: string, windowMinutes: number) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const result = await tablesDB.listRows({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    queries: [
      Query.equal('rowType', 'event'),
      Query.equal('userId', userId),
      Query.greaterThanEqual('createdAt', since),
      Query.limit(5000),
    ],
  });
  return result.rows?.length || 0;
}

async function appendEvent(payload: TokenEventPayload) {
  const existing = await lookupEventByIdempotency(payload.idempotencyKey);
  if (existing) return existing;

  const createdAt = nowIso();
  const row = await tablesDB.createRow({
    databaseId: TOKEN_DB_ID,
    tableId: TOKEN_TABLE_ID,
    rowId: ID.unique(),
    data: {
      rowType: 'event' satisfies TokenRowType,
      txId: payload.txId,
      idempotencyKey: payload.idempotencyKey,
      eventType: payload.eventType,
      userId: payload.userId,
      counterpartyUserId: payload.counterpartyUserId || null,
      amountMicro: toMicroString(payload.amountMicro),
      deltaMicro: toMicroString(payload.deltaMicro),
      balanceAfterMicro:
        payload.balanceAfterMicro === null || payload.balanceAfterMicro === undefined
          ? null
          : toMicroString(payload.balanceAfterMicro),
      status: payload.status || 'settled',
      sourceType: payload.sourceType || null,
      sourceId: payload.sourceId || null,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      createdAt,
    },
    permissions: tokenPermissionsForSystemEvent(payload.userId, payload.counterpartyUserId || null),
  });
  return row;
}

function toDisplayToken(amountMicro: bigint) {
  const negative = amountMicro < 0n;
  const value = negative ? amountMicro * -1n : amountMicro;
  const divisor = 10n ** BigInt(DECIMALS);
  const intPart = value / divisor;
  const fracPart = (value % divisor).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  const formatted = fracPart ? `${intPart.toString()}.${fracPart}` : intPart.toString();
  return `${negative ? '-' : ''}${formatted}`;
}

export const KylrixTokenService = {
  contract,

  async getState() {
    return await ensureStateRow();
  },

  async getSystemOverview() {
    const state = await ensureStateRow();
    return {
      symbol: contract.policy.symbol,
      decimals: contract.policy.decimals,
      maxSupplyMicro: state.maxSupplyMicro,
      totalMintedMicro: state.totalMintedMicro,
      totalBurnedMicro: state.totalBurnedMicro,
      circulatingMicro: state.circulatingMicro,
      rootBalanceMicro: state.rootBalanceMicro,
      genesisAt: state.genesisAt,
      riskLevel: state.riskLevel,
      contractVersion: state.contractVersion,
    };
  },

  async getUserBalance(userId: string) {
    const micro = await getUserLatestBalanceMicro(userId);
    return {
      amountMicro: micro.toString(),
      amount: toDisplayToken(micro),
      symbol: contract.policy.symbol,
    };
  },

  async mintForActivity(input: {
    userId: string;
    idempotencyKey: string;
    activityType: KylrixActivityType;
    uniqueActors: number;
    trustScore: number;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
    const state = await ensureStateRow();
    const recentVolume = await getRecentVolume(contract.policy.spikeWindowMinutes);
    const userDailyMintedMicro = await getUserDailyMintedMicro(input.userId);
    const snapshot = {
      mintedMicro: parseMicro(state.totalMintedMicro),
      burnedMicro: parseMicro(state.totalBurnedMicro),
      genesisAt: state.genesisAt || null,
      nowIso: nowIso(),
    };

    const signal: KylrixActivitySignal = {
      activityType: input.activityType,
      uniqueActors: input.uniqueActors,
      trustScore: input.trustScore,
      recentSpikeFactorBps:
        recentVolume >= contract.policy.spikeEventThreshold ? contract.policy.spikeTightenBps : 0,
      accountAgeDays: 0,
    };

    const decision = contract.decideMintForActivity(snapshot, signal, userDailyMintedMicro);
    if (!decision.allowed) {
      return {
        accepted: false,
        reason: decision.reason,
        amountMicro: '0',
        amount: '0',
      };
    }

    const currentBalanceMicro = await getUserLatestBalanceMicro(input.userId);
    const nextBalanceMicro = currentBalanceMicro + decision.amountMicro;
    const txId = `mint:${input.userId}:${input.sourceType}:${input.sourceId}:${input.idempotencyKey}`;
    const event = await appendEvent({
      txId,
      idempotencyKey: input.idempotencyKey,
      eventType: 'mint_activity',
      userId: input.userId,
      amountMicro: decision.amountMicro,
      deltaMicro: decision.amountMicro,
      balanceAfterMicro: nextBalanceMicro,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: {
        activityType: input.activityType,
        uniqueActors: input.uniqueActors,
        trustScore: input.trustScore,
        tightenBps: decision.tightenBps,
        ...input.metadata,
      },
    });

    const nextMinted = parseMicro(state.totalMintedMicro) + decision.amountMicro;
    const nextBurned = parseMicro(state.totalBurnedMicro);
    const nextCirculating = nextMinted - nextBurned;
    const isFirstMint = !state.genesisAt && nextMinted > 0n;
    const riskLevel = recentVolume >= contract.policy.spikeEventThreshold ? 'tightened' : 'normal';
    await updateStateRow({
      genesisAt: isFirstMint ? nowIso() : state.genesisAt || null,
      totalMintedMicro: nextMinted.toString(),
      totalBurnedMicro: nextBurned.toString(),
      circulatingMicro: nextCirculating.toString(),
      riskLevel,
      lastActivityAt: nowIso(),
      lastSpikeAt: riskLevel !== 'normal' ? nowIso() : state.lastSpikeAt || null,
    });

    return {
      accepted: true,
      event,
      amountMicro: decision.amountMicro.toString(),
      amount: toDisplayToken(decision.amountMicro),
      symbol: contract.policy.symbol,
    };
  },

  async transfer(input: {
    fromUserId: string;
    toUserId: string;
    amount: string;
    idempotencyKey: string;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
    const amountMicro = parseMicro(input.amount);
    const transferCheck = contract.validateTransfer(amountMicro);
    if (!transferCheck.allowed) {
      return { accepted: false, reason: transferCheck.reason };
    }
    if (input.fromUserId === input.toUserId) {
      return { accepted: false, reason: 'SELF_TRANSFER_NOT_ALLOWED' };
    }

    const fromBalance = await getUserLatestBalanceMicro(input.fromUserId);
    if (fromBalance < amountMicro) {
      return { accepted: false, reason: 'INSUFFICIENT_BALANCE' };
    }

    const toBalance = await getUserLatestBalanceMicro(input.toUserId);
    const transferTxId = `transfer:${input.fromUserId}:${input.toUserId}:${input.sourceId}:${input.idempotencyKey}`;

    const debit = await appendEvent({
      txId: `${transferTxId}:out`,
      idempotencyKey: `${input.idempotencyKey}:out`,
      eventType: 'transfer_out',
      userId: input.fromUserId,
      counterpartyUserId: input.toUserId,
      amountMicro,
      deltaMicro: amountMicro * -1n,
      balanceAfterMicro: fromBalance - amountMicro,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });

    const credit = await appendEvent({
      txId: `${transferTxId}:in`,
      idempotencyKey: `${input.idempotencyKey}:in`,
      eventType: 'transfer_in',
      userId: input.toUserId,
      counterpartyUserId: input.fromUserId,
      amountMicro,
      deltaMicro: amountMicro,
      balanceAfterMicro: toBalance + amountMicro,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });

    await updateStateRow({ lastActivityAt: nowIso() });
    return {
      accepted: true,
      debit,
      credit,
      amountMicro: amountMicro.toString(),
      amount: toDisplayToken(amountMicro),
      symbol: contract.policy.symbol,
    };
  },

  async listUserLedger(userId: string, limit = 100) {
    const capped = Math.max(1, Math.min(limit, 500));
    const base = [Query.equal('rowType', 'event'), Query.equal('userId', userId)];
    try {
      const result = await tablesDB.listRows({
        databaseId: TOKEN_DB_ID,
        tableId: TOKEN_TABLE_ID,
        queries: [...base, Query.orderDesc('$createdAt'), Query.limit(capped)],
      });
      return result.rows || [];
    } catch {
      const result = await tablesDB.listRows({
        databaseId: TOKEN_DB_ID,
        tableId: TOKEN_TABLE_ID,
        queries: [...base, Query.orderDesc('createdAt'), Query.limit(capped)],
      });
      return result.rows || [];
    }
  },

  async evaluateUserRisk(userId: string) {
    const recentOps = await getUserRecentOperationCount(userId, 15);
    const recentMints = await getUserDailyMintedMicro(userId);
    const opSpike = recentOps > 250;
    const mintSpike = recentMints > contract.policy.dailyMintCapMicro / 2n;
    return {
      userId,
      suspicious: opSpike || mintSpike,
      reasons: [
        ...(opSpike ? ['HIGH_OPERATION_RATE'] : []),
        ...(mintSpike ? ['HIGH_MINT_CONCENTRATION'] : []),
      ],
    };
  },

  async applyFineToRoot(input: {
    userId: string;
    amount: string;
    idempotencyKey: string;
    reason: string;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
    const amountMicro = parseMicro(input.amount);
    if (amountMicro <= 0n) return { accepted: false, reason: 'INVALID_FINE_AMOUNT' };

    const userBalance = await getUserLatestBalanceMicro(input.userId);
    const actualFine = userBalance >= amountMicro ? amountMicro : userBalance;
    if (actualFine <= 0n) return { accepted: false, reason: 'USER_BALANCE_ZERO' };

    const rootBalance = await getUserLatestBalanceMicro(contract.policy.rootWalletId);
    const txBase = `fine:${input.userId}:${input.sourceId}:${input.idempotencyKey}`;

    const debit = await appendEvent({
      txId: `${txBase}:user`,
      idempotencyKey: `${input.idempotencyKey}:fine-user`,
      eventType: 'fine',
      userId: input.userId,
      counterpartyUserId: contract.policy.rootWalletId,
      amountMicro: actualFine,
      deltaMicro: actualFine * -1n,
      balanceAfterMicro: userBalance - actualFine,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { reason: input.reason, ...input.metadata },
    });

    const credit = await appendEvent({
      txId: `${txBase}:root`,
      idempotencyKey: `${input.idempotencyKey}:fine-root`,
      eventType: 'recovery',
      userId: contract.policy.rootWalletId,
      counterpartyUserId: input.userId,
      amountMicro: actualFine,
      deltaMicro: actualFine,
      balanceAfterMicro: rootBalance + actualFine,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { reason: input.reason, ...input.metadata },
    });

    await updateStateRow({
      rootBalanceMicro: (rootBalance + actualFine).toString(),
      lastActivityAt: nowIso(),
    });

    return {
      accepted: true,
      debit,
      credit,
      finedAmountMicro: actualFine.toString(),
      finedAmount: toDisplayToken(actualFine),
      symbol: contract.policy.symbol,
    };
  },

  async lockClaim(input: {
    userId: string;
    amount: string;
    destinationWallet: string;
    chain: string;
    idempotencyKey: string;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
    const amountMicro = parseMicro(input.amount);
    if (amountMicro <= 0n) return { accepted: false, reason: 'INVALID_CLAIM_AMOUNT' };

    const userBalance = await getUserLatestBalanceMicro(input.userId);
    if (userBalance < amountMicro) return { accepted: false, reason: 'INSUFFICIENT_BALANCE' };

    const nextBalance = userBalance - amountMicro;
    const event = await appendEvent({
      txId: `claim-lock:${input.userId}:${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      eventType: 'claim_lock',
      userId: input.userId,
      amountMicro,
      deltaMicro: amountMicro * -1n,
      balanceAfterMicro: nextBalance,
      status: 'pending',
      sourceType: 'claim',
      sourceId: input.destinationWallet,
      metadata: {
        destinationWallet: input.destinationWallet,
        chain: input.chain,
      },
    });

    return {
      accepted: true,
      event,
      lockedAmountMicro: amountMicro.toString(),
      lockedAmount: toDisplayToken(amountMicro),
    };
  },

  async settleClaim(input: {
    userId: string;
    amount: string;
    destinationWallet: string;
    chain: string;
    onchainTxHash: string;
    idempotencyKey: string;
  }) {
    throw new Error('SERVER_ONLY_TOKEN_OPERATIONS: use InternalKylrixTokenService via secure in-code operations');
    const amountMicro = parseMicro(input.amount);
    if (amountMicro <= 0n) return { accepted: false, reason: 'INVALID_CLAIM_AMOUNT' };

    const state = await ensureStateRow();
    const nextBurned = parseMicro(state.totalBurnedMicro) + amountMicro;
    const nextMinted = parseMicro(state.totalMintedMicro);
    const nextCirculating = nextMinted - nextBurned;

    const event = await appendEvent({
      txId: `claim-settled:${input.userId}:${input.onchainTxHash}`,
      idempotencyKey: input.idempotencyKey,
      eventType: 'claim_settled',
      userId: input.userId,
      amountMicro,
      deltaMicro: 0n,
      status: 'settled',
      sourceType: 'claim',
      sourceId: input.destinationWallet,
      metadata: {
        destinationWallet: input.destinationWallet,
        chain: input.chain,
        onchainTxHash: input.onchainTxHash,
      },
    });

    await updateStateRow({
      totalBurnedMicro: nextBurned.toString(),
      circulatingMicro: nextCirculating.toString(),
      lastActivityAt: nowIso(),
    });

    return {
      accepted: true,
      event,
      settledAmountMicro: amountMicro.toString(),
      settledAmount: toDisplayToken(amountMicro),
      onchainTxHash: input.onchainTxHash,
    };
  },
};
