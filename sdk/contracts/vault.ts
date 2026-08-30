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
  name: string;
  itemType: string;
  url: string | null;
  username: string | null;
  folderId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
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
    name,
    itemType: r.itemType || 'login',
    url,
    username,
    folderId: r.folderId || null,
    isFavorite: !!r.isFavorite,
    isPinned: !!r.isPinned,
    tags: Array.isArray(r.tags) ? r.tags : [],
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    hasSecret: !!(r.password || r.cardNumber),
    ...(unsealed.password ? { secret: unsealed.password, password: unsealed.password } : {}),
    ...(unsealed.notes ? { notes: unsealed.notes } : {}),
    ...(unsealed.customFields ? { customFields: unsealed.customFields } : {}),
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
