export interface VaultUnsealedFields {
  name?: string;
  username?: string | null;
  url?: string | null;
  password?: string;
  notes?: string;
  customFields?: unknown;
  cardNumber?: string;
  cardholderName?: string;
  cardExpiry?: string;
  cardCVV?: string;
  cardPIN?: string;
}

export interface VaultItemRecord {
  id: string;
  userId?: string | null;
  name: string;
  itemType: string;
  url: string | null;
  username: string | null;
  folderId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isPublic?: boolean;
  isGuest?: boolean;
  isWorkspace?: boolean;
  projectId?: string | null;
  isEnv?: boolean;
  tags: string[];
  updatedAt: string | null;
  createdAt: string | null;
  hasSecret: boolean;
  secret?: string;
  password?: string;
  notes?: string;
  customFields?: unknown;
  cardNumber?: string;
  cardholderName?: string;
  cardExpiry?: string;
  cardCVV?: string;
  cardPIN?: string;
  dek?: string | null;
  envText?: string | null;
}

export function shapeVaultItem(
  row: Record<string, unknown>,
  opts: {
    unsealed?: VaultUnsealedFields;
    hasMek?: boolean;
    looksEncrypted?: (value: unknown) => boolean;
  } = {},
): VaultItemRecord {
  const r = row as any;
  const unsealed = opts.unsealed || {};
  const hasMek = !!opts.hasMek;
  const isEncryptedValue = opts.looksEncrypted || (() => false);

  const rawName = unsealed.name ?? r.name ?? '';
  const name =
    isEncryptedValue(rawName) && !hasMek ? 'Protected Secret' : String(rawName || 'Untitled');
  const username =
    unsealed.username !== undefined
      ? unsealed.username
      : isEncryptedValue(r.username) && !hasMek
        ? null
        : (r.username ?? null);
  const url =
    unsealed.url !== undefined
      ? unsealed.url
      : isEncryptedValue(r.url) && !hasMek
        ? null
        : (r.url ?? null);

  return {
    id: String(r.$id || r.id),
    userId: r.userId || null,
    name,
    itemType: r.itemType || 'login',
    url,
    username,
    folderId: r.folderId || null,
    isFavorite: !!r.isFavorite,
    isPinned: !!r.isPinned,
    isPublic: Boolean(r.isPublic),
    isGuest: Boolean(r.isGuest),
    isWorkspace: Boolean(r.isWorkspace),
    projectId: r.projectId || null,
    isEnv: Boolean(r.isEnv),
    tags: Array.isArray(r.tags) ? r.tags : [],
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    hasSecret: !!(r.password || r.cardNumber),
    ...(r.dek ? { dek: r.dek } : {}),
    ...(unsealed.password ? { secret: unsealed.password, password: unsealed.password } : (r.password ? { password: r.password } : {})),
    ...(unsealed.notes ? { notes: unsealed.notes } : (r.notes ? { notes: r.notes } : {})),
    ...(unsealed.customFields ? { customFields: unsealed.customFields } : (r.customFields ? { customFields: r.customFields } : {})),
    ...(unsealed.cardNumber ? { cardNumber: unsealed.cardNumber } : {}),
    ...(unsealed.cardholderName ? { cardholderName: unsealed.cardholderName } : {}),
    ...(unsealed.cardExpiry ? { cardExpiry: unsealed.cardExpiry } : {}),
    ...(unsealed.cardCVV ? { cardCVV: unsealed.cardCVV } : {}),
    ...(unsealed.cardPIN ? { cardPIN: unsealed.cardPIN } : {}),
  };
}

export interface TotpUnsealedFields {
  issuer?: string;
  accountName?: string | null;
  url?: string | null;
  secretKey?: string;
}

export interface TotpSecretRecord {
  id: string;
  issuer: string;
  accountName: string | null;
  url: string | null;
  algorithm: string;
  digits: number;
  period: number;
  folderId: string | null;
  isFavorite: boolean;
  tags: string[];
  updatedAt: string | null;
  createdAt: string | null;
  hasSecret: boolean;
  secretKey?: string;
}

export function shapeTotpSecret(
  row: Record<string, unknown>,
  opts: {
    unsealed?: TotpUnsealedFields;
    hasMek?: boolean;
    looksEncrypted?: (value: unknown) => boolean;
  } = {},
): TotpSecretRecord {
  const r = row as any;
  const unsealed = opts.unsealed || {};
  const hasMek = !!opts.hasMek;
  const isEncryptedValue = opts.looksEncrypted || (() => false);

  const rawIssuer = unsealed.issuer ?? r.issuer ?? '';
  const issuer =
    isEncryptedValue(rawIssuer) && !hasMek ? 'Encrypted Code' : String(rawIssuer || 'Smart Code');
  const accountName =
    unsealed.accountName !== undefined
      ? unsealed.accountName
      : isEncryptedValue(r.accountName) && !hasMek
        ? null
        : (r.accountName ?? null);
  const url =
    unsealed.url !== undefined
      ? unsealed.url
      : isEncryptedValue(r.url) && !hasMek
        ? null
        : (r.url ?? null);

  return {
    id: String(r.$id || r.id),
    issuer,
    accountName,
    url,
    algorithm: r.algorithm || 'SHA1',
    digits: r.digits || 6,
    period: r.period || 30,
    folderId: r.folderId || null,
    isFavorite: !!r.isFavorite,
    tags: Array.isArray(r.tags) ? r.tags : [],
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    hasSecret: !!r.secretKey,
    ...(unsealed.secretKey ? { secretKey: unsealed.secretKey } : {}),
  };
}

export const VAULT_ITEM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    itemType: { type: 'string' },
    url: { type: ['string', 'null'] },
    username: { type: ['string', 'null'] },
    folderId: { type: ['string', 'null'] },
    isFavorite: { type: 'boolean' },
    isPinned: { type: 'boolean' },
    isPublic: { type: 'boolean' },
    isGuest: { type: 'boolean' },
    isWorkspace: { type: 'boolean' },
    projectId: { type: ['string', 'null'] },
    isEnv: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    updatedAt: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    hasSecret: { type: 'boolean' },
    secret: { type: 'string' },
    password: { type: 'string' },
    notes: { type: 'string' },
    customFields: { type: ['object', 'array', 'string'] },
    dek: { type: 'string' },
    envText: { type: ['string', 'null'] },
  },
} as const;

export const MCP_VAULT_LIST_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
    limit: { type: 'number', description: 'Maximum items to return' },
    mek: { type: 'string', description: 'Optional MEK for client-assisted decryption' },
  },
} as const;

export const MCP_VAULT_LIST_OUTPUT = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: VAULT_ITEM_JSON_SCHEMA,
    },
  },
} as const;

export const MCP_VAULT_GET_INPUT = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Vault item credential ID' },
    shareKey: { type: 'string', description: 'Optional share key or direct DEK from public share URL' },
    masterPassword: { type: 'string', description: 'Optional Master Password for server-side on-the-fly decryption' },
    mek: { type: 'string', description: 'Optional MEK hex/base64' },
    workspaceId: { type: 'string', description: 'Optional workspace ID' },
    format: { type: 'string', enum: ['json', 'env', 'dotenv'], description: 'Format of output (json or env text)' },
    pure: { type: 'boolean', description: 'Pure env output without metadata' },
  },
  required: ['id'],
} as const;

export const MCP_VAULT_RESOLVE_PUBLIC_INPUT = {
  type: 'object',
  properties: {
    idOrShareUrl: { type: 'string', description: 'Secret ID or full public share URL (e.g. https://www.kylrix.space/vault/id/key or id#key)' },
    shareKey: { type: 'string', description: 'Optional share key / DEK if not included in URL' },
    format: { type: 'string', enum: ['json', 'env', 'dotenv'], description: 'Output format' },
    pure: { type: 'boolean', description: 'Pure env output without metadata' },
  },
  required: ['idOrShareUrl'],
} as const;

export const MCP_VAULT_CREATE_INPUT = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Secret or credential title' },
    username: { type: 'string', description: 'Login username or account identifier' },
    password: { type: 'string', description: 'Secret, API key, or password plaintext' },
    url: { type: 'string', description: 'Service or target URL' },
    notes: { type: 'string', description: 'Secret notes or environment comments' },
    customFields: { type: ['object', 'array', 'string'], description: 'Custom fields or environment variables key-value map' },
    itemType: { type: 'string', description: 'Type of credential (login, api_key, env, secure_note, card)' },
    isEnv: { type: 'boolean', description: 'Whether this secret represents project environment variables' },
    workspaceId: { type: 'string', description: 'Optional workspace ID to attach this credential to' },
    mek: { type: 'string', description: 'Optional MEK hex for encrypting the secret' },
    isPinned: { type: 'boolean' },
    isFavorite: { type: 'boolean' },
  },
  required: ['name'],
} as const;

export const MCP_VAULT_MEK_UNLOCK_INPUT = {
  type: 'object',
  properties: {
    masterPassword: { type: 'string', description: 'Master Password to derive and unwrap MEK. If omitted, returns raw encrypted keychain blob.' },
  },
} as const;

