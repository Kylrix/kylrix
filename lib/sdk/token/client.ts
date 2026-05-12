import { account } from '@/lib/appwrite/client';
import { runTokenOperationSecure } from '@/lib/actions/secure-ops';
import type { KylrixActivityType } from './contract';

export type KylrixTokenAction =
  | 'state'
  | 'initialize'
  | 'mint_activity'
  | 'transfer'
  | 'balance'
  | 'ledger'
  | 'fine_to_root'
  | 'lock_claim'
  | 'settle_claim';

export interface KylrixTokenClientOptions {
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface KylrixTokenStateResponse {
  initialized: boolean;
  state: Record<string, unknown> | null;
}

type MintActivityRequest = {
  action: 'mint_activity';
  userId: string;
  idempotencyKey: string;
  activityType: KylrixActivityType;
  uniqueActors: number;
  trustScore: number;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
};

type TransferRequest = {
  action: 'transfer';
  fromUserId: string;
  toUserId: string;
  amountMicro: string;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
};

type LedgerRequest = {
  action: 'ledger';
  userId?: string;
  limit?: number;
};

type BalanceRequest = {
  action: 'balance';
  userId?: string;
};

type FineToRootRequest = {
  action: 'fine_to_root';
  userId: string;
  amountMicro: string;
  idempotencyKey: string;
  reason: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
};

type LockClaimRequest = {
  action: 'lock_claim';
  userId: string;
  amountMicro: string;
  destinationWallet: string;
  chain: string;
  idempotencyKey: string;
};

type SettleClaimRequest = {
  action: 'settle_claim';
  userId: string;
  amountMicro: string;
  destinationWallet: string;
  chain: string;
  onchainTxHash: string;
  idempotencyKey: string;
};

type StateRequest = { action: 'state' };
type InitializeRequest = { action: 'initialize' };

type TokenOperationRequest =
  | StateRequest
  | InitializeRequest
  | MintActivityRequest
  | TransferRequest
  | BalanceRequest
  | LedgerRequest
  | FineToRootRequest
  | LockClaimRequest
  | SettleClaimRequest;

function assertNonEmpty(value: unknown, field: string) {
  const v = String(value || '').trim();
  if (!v) {
    throw new Error(`TOKEN_CLIENT_INVALID_${field.toUpperCase()}`);
  }
}

function validateRequest(request: TokenOperationRequest) {
  if (!request?.action) throw new Error('TOKEN_CLIENT_INVALID_ACTION');

  switch (request.action) {
    case 'state':
    case 'initialize':
      break;
    case 'mint_activity':
      assertNonEmpty(request.userId, 'userId');
      assertNonEmpty(request.idempotencyKey, 'idempotencyKey');
      assertNonEmpty(request.sourceId, 'sourceId');
      assertNonEmpty(request.sourceType, 'sourceType');
      break;
    case 'transfer':
      assertNonEmpty(request.fromUserId, 'fromUserId');
      assertNonEmpty(request.toUserId, 'toUserId');
      assertNonEmpty(request.amountMicro, 'amountMicro');
      assertNonEmpty(request.idempotencyKey, 'idempotencyKey');
      break;
    case 'ledger':
    case 'balance':
      break;
    case 'fine_to_root':
      assertNonEmpty(request.userId, 'userId');
      assertNonEmpty(request.amountMicro, 'amountMicro');
      assertNonEmpty(request.idempotencyKey, 'idempotencyKey');
      assertNonEmpty(request.reason, 'reason');
      break;
    case 'lock_claim':
      assertNonEmpty(request.userId, 'userId');
      assertNonEmpty(request.amountMicro, 'amountMicro');
      assertNonEmpty(request.destinationWallet, 'destinationWallet');
      assertNonEmpty(request.idempotencyKey, 'idempotencyKey');
      break;
    case 'settle_claim':
      assertNonEmpty(request.userId, 'userId');
      assertNonEmpty(request.amountMicro, 'amountMicro');
      assertNonEmpty(request.destinationWallet, 'destinationWallet');
      assertNonEmpty(request.onchainTxHash, 'onchainTxHash');
      assertNonEmpty(request.idempotencyKey, 'idempotencyKey');
      break;
    default:
      break;
  }
}

/**
 * Calls **`runTokenOperationSecure`** Server Actions (`'use server'`). Auth is **`createServerClient()` +
 * Appwrite session cookies** on that request — if Actions do not receive the session cookie chain, you get Unauthorized.
 *
 * **Read-only** balance / ledger while signed in via the SDK in the browser: use `KylrixTokenService`
 * (`@/lib/services/token`) with TablesDB row permissions (`read("user:…")` on ledger events).
 */
export function createKylrixTokenOperationsClient(options: KylrixTokenClientOptions = {}) {
  const endpoint = options.endpoint || 'in-code-secure-op';
  const baseHeaders = options.headers || {};

  const execute = async <T = any>(request: TokenOperationRequest): Promise<T> => {
    validateRequest(request);
    void endpoint;
    void baseHeaders;
    const { jwt } = await account.createJWT().catch(() => ({ jwt: null }));
    return (await runTokenOperationSecure({ ...request, jwt })) as T;
  };

  return {
    execute,
    getState: () => execute<KylrixTokenStateResponse>({ action: 'state' }),
    initializeState: () => execute({ action: 'initialize' }),
    mintActivity: (request: Omit<MintActivityRequest, 'action'>) =>
      execute({ action: 'mint_activity', ...request }),
    transfer: (request: Omit<TransferRequest, 'action'>) =>
      execute({ action: 'transfer', ...request }),
    getBalance: (request: Omit<BalanceRequest, 'action'> = {}) =>
      execute({ action: 'balance', ...request }),
    listLedger: (request: Omit<LedgerRequest, 'action'> = {}) =>
      execute({ action: 'ledger', ...request }),
    fineToRoot: (request: Omit<FineToRootRequest, 'action'>) =>
      execute({ action: 'fine_to_root', ...request }),
    lockClaim: (request: Omit<LockClaimRequest, 'action'>) =>
      execute({ action: 'lock_claim', ...request }),
    settleClaim: (request: Omit<SettleClaimRequest, 'action'>) =>
      execute({ action: 'settle_claim', ...request }),
  };
}
