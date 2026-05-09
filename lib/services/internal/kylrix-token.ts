import { ID, Permission, Query, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  createKylrixTokenContract,
  type KylrixActivitySignal,
  type KylrixActivityType,
  type KylrixTokenEventType,
} from '@/lib/sdk/token';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.KYLRIX_TOKEN_LEDGER;
const STATE_ROW_ID = 'state';

const contract = createKylrixTokenContract();

interface TokenStateRow {
  $id: string;
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

const nowIso = () => new Date().toISOString();
const asMicro = (v: unknown) => {
  try {
    return BigInt(String(v ?? '0'));
  } catch {
    return 0n;
  }
};

const toMicro = (v: bigint) => v.toString();
const toToken = (micro: bigint) => (Number(micro) / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
const isInitialized = (row: any): row is TokenStateRow => Boolean(row && row.rowType === 'state');

function tokenReadPermissions(userId: string, counterpartyUserId?: string | null) {
  const perms = new Set<string>();
  perms.add(Permission.read(Role.user(userId)));
  if (counterpartyUserId) perms.add(Permission.read(Role.user(counterpartyUserId)));
  return Array.from(perms);
}

async function getStateRow() {
  const { databases } = createAdminClient();
  try {
    return await databases.getDocument(DB_ID, TABLE_ID, STATE_ROW_ID);
  } catch {
    return null;
  }
}

async function requireStateRow() {
  const state = await getStateRow();
  if (!isInitialized(state)) {
    throw new Error('TOKEN_NOT_INITIALIZED');
  }
  return state;
}

async function updateStateRow(patch: Partial<TokenStateRow>) {
  const { databases } = createAdminClient();
  const current = await requireStateRow();
  return databases.updateDocument(DB_ID, TABLE_ID, STATE_ROW_ID, {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  });
}

async function getLatestBalanceMicro(userId: string) {
  const { databases } = createAdminClient();
  const rows = await databases.listDocuments(DB_ID, TABLE_ID, [
    Query.equal('rowType', 'event'),
    Query.equal('userId', userId),
    Query.orderDesc('createdAt'),
    Query.limit(1),
  ]);
  const row = rows.documents[0] as any;
  if (!row) return 0n;
  return asMicro(row.balanceAfterMicro);
}

async function getUserDailyMinted(userId: string) {
  const { databases } = createAdminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const rows = await databases.listDocuments(DB_ID, TABLE_ID, [
    Query.equal('rowType', 'event'),
    Query.equal('userId', userId),
    Query.equal('eventType', 'mint_activity'),
    Query.greaterThanEqual('createdAt', since.toISOString()),
    Query.limit(5000),
  ]);
  return rows.documents.reduce((sum, doc: any) => sum + asMicro(doc.amountMicro), 0n);
}

async function getRecentSystemVolume(windowMinutes: number) {
  const { databases } = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const rows = await databases.listDocuments(DB_ID, TABLE_ID, [
    Query.equal('rowType', 'event'),
    Query.greaterThanEqual('createdAt', since),
    Query.limit(5000),
  ]);
  return rows.documents.length;
}

async function ensureNoDuplicateIdempotency(idempotencyKey: string) {
  const { databases } = createAdminClient();
  const rows = await databases.listDocuments(DB_ID, TABLE_ID, [
    Query.equal('rowType', 'event'),
    Query.equal('idempotencyKey', idempotencyKey),
    Query.limit(1),
  ]);
  return rows.documents[0] || null;
}

async function appendEvent(input: {
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
}) {
  const { databases } = createAdminClient();
  const existing = await ensureNoDuplicateIdempotency(input.idempotencyKey);
  if (existing) return existing;

  return databases.createDocument(
    DB_ID,
    TABLE_ID,
    ID.unique(),
    {
      rowType: 'event',
      txId: input.txId,
      idempotencyKey: input.idempotencyKey,
      eventType: input.eventType,
      userId: input.userId,
      counterpartyUserId: input.counterpartyUserId || null,
      amountMicro: toMicro(input.amountMicro),
      deltaMicro: toMicro(input.deltaMicro),
      balanceAfterMicro:
        input.balanceAfterMicro === null || input.balanceAfterMicro === undefined
          ? null
          : toMicro(input.balanceAfterMicro),
      status: input.status || 'settled',
      sourceType: input.sourceType || null,
      sourceId: input.sourceId || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: nowIso(),
    },
    tokenReadPermissions(input.userId, input.counterpartyUserId),
  );
}

export const InternalKylrixTokenService = {
  async getState() {
    const state = await getStateRow();
    return {
      initialized: isInitialized(state),
      state: state || null,
    };
  },

  async initializeState() {
    const { databases } = createAdminClient();
    const existing = await getStateRow();
    if (isInitialized(existing)) return existing;

    const timestamp = nowIso();
    return databases.createDocument(
      DB_ID,
      TABLE_ID,
      STATE_ROW_ID,
      {
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
        createdAt: timestamp,
        lastActivityAt: null,
        lastSpikeAt: null,
        updatedAt: timestamp,
      },
      [Permission.read(Role.users())],
    );
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
    const state = await requireStateRow();
    const recentVolume = await getRecentSystemVolume(contract.policy.spikeWindowMinutes);
    const userDailyMinted = await getUserDailyMinted(input.userId);
    const signal: KylrixActivitySignal = {
      activityType: input.activityType,
      uniqueActors: input.uniqueActors,
      trustScore: input.trustScore,
      recentSpikeFactorBps: recentVolume >= contract.policy.spikeEventThreshold ? contract.policy.spikeTightenBps : 0,
      accountAgeDays: 0,
    };

    const decision = contract.decideMintForActivity(
      {
        mintedMicro: asMicro(state.totalMintedMicro),
        burnedMicro: asMicro(state.totalBurnedMicro),
        genesisAt: state.genesisAt || null,
        nowIso: nowIso(),
      },
      signal,
      userDailyMinted,
    );
    if (!decision.allowed) return { accepted: false, reason: decision.reason };

    const currentBalance = await getLatestBalanceMicro(input.userId);
    const nextBalance = currentBalance + decision.amountMicro;
    const event = await appendEvent({
      txId: `mint:${input.userId}:${input.sourceType}:${input.sourceId}:${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      eventType: 'mint_activity',
      userId: input.userId,
      amountMicro: decision.amountMicro,
      deltaMicro: decision.amountMicro,
      balanceAfterMicro: nextBalance,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: {
        activityType: input.activityType,
        uniqueActors: input.uniqueActors,
        trustScore: input.trustScore,
        tightenBps: decision.tightenBps,
        ...(input.metadata || {}),
      },
    });

    const minted = asMicro(state.totalMintedMicro) + decision.amountMicro;
    const burned = asMicro(state.totalBurnedMicro);
    await updateStateRow({
      genesisAt: state.genesisAt || (minted > 0n ? nowIso() : null),
      totalMintedMicro: toMicro(minted),
      totalBurnedMicro: toMicro(burned),
      circulatingMicro: toMicro(minted - burned),
      lastActivityAt: nowIso(),
      riskLevel: recentVolume >= contract.policy.spikeEventThreshold ? 'tightened' : 'normal',
      lastSpikeAt: recentVolume >= contract.policy.spikeEventThreshold ? nowIso() : state.lastSpikeAt,
    });

    return {
      accepted: true,
      event,
      amountMicro: toMicro(decision.amountMicro),
      amount: toToken(decision.amountMicro),
      symbol: contract.policy.symbol,
    };
  },

  async transfer(input: {
    fromUserId: string;
    toUserId: string;
    amountMicro: string;
    idempotencyKey: string;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    await requireStateRow();
    const amount = asMicro(input.amountMicro);
    const valid = contract.validateTransfer(amount);
    if (!valid.allowed) return { accepted: false, reason: valid.reason };
    if (input.fromUserId === input.toUserId) return { accepted: false, reason: 'SELF_TRANSFER_NOT_ALLOWED' };

    const fromBalance = await getLatestBalanceMicro(input.fromUserId);
    if (fromBalance < amount) return { accepted: false, reason: 'INSUFFICIENT_BALANCE' };
    const toBalance = await getLatestBalanceMicro(input.toUserId);
    const tx = `transfer:${input.fromUserId}:${input.toUserId}:${input.sourceId}:${input.idempotencyKey}`;

    const debit = await appendEvent({
      txId: `${tx}:out`,
      idempotencyKey: `${input.idempotencyKey}:out`,
      eventType: 'transfer_out',
      userId: input.fromUserId,
      counterpartyUserId: input.toUserId,
      amountMicro: amount,
      deltaMicro: -amount,
      balanceAfterMicro: fromBalance - amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });
    const credit = await appendEvent({
      txId: `${tx}:in`,
      idempotencyKey: `${input.idempotencyKey}:in`,
      eventType: 'transfer_in',
      userId: input.toUserId,
      counterpartyUserId: input.fromUserId,
      amountMicro: amount,
      deltaMicro: amount,
      balanceAfterMicro: toBalance + amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata,
    });

    await updateStateRow({ lastActivityAt: nowIso() });
    return { accepted: true, debit, credit, amountMicro: toMicro(amount), amount: toToken(amount), symbol: contract.policy.symbol };
  },

  async fineToRoot(input: {
    userId: string;
    amountMicro: string;
    idempotencyKey: string;
    reason: string;
    sourceType: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    const state = await requireStateRow();
    const amount = asMicro(input.amountMicro);
    if (amount <= 0n) return { accepted: false, reason: 'INVALID_FINE_AMOUNT' };

    const userBalance = await getLatestBalanceMicro(input.userId);
    const fineAmount = userBalance >= amount ? amount : userBalance;
    if (fineAmount <= 0n) return { accepted: false, reason: 'USER_BALANCE_ZERO' };

    const rootId = contract.policy.rootWalletId;
    const rootBalance = await getLatestBalanceMicro(rootId);
    const tx = `fine:${input.userId}:${input.sourceId}:${input.idempotencyKey}`;

    const debit = await appendEvent({
      txId: `${tx}:user`,
      idempotencyKey: `${input.idempotencyKey}:fine-user`,
      eventType: 'fine',
      userId: input.userId,
      counterpartyUserId: rootId,
      amountMicro: fineAmount,
      deltaMicro: -fineAmount,
      balanceAfterMicro: userBalance - fineAmount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { reason: input.reason, ...(input.metadata || {}) },
    });

    const credit = await appendEvent({
      txId: `${tx}:root`,
      idempotencyKey: `${input.idempotencyKey}:fine-root`,
      eventType: 'recovery',
      userId: rootId,
      counterpartyUserId: input.userId,
      amountMicro: fineAmount,
      deltaMicro: fineAmount,
      balanceAfterMicro: rootBalance + fineAmount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: { reason: input.reason, ...(input.metadata || {}) },
    });

    await updateStateRow({
      rootBalanceMicro: toMicro(rootBalance + fineAmount),
      lastActivityAt: nowIso(),
      riskLevel: state.riskLevel,
    });

    return {
      accepted: true,
      debit,
      credit,
      finedAmountMicro: toMicro(fineAmount),
      finedAmount: toToken(fineAmount),
      symbol: contract.policy.symbol,
    };
  },

  async lockClaim(input: {
    userId: string;
    amountMicro: string;
    destinationWallet: string;
    chain: string;
    idempotencyKey: string;
  }) {
    await requireStateRow();
    const amount = asMicro(input.amountMicro);
    if (amount <= 0n) return { accepted: false, reason: 'INVALID_CLAIM_AMOUNT' };

    const userBalance = await getLatestBalanceMicro(input.userId);
    if (userBalance < amount) return { accepted: false, reason: 'INSUFFICIENT_BALANCE' };

    const event = await appendEvent({
      txId: `claim-lock:${input.userId}:${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      eventType: 'claim_lock',
      userId: input.userId,
      amountMicro: amount,
      deltaMicro: -amount,
      balanceAfterMicro: userBalance - amount,
      status: 'pending',
      sourceType: 'claim',
      sourceId: input.destinationWallet,
      metadata: { destinationWallet: input.destinationWallet, chain: input.chain },
    });

    await updateStateRow({ lastActivityAt: nowIso() });
    return {
      accepted: true,
      event,
      lockedAmountMicro: toMicro(amount),
      lockedAmount: toToken(amount),
      symbol: contract.policy.symbol,
    };
  },

  async settleClaim(input: {
    userId: string;
    amountMicro: string;
    destinationWallet: string;
    chain: string;
    onchainTxHash: string;
    idempotencyKey: string;
  }) {
    const state = await requireStateRow();
    const amount = asMicro(input.amountMicro);
    if (amount <= 0n) return { accepted: false, reason: 'INVALID_CLAIM_AMOUNT' };

    const event = await appendEvent({
      txId: `claim-settled:${input.userId}:${input.onchainTxHash}`,
      idempotencyKey: input.idempotencyKey,
      eventType: 'claim_settled',
      userId: input.userId,
      amountMicro: amount,
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

    const nextBurned = asMicro(state.totalBurnedMicro) + amount;
    const nextMinted = asMicro(state.totalMintedMicro);
    await updateStateRow({
      totalBurnedMicro: toMicro(nextBurned),
      circulatingMicro: toMicro(nextMinted - nextBurned),
      lastActivityAt: nowIso(),
    });

    return {
      accepted: true,
      event,
      settledAmountMicro: toMicro(amount),
      settledAmount: toToken(amount),
      symbol: contract.policy.symbol,
      onchainTxHash: input.onchainTxHash,
    };
  },

  async listUserLedger(userId: string, limit = 100) {
    await requireStateRow();
    const { databases } = createAdminClient();
    const rows = await databases.listDocuments(DB_ID, TABLE_ID, [
      Query.equal('rowType', 'event'),
      Query.equal('userId', userId),
      Query.orderDesc('createdAt'),
      Query.limit(Math.max(1, Math.min(limit, 250))),
    ]);
    return rows.documents;
  },
};
