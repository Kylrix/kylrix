import type {
  Credentials,
  TotpSecrets,
  Folders,
  SecurityLogs,
  User,
  Keychain,
  KeyMapping,
} from "@/types/appwrite";

export type {
  Credentials,
  TotpSecrets,
  Folders,
  SecurityLogs,
  User,
  Keychain,
  KeyMapping,
};

export type SecurityLogsCreate = {
  userId: string;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  details?: string | null;
  success: boolean;
  severity?: string;
  timestamp: string;
};

export type CredentialsCreate = {
  userId: string;
  itemType: string;
  name: string;
  url?: string | null;
  notes?: string | null;
  totpId?: string | null;
  password?: string | null;
  cardNumber?: string | null;
  cardholderName?: string | null;
  cardExpiry?: string | null;
  cardCVV?: string | null;
  cardPIN?: string | null;
  cardType?: string | null;
  folderId?: string | null;
  tags?: string[] | null;
  customFields?: string | null;
  faviconUrl?: string | null;
  isFavorite?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  lastAccessedAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  username?: string | null;
  sharedFrom?: string | null;
};

export type FoldersCreate = {
  userId: string;
  name: string;
  parentFolderId?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TotpSecretsCreate = {
  userId: string;
  issuer: string;
  accountName: string;
  secretKey: string;
  algorithm: string;
  digits: number;
  period: number;
  url?: string | null;
  folderId?: string | null;
  tags?: string[] | null;
  isFavorite?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sharedFrom?: string | null;
};

export type KeychainCreate = {
  userId: string;
  type: string;
  credentialId?: string | null;
  wrappedKey: string;
  salt: string;
  params?: string | null;
  isBackup?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KeyMappingCreate = {
  resourceId: string;
  resourceType: string;
  grantee: string;
  wrappedKey: string;
  metadata?: string | null;
};
