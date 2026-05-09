export type KylrixTokenAction =
  | 'state'
  | 'initialize'
  | 'mint_activity'
  | 'transfer'
  | 'ledger'
  | 'fine_to_root'
  | 'lock_claim'
  | 'settle_claim';

export type KylrixActivityType =
  | 'note_view'
  | 'chat_message'
  | 'call_participation'
  | 'comment'
  | 'moderation';

export interface KylrixTokenClientOptions {
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface KylrixTokenStateResponse {
  initialized: boolean;
  state: Record<string, unknown> | null;
}

type TokenRequestBase = {
  action: KylrixTokenAction;
};

type MintActivityRequest = TokenRequestBase & {
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

type TransferRequest = TokenRequestBase & {
  action: 'transfer';
  fromUserId: string;
  toUserId: string;
  amountMicro: string;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
};

type LedgerRequest = TokenRequestBase & {
  action: 'ledger';
  userId?: string;
  limit?: number;
};

type FineToRootRequest = TokenRequestBase & {
  action: 'fine_to_root';
  userId: string;
  amountMicro: string;
  idempotencyKey: string;
  reason: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
};

type LockClaimRequest = TokenRequestBase & {
  action: 'lock_claim';
  userId: string;
  amountMicro: string;
  destinationWallet: string;
  chain: string;
  idempotencyKey: string;
};

type SettleClaimRequest = TokenRequestBase & {
  action: 'settle_claim';
  userId: string;
  amountMicro: string;
  destinationWallet: string;
  chain: string;
  onchainTxHash: string;
  idempotencyKey: string;
};

type TokenOperationRequest =
  | TokenRequestBase
  | MintActivityRequest
  | TransferRequest
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

export function createKylrixTokenOperationsClient(options: KylrixTokenClientOptions = {}) {
  const endpoint = options.endpoint || '/accounts/api/token/operations';
  const baseHeaders = options.headers || {};

  const execute = async <T = any>(request: TokenOperationRequest): Promise<T> => {
    validateRequest(request);

    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...baseHeaders,
      },
      body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.error || `TOKEN_CLIENT_HTTP_${response.status}`);
      const error = new Error(message) as Error & { status?: number; payload?: unknown };
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload as T;
  };

  return {
    execute,
    getState: () => execute<KylrixTokenStateResponse>({ action: 'state' }),
    initializeState: () => execute({ action: 'initialize' }),
    mintActivity: (request: Omit<MintActivityRequest, 'action'>) =>
      execute({ action: 'mint_activity', ...request }),
    transfer: (request: Omit<TransferRequest, 'action'>) =>
      execute({ action: 'transfer', ...request }),
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
