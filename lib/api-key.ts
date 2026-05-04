import { databases, APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, Query } from './appwrite';
import { hashApiKey } from './hash';

export interface APIKeyValidationResult {
  valid: boolean;
  reason?: string;
  keyOwnerId?: string;
  plan?: string;
  apiKeyId?: string;
}

const BASIC_KEY_REGEX = /^[A-Za-z0-9_-]{20,120}$/;

export async function validateApiKey(key: string | null | undefined): Promise<APIKeyValidationResult> {
  if (!key) return { valid: false, reason: 'MISSING' };
  if (!BASIC_KEY_REGEX.test(key)) return { valid: false, reason: 'FORMAT' };

  try {
    const keyHash = hashApiKey(key);

    // Primary: lookup by keyHash attribute
    let res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_APIKEYS,
      [Query.equal('keyHash', keyHash), Query.limit(1)] as any
    );

    // Fallback: legacy lookup by raw key field if no hash match
    if (!res.documents.length) {
      res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_APIKEYS,
        [Query.equal('key', key), Query.limit(1)] as any
      );
    }

    if (!res.documents.length) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const doc: any = res.documents[0];

    // Soft checks (revocation / expiry / quota)
    if (doc.revokedAt) return { valid: false, reason: 'REVOKED', apiKeyId: doc.$id };
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return { valid: false, reason: 'EXPIRED', apiKeyId: doc.$id };

    // TODO: quota enforcement placeholder

    return {
      valid: true,
      reason: 'OK',
      keyOwnerId: doc.userId || doc.ownerId || doc.createdBy || null,
      plan: doc.plan || doc.tier || 'free',
      apiKeyId: doc.$id
    };
  } catch (error: any) {
    console.error('validateApiKey error:', error);
    return { valid: false, reason: 'ERROR' };
  }
}

export interface CreateApiKeyOptions {
  name?: string;
  plan?: string;
  expiresAt?: string; // ISO
  userId?: string; // override current user (system usage)
}

export async function createHashedApiKey(options: CreateApiKeyOptions = {}) {
  const { generateApiKey, hashApiKey } = await import('./hash');
  const { getCurrentUser, ID } = await import('./appwrite');

  const user = options.userId ? { $id: options.userId } as any : await (getCurrentUser() as any);
  if (!user || !user.$id) throw new Error('NOT_AUTHENTICATED');

  const { key } = generateApiKey();
  const keyHash = hashApiKey(key);

  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_APIKEYS,
    (ID as any).unique(),
    {
      name: options.name || 'Default Key',
      plan: options.plan || 'free',
      userId: user.$id,
      keyHash,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: options.expiresAt || null,
      // Keep raw key field null to avoid storage; migration will remove if exists
      key: null
    }
  );

  return { apiKey: key, apiKeyId: (doc as any).$id };
}
