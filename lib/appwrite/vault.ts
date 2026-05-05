import {
  ID,
  Query,
  AuthenticationFactor,
  Models,
  Permission,
  Role,
  AuthenticatorType,
} from "appwrite";
import { 
  account, 
  databases, 
  storage, 
  realtime, 
  client, 
  getCurrentUser, 
  invalidateCurrentUserCache,
  appwriteAccount,
  appwriteDatabases,
  appwriteStorage,
  appwriteAvatars,
  APPWRITE_DATABASE_ID,
  APPWRITE_BUCKET_BACKUPS_ID,
  APPWRITE_BUCKET_PROFILE_PICTURES_ID,
  APPWRITE_COLLECTION_KEYCHAIN_ID
} from './client';
import { AppwriteService } from './auth';
import { buildVaultNoteTags } from "../sdk/crosslinks";
import type {
  Credentials,
  CredentialsCreate,
  TotpSecrets,
  TotpSecretsCreate,
  Folders,
  FoldersCreate,
  SecurityLogs,
  SecurityLogsCreate,
  User,
  Keychain,
  KeychainCreate,
  KeyMapping,
  KeyMappingCreate,
} from "./types";
import { sanitizeString } from "../validation";
import { getEcosystemUrl } from "../ecosystem";

import { APPWRITE_CONFIG } from "./config";
import { sendKylrixEmailNotification } from "../email-notifications";

// --- Helper Utilities ---

function normalizeEndpoint(ep?: string): string {
  const raw = (ep || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/\/+$/, "");
  if (/\/v1$/.test(cleaned)) return cleaned;
  return `${cleaned}/v1`;
}

function isFetchNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed")
  );
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(atob(value).split("").map((char) => char.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function readShareMetadata(metadata: string | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function importX25519PublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    base64ToBytes(publicKeyBase64) as unknown as BufferSource,
    { name: "X25519" },
    false,
    [],
  );
}

async function exportX25519PublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", publicKey);
  return bytesToBase64(new Uint8Array(exported));
}

async function encryptShareEnvelope<T extends Record<string, unknown>>(
  payload: T,
  recipientPublicKeyBase64: string,
): Promise<{ wrappedKey: string; senderPublicKey: string }> {
  const recipientPublicKey = await importX25519PublicKey(recipientPublicKeyBase64);
  const ephemeralKeyPair = (await crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveKey", "deriveBits"],
  )) as CryptoKeyPair;

  const sharedKey = await crypto.subtle.deriveKey(
    { name: "X25519", public: recipientPublicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    wrappedKey: bytesToBase64(combined),
    senderPublicKey: await exportX25519PublicKey(ephemeralKeyPair.publicKey),
  };
}

async function decryptShareEnvelope<T extends Record<string, unknown>>(
  wrappedKeyBase64: string,
  senderPublicKeyBase64: string,
): Promise<T> {
  const { ecosystemSecurity } = await import("../ecosystem/security");
  const plaintext = await ecosystemSecurity.decryptWithECDH(wrappedKeyBase64, senderPublicKeyBase64);
  return JSON.parse(plaintext) as T;
}

async function listDocumentsWithRetry(
  collectionId: string,
  queries: string[] = [],
): Promise<Models.DocumentList<Models.Document>> {
  try {
    return await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      collectionId,
      queries,
    );
  } catch (err: unknown) {
    if (!isFetchNetworkError(err)) throw err as Error;

    // Try to normalize endpoint then retry once
    try {
      const envEp = APPWRITE_CONFIG.ENDPOINT;
      if (envEp) {
        client.setEndpoint(envEp);
      } else if (typeof window !== "undefined") {
        // Fallback to same-origin /v1 in dev if env missing
        client.setEndpoint(normalizeEndpoint(window.location.origin));
      }
      return await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        collectionId,
        queries,
      );
    } catch (err2: unknown) {
      // Surface a clearer error with guidance
      const note =
        "Network request to Appwrite failed. Check NEXT_PUBLIC_APPWRITE_ENDPOINT, CORS, and /v1 suffix.";
      const e = err2 as Error & { cause?: unknown };
      e.cause = err;
      throw new Error(`${note} Original: ${e.message}`);
    }
  }
}

// --- Appwrite Config ---
export const APPWRITE_COLLECTION_CREDENTIALS_ID = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const APPWRITE_COLLECTION_TOTPSECRETS_ID = APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS;
export const APPWRITE_COLLECTION_FOLDERS_ID = APPWRITE_CONFIG.TABLES.VAULT.FOLDERS;
export const APPWRITE_COLLECTION_SECURITYLOGS_ID = APPWRITE_CONFIG.TABLES.VAULT.SECURITY_LOGS;
export const APPWRITE_COLLECTION_USER_ID = APPWRITE_CONFIG.TABLES.VAULT.USER;
export const APPWRITE_COLLECTION_KEY_MAPPING_ID = APPWRITE_CONFIG.TABLES.VAULT.KEY_MAPPING;

// Ecosystem: Kylrix Flow

// Ecosystem: Kylrix Note
export const NOTE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
export const NOTE_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

// Ecosystem: Unified Identity & Chat
export const PASSWORD_MANAGER_DATABASE_ID = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
export const APPWRITE_COLLECTION_IDENTITIES_ID = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES;
export const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CHAT_COLLECTION_CONVERSATIONS_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
export const CHAT_COLLECTION_MESSAGES_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
export const CHAT_COLLECTION_USERS_ID = APPWRITE_CONFIG.TABLES.CHAT.USERS;

// --- Collection Structure & Field Mappings ---
// Dynamically derive encrypted/plaintext fields from the types
// These fields receive CLIENT-SIDE end-to-end encryption (on top of Appwrite's database encryption)
const ENCRYPTED_FIELDS = {
  credentials: [
    "name",           // Credential name
    "url",            // URL/website
    "username",       // Username/email
    "password",       // Password
    "notes",          // Notes
    "customFields",   // Custom fields JSON
    "cardNumber",     // Credit card number
    "cardholderName", // Cardholder name
    "cardExpiry",     // Card expiry date
    "cardCVV",        // Card CVV
    "cardPIN",        // Card PIN
  ],
  totpSecrets: [
    "issuer",         // TOTP issuer (e.g., "Google", "GitHub")
    "accountName",    // TOTP account name (e.g., user email/username)
    "secretKey",      // TOTP secret key (CRITICAL - must be encrypted)
    "url",            // TOTP URL for QR code/autofill
  ],
  folders: [
    "name",           // Folder name (sensitive organization info)
  ],
  securityLogs: [
    "ipAddress",      // IP address (privacy)
    "userAgent",      // User agent (fingerprinting)
    "deviceFingerprint", // Device fingerprint
    "details",        // Event details (may contain sensitive info)
  ],
  user: [
    "email",          // User email
    "twofaSecret",    // 2FA secret
    "backupCodes",    // 2FA backup codes
    "sessionFingerprint", // Session fingerprint
  ],
  keychain: [], // Keychain entries are already encrypted/hashed or public
} as const;

function getPlaintextFields<T>(
  allFields: (keyof T)[],
  encrypted: readonly string[],
): string[] {
  return allFields
    .filter((f) => !encrypted.includes(f as string))
    .map((f) => f as string);
}

export const COLLECTION_SCHEMAS = {
  credentials: {
    encrypted: ENCRYPTED_FIELDS.credentials,
    plaintext: getPlaintextFields<Credentials>(
      [
        "userId",
        "itemType",
        "name",
        "url",
        "username",
        "password",
        "notes",
        "totpId",
        "cardNumber",
        "cardholderName",
        "cardExpiry",
        "cardCVV",
        "cardPIN",
        "cardType",
        "folderId",
        "tags",
        "customFields",
        "faviconUrl",
        "isFavorite",
        "isDeleted",
        "deletedAt",
        "lastAccessedAt",
        "passwordChangedAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.credentials,
    ),
  },
  totpSecrets: {
    encrypted: ENCRYPTED_FIELDS.totpSecrets,
    plaintext: getPlaintextFields<TotpSecrets>(
      [
        "userId",
        "issuer",
        "accountName",
        "secretKey",
        "algorithm",
        "digits",
        "period",
        "url",
        "folderId",
        "tags",
        "isFavorite",
        "isDeleted",
        "deletedAt",
        "lastUsedAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.totpSecrets,
    ),
  },
  folders: {
    encrypted: ENCRYPTED_FIELDS.folders,
    plaintext: getPlaintextFields<Folders>(
      [
        "userId",
        "name",
        "parentFolderId",
        "icon",
        "color",
        "sortOrder",
        "isDeleted",
        "deletedAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.folders,
    ),
  },
  securityLogs: {
    encrypted: ENCRYPTED_FIELDS.securityLogs,
    plaintext: getPlaintextFields<SecurityLogs>(
      [
        "userId",
        "eventType",
        "ipAddress",
        "userAgent",
        "deviceFingerprint",
        "details",
        "success",
        "severity",
        "timestamp",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.securityLogs,
    ),
  },
  user: {
    encrypted: ENCRYPTED_FIELDS.user,
    plaintext: getPlaintextFields<User>(
      [
        "userId",
        "email",
        "masterpass",
        "twofa",
        "twofaSecret",
        "backupCodes",
        "isPasskey",
        "sessionFingerprint",
        "lastLoginAt",
        "lastPasswordChangeAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.user,
    ),
  },
  keychain: {
    encrypted: ENCRYPTED_FIELDS.keychain,
    plaintext: getPlaintextFields<Keychain>(
      [
        "userId",
        "type",
        "credentialId",
        "wrappedKey",
        "salt",
        "params",
        "isBackup",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt",
      ],
      ENCRYPTED_FIELDS.keychain,
    ),
  },
};

// --- Secure CRUD Operations ---
export class VaultService {
  private static credentialsListCache = new Map<string, { expiresAt: number; documents: Credentials[] }>();

  private static clearCredentialCache(userId: string) {
    for (const key of this.credentialsListCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.credentialsListCache.delete(key);
      }
    }
  }

  // Map a single Appwrite document to domain type
  private static mapDoc<T>(doc: Models.Document | Record<string, unknown>): T {
    return doc as unknown as T;
  }

  // Map Appwrite DocumentList response to domain DocumentList shape
  private static mapDocumentList<T>(
    response:
      | Models.DocumentList<Models.Document>
      | { documents?: unknown[]; items?: unknown[]; total?: number }
      | unknown[],
  ): { total: number; documents: T[] } {
    if (Array.isArray(response)) {
      return {
        total: response.length,
        documents: response as unknown as T[],
      };
    }

    const resp = response as {
      documents?: unknown[];
      items?: unknown[];
      total?: number;
    };
    return {
      total: resp.total ?? 0,
      documents: (resp.documents ?? resp.items ?? []) as unknown as T[],
    };
  }
  // Create with automatic encryption
  static async createCredential(
    data: CredentialsCreate,
    options?: { linkedNoteIds?: string[] },
  ): Promise<Credentials> {
    const sanitizedData = this.sanitizeCredentialData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptDocumentFields(sanitizedData, "credentials");

    // Ensure itemType is present, default to 'login'
    if (!encryptedData.itemType) {
      encryptedData.itemType = "login";
    }

    // Validate password presence for login items
    if (encryptedData.itemType === "login" && !encryptedData.password) {
      console.error("[AppwriteService] Password missing for credential:", data.name);
      throw new Error("Password is required for login credentials. It may be empty or encryption failed.");
    }

    console.log("[AppwriteService] Creating Credential...", {
      dbId: APPWRITE_DATABASE_ID,
      collId: APPWRITE_COLLECTION_CREDENTIALS_ID,
      userId: data.userId,
      permissions: [
        Permission.read(Role.user(data.userId)),
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    });

    try {
      const doc = await appwriteDatabases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        ID.unique(),
        encryptedData,
        [
          Permission.read(Role.user(data.userId)),
          Permission.update(Role.user(data.userId)),
          Permission.delete(Role.user(data.userId)),
        ]
      );
      console.log("[AppwriteService] Credential Created Successfully:", doc.$id);
      this.clearCredentialCache(data.userId);
      return (await this.decryptDocumentFields(
        doc,
        "credentials",
      )) as Credentials;
    } catch (createError) {
      console.error("[AppwriteService] Create Credential FAILED:", createError);
      throw createError;
    }
  }

  static async createTOTPSecret(
    data: TotpSecretsCreate,
    options?: { linkedNoteIds?: string[] },
  ): Promise<TotpSecrets> {
    const sanitizedData = this.sanitizeTotpData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptDocumentFields(sanitizedData, "totpSecrets");
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      ID.unique(),
      encryptedData,
      [
        Permission.read(Role.user(data.userId)),
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    );
    this.clearCredentialCache(data.userId);
    return (await this.decryptDocumentFields(
      doc,
      "totpSecrets",
    )) as unknown as TotpSecrets;
  }

  static async createKeyMapping(
    data: KeyMappingCreate,
    permissions: string[],
  ): Promise<KeyMapping> {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      ID.unique(),
      {
        ...data,
        metadata: data.metadata ?? null,
      },
      permissions,
    );
    return doc as unknown as KeyMapping;
  }

  static async listIncomingKeyMappings(userId: string): Promise<KeyMapping[]> {
    const response = await listDocumentsWithRetry(APPWRITE_COLLECTION_KEY_MAPPING_ID, [
      Query.equal("grantee", userId),
      Query.orderDesc("$createdAt"),
    ]);
    return response.documents as unknown as KeyMapping[];
  }

  static async deleteKeyMapping(id: string): Promise<void> {
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      id,
    );
  }

  static async shareCredential(
    credentialId: string,
    recipient: { userId: string; publicKey: string },
  ): Promise<KeyMapping> {
    const credential = await this.getCredential(credentialId);
    const currentUser = await getCurrentUser();
    const payload = {
      kind: "credential",
      resourceId: credentialId,
      sharedFrom: credential.userId,
      data: {
        userId: recipient.userId,
        itemType: credential.itemType,
        name: credential.name,
        url: credential.url,
        notes: credential.notes,
        totpId: credential.totpId,
        password: credential.password,
        cardNumber: credential.cardNumber,
        cardholderName: credential.cardholderName,
        cardExpiry: credential.cardExpiry,
        cardCVV: credential.cardCVV,
        cardPIN: credential.cardPIN,
        cardType: credential.cardType,
        folderId: null,
        tags: credential.tags,
        customFields: credential.customFields,
        faviconUrl: credential.faviconUrl,
        isFavorite: credential.isFavorite,
        isDeleted: false,
        deletedAt: null,
        lastAccessedAt: null,
        passwordChangedAt: credential.passwordChangedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        username: credential.username,
        sharedFrom: credential.userId,
      },
    };

    const wrapped = await encryptShareEnvelope(payload, recipient.publicKey);
    const created = await this.createKeyMapping(
      {
        resourceId: credentialId,
        resourceType: "credential",
        grantee: recipient.userId,
        wrappedKey: wrapped.wrappedKey,
        metadata: JSON.stringify({
          senderId: credential.userId,
          senderPublicKey: wrapped.senderPublicKey,
          sourceName: credential.name,
          createdAt: new Date().toISOString(),
        }),
      },
      [
        Permission.read(Role.user(recipient.userId)),
        Permission.read(Role.user(credential.userId)),
        Permission.delete(Role.user(recipient.userId)),
        Permission.delete(Role.user(credential.userId)),
      ],
    );

    try {
      await sendKylrixEmailNotification({
        eventType: 'password_shared',
        sourceApp: 'vault',
        verificationMode: 'error',
        actorName: currentUser?.name || currentUser?.email || credential.userId,
        recipientIds: [recipient.userId],
        resourceId: credentialId,
        resourceTitle: credential.name || 'Credential',
        resourceType: 'credential',
        templateKey: 'vault:credential-shared',
        ctaUrl: `${getEcosystemUrl('vault')}/sharing`,
        ctaText: 'Open sharing',
      });
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('not verified')) {
        throw error;
      }
      console.error('[Vault] Failed to queue credential share email', error);
    }

    return created;
  }

  static async shareTotpSecret(
    totpSecretId: string,
    recipient: { userId: string; publicKey: string },
  ): Promise<KeyMapping> {
    const totpSecret = await this.getTOTPSecret(totpSecretId);
    const currentUser = await getCurrentUser();
    const payload = {
      kind: "totp",
      resourceId: totpSecretId,
      sharedFrom: totpSecret.userId,
      data: {
        userId: recipient.userId,
        issuer: totpSecret.issuer,
        accountName: totpSecret.accountName,
        secretKey: totpSecret.secretKey,
        algorithm: totpSecret.algorithm,
        digits: totpSecret.digits,
        period: totpSecret.period,
        url: totpSecret.url,
        folderId: null,
        tags: totpSecret.tags,
        isFavorite: totpSecret.isFavorite,
        isDeleted: false,
        deletedAt: null,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedFrom: totpSecret.userId,
      },
    };

    const wrapped = await encryptShareEnvelope(payload, recipient.publicKey);
    const created = await this.createKeyMapping(
      {
        resourceId: totpSecretId,
        resourceType: "totp",
        grantee: recipient.userId,
        wrappedKey: wrapped.wrappedKey,
        metadata: JSON.stringify({
          senderId: totpSecret.userId,
          senderPublicKey: wrapped.senderPublicKey,
          sourceName: `${totpSecret.issuer} / ${totpSecret.accountName}`,
          createdAt: new Date().toISOString(),
        }),
      },
      [
        Permission.read(Role.user(recipient.userId)),
        Permission.read(Role.user(totpSecret.userId)),
        Permission.delete(Role.user(recipient.userId)),
        Permission.delete(Role.user(totpSecret.userId)),
      ],
    );

    try {
      await sendKylrixEmailNotification({
        eventType: 'password_shared',
        sourceApp: 'vault',
        verificationMode: 'error',
        actorName: currentUser?.name || currentUser?.email || totpSecret.userId,
        recipientIds: [recipient.userId],
        resourceId: totpSecretId,
        resourceTitle: `${totpSecret.issuer} / ${totpSecret.accountName}`.trim(),
        resourceType: 'totp',
        templateKey: 'vault:totp-shared',
        ctaUrl: `${getEcosystemUrl('vault')}/sharing`,
        ctaText: 'Open sharing',
      });
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('not verified')) {
        throw error;
      }
      console.error('[Vault] Failed to queue TOTP share email', error);
    }

    return created;
  }

  static async acceptSharedCredential(mapping: KeyMapping): Promise<Credentials> {
    const metadata = readShareMetadata(mapping.metadata);
    const senderPublicKey = String(metadata.senderPublicKey ?? "");
    if (!senderPublicKey) {
      throw new Error("Missing share metadata");
    }

    const envelope = await decryptShareEnvelope<{
      kind: string;
      resourceId: string;
      sharedFrom: string;
      data: CredentialsCreate & { sharedFrom?: string | null };
    }>(mapping.wrappedKey, senderPublicKey);

    const created = await this.createCredential({
      ...envelope.data,
      userId: mapping.grantee,
      sharedFrom: envelope.sharedFrom,
    });

    await this.deleteKeyMapping(mapping.$id);
    return created;
  }

  static async acceptSharedTotp(mapping: KeyMapping): Promise<TotpSecrets> {
    const metadata = readShareMetadata(mapping.metadata);
    const senderPublicKey = String(metadata.senderPublicKey ?? "");
    if (!senderPublicKey) {
      throw new Error("Missing share metadata");
    }

    const envelope = await decryptShareEnvelope<{
      kind: string;
      resourceId: string;
      sharedFrom: string;
      data: TotpSecretsCreate & { sharedFrom?: string | null };
    }>(mapping.wrappedKey, senderPublicKey);

    const created = await this.createTOTPSecret({
      ...envelope.data,
      userId: mapping.grantee,
      sharedFrom: envelope.sharedFrom,
    });

    await this.deleteKeyMapping(mapping.$id);
    return created;
  }

  static async createFolder(
    data: FoldersCreate,
  ): Promise<Folders> {
    const sanitizedData = {
      ...data,
      name: sanitizeString(data.name, 100),
    };
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      ID.unique(),
      sanitizedData as unknown as Record<string, unknown>,
      [
        Permission.read(Role.user(data.userId)),
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    );
    return this.mapDoc<Folders>(doc);
  }

  static async createSecurityLog(
    data: SecurityLogsCreate,
  ): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId)),
        // Logs are usually read-only for the user, but for now we give full access
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    );
    return doc as unknown as SecurityLogs;
  }

  static async createKeychainEntry(
    data: KeychainCreate,
  ): Promise<Keychain> {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId)),
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    );
    return doc as unknown as Keychain;
  }

  static async listKeychainEntries(
    userId: string,
  ): Promise<Keychain[]> {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      [Query.equal("userId", userId)],
    );
    return response.documents as unknown as Keychain[];
  }

  static async deleteKeychainEntry(id: string): Promise<void> {
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      id,
    );
  }

  static async updateKeychainEntry(
    id: string,
    data: Partial<Keychain>,
  ): Promise<Keychain> {
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      id,
      data,
    );
    return doc as unknown as Keychain;
  }

  static async createUserDoc(data: Omit<User, "$id">): Promise<User> {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId)),
        Permission.update(Role.user(data.userId)),
        Permission.delete(Role.user(data.userId)),
      ]
    );
    return doc as unknown as User;
  }

  /**
   * Checks if the user has set up a master password (returns true if present in DB).
   */
  static async hasMasterpass(userId: string): Promise<boolean> {
    const userDoc = await this.getUserDoc(userId);
    return !!(userDoc && userDoc.masterpass === true);
  }

  /**
   * Sets the masterpass flag for the user in the database.
   * If the user doc exists, updates it; otherwise, creates it.
   */
  static async setMasterpassFlag(userId: string, email: string): Promise<void> {
    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        userDoc.$id,
        { masterpass: true },
      );
    } else {
      await appwriteDatabases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        ID.unique(),
        {
          userId,
          email,
          masterpass: true,
        },
      );
    }
  }

  /**
   * Checks if the user has set up a passkey.
   */
  static async hasPasskey(userId: string): Promise<boolean> {
    const entries = await this.listKeychainEntries(userId);
    return entries.some(e => e.type === 'passkey');
  }

  /**
   * Adds a new passkey credential to the user's document.
   */
  static async setPasskey(
    userId: string,
    passkeyBlob: string,
    newCredential: {
      credentialID: string;
      publicKey: string;
      counter: number;
      transports: string[];
    },
  ): Promise<void> {
    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        userDoc.$id,
        {
          isPasskey: true,
          passkeyBlob,
          credentialId: newCredential.credentialID,
          publicKey: newCredential.publicKey,
          counter: newCredential.counter,
        },
      );
    }
  }

  /**
   * Syncs the isPasskey flag on the user document based on actual keychain entries.
   */
  static async syncPasskeyStatus(userId: string): Promise<void> {
    const entries = await this.listKeychainEntries(userId);
    const hasPasskey = entries.some(e => e.type === 'passkey');

    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      // Only update if different to save writes
      if (!!userDoc.isPasskey !== hasPasskey) {
        await appwriteDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_USER_ID,
          userDoc.$id,
          { isPasskey: hasPasskey }
        );
      }
    }
  }

  /**
   * Removes all passkey credentials for the user.
   */
  static async removePasskey(userId: string): Promise<void> {
    // Remove ALL passkeys from keychain
    const entries = await this.listKeychainEntries(userId);
    const passkeyEntries = entries.filter(e => e.type === 'passkey');

    await Promise.all(passkeyEntries.map(e => this.deleteKeychainEntry(e.$id)));

    // Clear flags on user doc
    await this.syncPasskeyStatus(userId);
  }

  // Read with automatic decryption
  static async getCredential(id: string): Promise<Credentials> {
    const doc = await appwriteDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
    );
    return (await this.decryptDocumentFields(
      doc,
      "credentials",
    )) as Credentials;
  }

  static async getTOTPSecret(id: string): Promise<TotpSecrets> {
    const doc = await appwriteDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
    );
    return (await this.decryptDocumentFields(
      doc,
      "totpSecrets",
    )) as unknown as TotpSecrets;
  }

  static async getFolder(id: string): Promise<Folders> {
    const doc = await appwriteDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id,
    );
    return doc as unknown as Folders;
  }

  static async getUserDoc(userId: string): Promise<User | null> {
    try {
      const response = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        [Query.equal("userId", userId)],
      );
      const doc = response.documents[0];
      if (!doc) return null;
      return doc as unknown as User;
    } catch {
      return null;
    }
  }

  static async getSecurityLog(id: string): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id,
    );
    return doc as unknown as SecurityLogs;
  }

  // List with automatic decryption and pagination
  static async listRows<T extends Models.Row>(
    tableId: string,
    queries: string[] = [],
  ): Promise<{ total: number; documents: T[] }> {
    const response = await listDocumentsWithRetry(tableId, queries);
    return {
      total: response.total,
      documents: response.documents as unknown as T[],
    };
  }

  static async listCredentials(
    userId: string,
    limit: number = 25,
    offset: number = 0,
    queries: string[] = [],
  ): Promise<{ total: number; documents: Credentials[] }> {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      [
        Query.equal("userId", userId),
        Query.orderAsc("name"),
        Query.limit(limit),
        Query.offset(offset),
        ...queries,
      ],
    );

    const decryptedDocuments = await Promise.all(
      response.documents.map(
        (doc: Models.Document) =>
          this.decryptDocumentFields(
            doc,
            "credentials",
          ) as Promise<Credentials>,
      ),
    );

    return {
      total: response.total,
      documents: decryptedDocuments,
    };
  }

  // Enhanced search with database-level filtering for better performance
  static async searchCredentialsByName(
    userId: string,
    searchTerm: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ total: number; documents: Credentials[] }> {
    // Use database search on non-encrypted name field for better performance
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      [
        Query.equal("userId", userId),
        Query.search("name", searchTerm),
        Query.orderAsc("name"),
        Query.limit(limit),
        Query.offset(offset),
      ],
    );

    const decryptedDocuments = await Promise.all(
      response.documents.map(
        (doc: Models.Document) =>
          this.decryptDocumentFields(
            doc,
            "credentials",
          ) as Promise<Credentials>,
      ),
    );

    return {
      total: response.total,
      documents: decryptedDocuments,
    };
  }

  /**
   * Fetches ALL credentials for a user, handling pagination automatically.
   * Use this for operations that require the full dataset, like search or export.
   */
  static async listAllCredentials(
    userId: string,
    queries: string[] = [],
  ): Promise<Credentials[]> {
    const cacheKey = `${userId}:${JSON.stringify(queries)}`;
    const cached = this.credentialsListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.documents;
    }

    let documents: Credentials[] = [];
    let offset = 0;
    const limit = 100; // Max limit per request
    let response;

    do {
      response = await listDocumentsWithRetry(
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        [
          Query.equal("userId", userId),
          Query.limit(limit),
          Query.offset(offset),
          ...queries,
        ],
      );

      const decryptedDocuments = await Promise.all(
        response.documents.map(
          (doc: Models.Document) =>
            this.decryptDocumentFields(
              doc,
              "credentials",
            ) as unknown as Credentials,
        ),
      );

      documents = documents.concat(decryptedDocuments);
      offset += limit;
    } while (
      response.documents.length > 0 &&
      documents.length < response.total
    );

    this.credentialsListCache.set(cacheKey, {
      expiresAt: Date.now() + 15_000,
      documents,
    });
    return documents;
  }

  static async listRecentCredentials(
    userId: string,
    limit: number = 5,
  ): Promise<Credentials[]> {
    const response = await listDocumentsWithRetry(
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      [
        Query.equal("userId", userId),
        Query.orderDesc("$updatedAt"),
        Query.limit(limit),
      ],
    );
    return await Promise.all(
      response.documents.map(
        (doc: Models.Document) =>
          this.decryptDocumentFields(
            doc,
            "credentials",
          ) as Promise<Credentials>,
      ),
    );
  }

  static async listTOTPSecrets(
    userId: string,
    queries: string[] = [],
  ): Promise<TotpSecrets[]> {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      [Query.equal("userId", userId), ...queries],
    );
    return await Promise.all(
      response.documents.map(
        (doc: Models.Document) =>
          this.decryptDocumentFields(
            doc,
            "totpSecrets",
          ) as Promise<TotpSecrets>,
      ),
    );
  }

  static async listFolders(
    userId: string,
    queries: string[] = [],
  ): Promise<Folders[]> {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      [Query.equal("userId", userId), ...queries],
    );
    return response.documents as unknown as Folders[];
  }

  static async listSecurityLogs(
    userId: string,
    queries: string[] = [],
  ): Promise<SecurityLogs[]> {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      [Query.equal("userId", userId), Query.orderDesc("timestamp"), ...queries],
    );
    return response.documents as unknown as SecurityLogs[];
  }

  // Update with automatic encryption
  static async updateCredential(
    id: string,
    data: Partial<Credentials>,
    options?: { linkedNoteIds?: string[] },
  ): Promise<Credentials> {
    const existing = await this.getCredential(id);
    const sanitizedData = this.sanitizeCredentialData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptDocumentFields(sanitizedData, "credentials");
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
      encryptedData,
    );
    this.clearCredentialCache(existing.userId);
    return (await this.decryptDocumentFields(
      doc,
      "credentials",
    )) as Credentials;
  }

  static async updateTOTPSecret(
    id: string,
    data: Partial<TotpSecrets>,
    options?: { linkedNoteIds?: string[] },
  ): Promise<TotpSecrets> {
    const existing = await this.getTOTPSecret(id);
    const sanitizedData = this.sanitizeTotpData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptDocumentFields(sanitizedData, "totpSecrets");
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
      encryptedData,
    );
    this.clearCredentialCache(existing.userId);
    return (await this.decryptDocumentFields(
      doc,
      "totpSecrets",
    )) as unknown as TotpSecrets;
  }

  static async updateFolder(
    id: string,
    data: Partial<Folders>,
  ): Promise<Folders> {
    const sanitizedData = { ...data };
    if (sanitizedData.name) {
      sanitizedData.name = sanitizeString(sanitizedData.name, 100);
    }
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id,
      sanitizedData as unknown as Record<string, unknown>,
    );
    return doc as unknown as Folders;
  }

  static async updateUserDoc(id: string, data: Partial<User>): Promise<User> {
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      id,
      data as unknown as Record<string, unknown>,
    );
    return doc as unknown as User;
  }

  static async updateSecurityLog(
    id: string,
    data: Partial<SecurityLogs>,
  ): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id,
      data as unknown as Record<string, unknown>,
    );
    return doc as unknown as SecurityLogs;
  }

  // Delete operations
  static async deleteCredential(id: string): Promise<void> {
    const existing = await this.getCredential(id);
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
    );
    this.clearCredentialCache(existing.userId);
  }

  static async deleteTOTPSecret(id: string): Promise<void> {
    const existing = await this.getTOTPSecret(id);
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
    );
    this.clearCredentialCache(existing.userId);
  }

  static async deleteFolder(id: string): Promise<void> {
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id,
    );
  }

  static async deleteSecurityLog(id: string): Promise<void> {
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id,
    );
  }

  static async deleteUserDoc(id: string): Promise<void> {
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      id,
    );
  }

  // --- Ecosystem: Flow ---
  static async listFlowTasks(userId: string, queries: string[] = []): Promise<{ total: number; documents: any[] }> {
    const res = await appwriteDatabases.listDocuments(
      FLOW_DATABASE_ID,
      FLOW_COLLECTION_ID_TASKS,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("$createdAt"), ...queries]
    );
    return { total: res.total, documents: res.documents };
  }

  static async listFlowEvents(userId: string, queries: string[] = []): Promise<{ total: number; documents: any[] }> {
    const res = await appwriteDatabases.listDocuments(
      FLOW_DATABASE_ID,
      FLOW_COLLECTION_ID_EVENTS,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("startTime"), ...queries]
    );
    return { total: res.total, documents: res.documents };
  }

  static async listFlowNotes(userId: string, queries: string[] = []): Promise<{ total: number; documents: any[] }> {
    const res = await appwriteDatabases.listDocuments(
      NOTE_DATABASE_ID,
      NOTE_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("$createdAt"), ...queries]
    );
    return { total: res.total, documents: res.documents };
  }

  // --- Security Event Logging ---
  static async logSecurityEvent(
    userId: string,
    eventType: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const extendedDetails = {
      ...details,
      ecosystemApp: APPWRITE_CONFIG.DATABASES.VAULT
    };
    await this.createSecurityLog({
      userId,
      eventType,
      details: JSON.stringify(extendedDetails),
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      timestamp: new Date().toISOString(),
      $permissions: [],
    } as any);
  }

  // --- Sanitization Helpers ---
  private static sanitizeCredentialData(data: Partial<Credentials>): Partial<Credentials> {
    const sanitized = { ...data };

    // Sanitize string fields that might be displayed as HTML
    if (sanitized.name) sanitized.name = sanitizeString(sanitized.name, 100);
    if (sanitized.username) sanitized.username = sanitizeString(sanitized.username, 255);
    // Note: We don't sanitize password as it needs to be exact
    // Note: Urls can be tricky to sanitize without breaking them, validation is better.
    // sanitizeString removes HTML tags which should be safe for URLs unless they are weird
    if (sanitized.url) sanitized.url = sanitizeString(sanitized.url, 2048);
    if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes, 10000);

    // Custom fields are JSON strings, we trust the validation/parser there or sanitize individual string values if we parse it.
    // For now, we leave customFields as is, assuming validation happened before.

    return sanitized;
  }

  private static sanitizeTotpData(data: Partial<TotpSecrets>): Partial<TotpSecrets> {
    const sanitized = { ...data };
    if (sanitized.issuer) sanitized.issuer = sanitizeString(sanitized.issuer, 100);
    if (sanitized.accountName) sanitized.accountName = sanitizeString(sanitized.accountName, 100);
    if (sanitized.url) sanitized.url = sanitizeString(sanitized.url, 2048);
    return sanitized;
  }

  // --- Encryption/Decryption Helpers ---
  private static async encryptDocumentFields(
    data: unknown,
    collectionType: keyof typeof COLLECTION_SCHEMAS,
  ): Promise<Record<string, unknown>> {
    const schema = COLLECTION_SCHEMAS[collectionType];
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    };

    try {
      const { encryptField, masterPassCrypto } = await import(
        "../masterpass-crypto"
      );

      if (!masterPassCrypto.isVaultUnlocked()) {
        throw new Error("Vault is locked - cannot encrypt data");
      }

      for (const field of schema.encrypted) {
        const fieldValue = result[field];
        if (this.shouldEncryptField(fieldValue)) {
          try {
            result[field] = await encryptField(String(fieldValue));
          } catch (error: unknown) {
            console.error(`Failed to encrypt field ${field}:`, error);
            throw new Error(`Encryption failed for ${field}: ${error}`);
          }
        } else {
          // Remove the field entirely if it's not a non-empty string
          delete result[field];
        }
      }
    } catch (importError) {
      console.error("Failed to import encryption module:", importError);
      throw new Error("Encryption module not available");
    }

    return result;
  }

  private static async decryptDocumentFields(
    doc: unknown,
    collectionType: keyof typeof COLLECTION_SCHEMAS,
  ): Promise<Record<string, unknown>> {
    const schema = COLLECTION_SCHEMAS[collectionType];
    const result: Record<string, unknown> = {
      ...(doc as Record<string, unknown>),
    };

    try {
      const { decryptField, masterPassCrypto } = await import(
        "../masterpass-crypto"
      );

      // Check if vault is unlocked before attempting decryption
      if (!masterPassCrypto.isVaultUnlocked()) {
        console.warn("Vault is locked - returning encrypted data as-is");
        return result;
      }

      for (const field of schema.encrypted) {
        const fieldValue = result[field];

        // Only decrypt if the field has encrypted data
        if (this.shouldDecryptField(fieldValue)) {
          try {
            console.log(
              `Decrypting field: ${field} for collection: ${collectionType}`,
            );
            result[field] = await decryptField(fieldValue as string);
          } catch (error: unknown) {
            console.error(`Failed to decrypt field ${field}:`, error);
            result[field] = "[DECRYPTION_FAILED]";
          }
        } else {
          // For null/undefined values, keep them as null
          result[field] =
            fieldValue === null
              ? null
              : fieldValue === undefined
                ? null
                : fieldValue;
          console.log(
            `Skipping decryption for field: ${field} (no encrypted data)`,
          );
        }
      }
    } catch (error: unknown) {
      console.error("Decryption module not available:", error);
      // Return original document if decryption module can't be loaded
    }

    return result;
  }

  // Helper method to determine if a field should be encrypted
  private static shouldEncryptField(value: unknown): boolean {
    // Only encrypt if value is a non-empty string
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "string" &&
      value.trim().length > 0
    );
  }

  // Helper method to determine if a field should be decrypted
  private static shouldDecryptField(value: unknown): boolean {
    // Only decrypt non-null, non-empty string values
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "string" &&
      value.trim().length > 0
    );
  }

  // --- Search Operations ---
  static async searchCredentials(
    userId: string,
    searchTerm: string,
  ): Promise<Credentials[]> {
    // Search must operate on all credentials since name is encrypted
    const allCredentials = await this.listAllCredentials(userId);
    const term = searchTerm.toLowerCase();

    return allCredentials.filter(
      (cred) =>
        cred.name?.toLowerCase().includes(term) ||
        cred.username?.toLowerCase().includes(term) ||
        (cred.url && cred.url.toLowerCase().includes(term)),
    );
  }

  // --- Bulk Operations ---
  static async bulkCreateCredentials(
    credentials: Omit<Credentials, "$id" | "$createdAt" | "$updatedAt">[],
  ): Promise<Credentials[]> {
    return await Promise.all(
      credentials.map((cred) => this.createCredential(cred)),
    );
  }

  static async exportUserData(
    userId: string,
    options: {
      credentials?: boolean;
      totpSecrets?: boolean;
      folders?: boolean;
    } = { credentials: true, totpSecrets: true, folders: true },
  ): Promise<{
    credentials?: Credentials[];
    totpSecrets?: TotpSecrets[];
    folders?: Folders[];
    version: string;
    exportedAt: string;
  }> {
    const credentialsPromise = options.credentials
      ? this.listAllCredentials(userId)
      : Promise.resolve<Credentials[] | undefined>(undefined);
    const totpPromise = options.totpSecrets
      ? this.listTOTPSecrets(userId)
      : Promise.resolve<TotpSecrets[] | undefined>(undefined);
    const foldersPromise = options.folders
      ? this.listFolders(userId)
      : Promise.resolve<Folders[] | undefined>(undefined);

    const [credentials, totpSecrets, folders] = await Promise.all([
      credentialsPromise,
      totpPromise,
      foldersPromise,
    ]);

    return {
      credentials,
      totpSecrets,
      folders,
      version: "1.0",
      exportedAt: new Date().toISOString(),
    };
  }

  // --- Storage Operations ---
  static async cloudBackup(userId: string): Promise<Models.File> {
    const data = await this.exportUserData(userId);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const file = new File([blob], `${APPWRITE_CONFIG.SYSTEM.RP_NAME}-backup-${new Date().getTime()}.json`, { type: "application/json" });

    return await appwriteStorage.createFile(
      APPWRITE_BUCKET_BACKUPS_ID,
      ID.unique(),
      file,
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
  }

  static async listCloudBackups(_userId: string): Promise<Models.FileList> {
    return await appwriteStorage.listFiles(
      APPWRITE_BUCKET_BACKUPS_ID,
      [Query.orderDesc("$createdAt")]
    );
  }
}

// --- 2FA / MFA Helpers (Following Official Appwrite Documentation) ---

/**
 * Generate recovery codes - MUST be done before enabling MFA
 * These are single-use passwords for account recovery
 */
export async function generateRecoveryCodes(): Promise<{
  recoveryCodes: string[];
}> {
  return await appwriteAccount.createMfaRecoveryCodes();
}

/**
 * Update a TOTP secret by document ID (encrypted).
 */
export async function updateTotpSecret(
  id: string,
  data: Partial<TotpSecrets>,
  options?: { linkedNoteIds?: string[] },
) {
  return await AppwriteService.updateTOTPSecret(id, data, options);
}

export async function shareCredential(
  credentialId: string,
  recipient: { userId: string; publicKey: string },
) {
  return await AppwriteService.shareCredential(credentialId, recipient);
}

export async function shareTotpSecret(
  totpSecretId: string,
  recipient: { userId: string; publicKey: string },
) {
  return await AppwriteService.shareTotpSecret(totpSecretId, recipient);
}

export async function listIncomingKeyMappings(userId: string) {
  return await AppwriteService.listIncomingKeyMappings(userId);
}

export async function acceptSharedCredential(mapping: KeyMapping) {
  return await AppwriteService.acceptSharedCredential(mapping);
}

export async function acceptSharedTotp(mapping: KeyMapping) {
  return await AppwriteService.acceptSharedTotp(mapping);
}

export async function deleteKeyMapping(id: string) {
  return await AppwriteService.deleteKeyMapping(id);
}

/**
 * List the most recently updated credentials for a user.
 */
export async function listRecentCredentials(userId: string, limit: number = 5) {
  return await AppwriteService.listRecentCredentials(userId, limit);
}

/**
 * List enabled MFA factors for current user
 * Returns: { totp: boolean, email: boolean, phone: boolean }
 */
export async function listMfaFactors(): Promise<{
  totp: boolean;
  email: boolean;
  phone: boolean;
}> {
  return await appwriteAccount.listMfaFactors();
}

/**
 * Enable/disable MFA enforcement on the account
 * Note: User must have at least 2 factors before MFA is enforced
 */
export async function updateMfaStatus(
  enabled: boolean,
): Promise<Models.Preferences> {
  return await appwriteAccount.updateMFA(enabled);
}

/**
 * Add TOTP authenticator factor (does NOT enable MFA yet)
 * Returns QR code URL and secret for authenticator app
 */
export async function addTotpFactor(): Promise<{
  qrUrl: string;
  secret: string;
}> {
  const result = await appwriteAccount.createMfaAuthenticator(
    AuthenticatorType.Totp,
  );
  // Generate QR code using Avatars API with smaller size (200px instead of 400px)
  const qrUrl = appwriteAvatars.getQR(result.uri, 200);
  return {
    qrUrl,
    secret: result.secret,
  };
}

/**
 * Remove TOTP authenticator factor
 */
export async function removeTotpFactor(): Promise<void> {
  await appwriteAccount.deleteMfaAuthenticator(AuthenticatorType.Totp);
}

/**
 * Verify TOTP factor using the proper MFA authenticator verification
 * This step confirms the authenticator app is working
 */
export async function verifyTotpFactor(otp: string): Promise<boolean> {
  try {
    // Use the proper MFA authenticator verification method
    await appwriteAccount.updateMfaAuthenticator(AuthenticatorType.Totp, otp);
    return true;
  } catch (error: unknown) {
    console.error("TOTP verification failed:", error);
    return false;
  }
}

/**
 * Create MFA challenge for login flow
 * factor: "totp" | "email" | "phone" | "recoverycode"
 */
export async function createMfaChallenge(
  factor: "totp" | "email" | "phone" | "recoverycode",
): Promise<{ $id: string }> {
  let authFactor: AuthenticationFactor;

  switch (factor) {
    case "totp":
      authFactor = AuthenticationFactor.Totp;
      break;
    case "email":
      authFactor = AuthenticationFactor.Email;
      break;
    case "phone":
      authFactor = AuthenticationFactor.Phone;
      break;
    case "recoverycode":
      authFactor = AuthenticationFactor.Recoverycode;
      break;
    default:
      throw new Error(`Unsupported MFA factor: ${factor}`);
  }

  return await appwriteAccount.createMfaChallenge(authFactor);
}

/**
 * Complete MFA challenge with code
 */
export async function completeMfaChallenge(
  challengeId: string,
  code: string,
): Promise<Models.Session> {
  return await appwriteAccount.updateMfaChallenge(challengeId, code);
}

/**
 * Check if user needs MFA after login
 * Returns true if MFA is required, false if not required, throws for other errors
 */
export async function checkMfaRequired(): Promise<boolean> {
  try {
    await appwriteAccount.get();
    return false; // If account.get() succeeds, no MFA required
  } catch (error: unknown) {
    const err = error as { type?: string };
    if (err.type === "user_more_factors_required") {
      return true; // MFA is required
    }
    // Re-throw other errors (like network issues, invalid session, etc.)
    throw error;
  }
}

/**
 * Robust MFA status check that determines authentication state
 * Returns: { needsMfa: boolean, isFullyAuthenticated: boolean, error?: string }
 */
export async function getMfaAuthenticationStatus(): Promise<{
  needsMfa: boolean;
  isFullyAuthenticated: boolean;
  error?: string;
}> {
  try {
    // Try to get account info
    const account = await appwriteAccount.get();
    console.log(
      "getMfaAuthenticationStatus: Account retrieved successfully",
      account,
    );

    // If successful, user is fully authenticated
    return {
      needsMfa: false,
      isFullyAuthenticated: true,
    };
  } catch (error: unknown) {
    const err = error as { type?: string; code?: number; message?: string };
    console.log("getMfaAuthenticationStatus: Error caught", {
      error,
      type: err.type,
      code: err.code,
      message: err.message,
    });

    // Check for MFA requirement using multiple possible error indicators
    if (
      err.type === "user_more_factors_required" ||
      (err.code === 401 && err.message?.includes("more factors")) ||
      err.message?.includes("More factors are required") ||
      err.message?.includes("user_more_factors_required")
    ) {
      console.log("getMfaAuthenticationStatus: MFA required detected");
      // User is partially authenticated but needs MFA
      return {
        needsMfa: true,
        isFullyAuthenticated: false,
      };
    }

    console.log("getMfaAuthenticationStatus: Not authenticated");
    // For other errors (network, invalid session, etc.)
    return {
      needsMfa: false,
      isFullyAuthenticated: false,
      error: err.message || "Authentication check failed",
    };
  }
}

/**
 * Add Email as an MFA factor (must be verified first).
 * Note: If email is already verified for login, it should automatically be available as MFA factor
 */
export async function addEmailFactor(
  email: string,
  password?: string,
): Promise<{ email: string }> {
  try {
    // Check if email is already verified by trying to use it as MFA factor
    const factors = await listMfaFactors();
    if (factors.email) {
      return { email };
    }

    // If not verified, try to verify it
    // Note: This might not be needed if user's email is already verified for their account
    if (password) {
      await appwriteAccount.updateEmail(email, password);
    }

    // Send verification email
    await appwriteAccount.createVerification(
      window.location.origin + "/"
    );
    return { email };
  } catch (error: unknown) {
    // Email might already be usable as MFA factor even if this fails
    console.log("Email factor setup note:", error);
    return { email };
  }
}

/**
 * Complete email verification for MFA (after user clicks link in email).
 * Call this with the userId and secret from the verification link.
 */

/**
 * Initiate password recovery (send reset email).
 * @param email User's email
 * @param redirectUrl URL to redirect after clicking email link (must be allowed in Appwrite console)
 */
export async function createPasswordRecovery(
  email: string,
  redirectUrl: string,
) {
  return await appwriteAccount.createRecovery(email, redirectUrl);
}

/**
 * Complete password recovery (reset password).
 * @param userId User ID from query param
 * @param secret Secret from query param
 * @param password New password
 */
export async function updatePasswordRecovery(
  userId: string,
  secret: string,
  password: string,
) {
  return await appwriteAccount.updateRecovery(userId, secret, password);
}

// --- Email/password login/register ---

/**
 * Email/password login
 */
export async function loginWithEmailPassword(email: string, password: string) {
  return await appwriteAccount.createEmailPasswordSession(email, password);
}

/**
 * Register with email/password
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  name?: string,
) {
  return await appwriteAccount.create(ID.unique(), email, password, name);
}

/**
 * Email OTP: Send OTP to email (returns { userId, phrase? })
 */
export async function sendEmailOtp(email: string, enablePhrase = false) {
  return await appwriteAccount.createEmailToken(
    ID.unique(),
    email,
    enablePhrase,
  );
}

/**
 * Email OTP: Complete OTP login (returns session)
 */
export async function completeEmailOtp(userId: string, otp: string) {
  return await appwriteAccount.createSession(userId, otp);
}

// --- Standalone Service Functions ---

export async function listFolders(userId: string, queries: string[] = []) {
  const response = await appwriteDatabases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTION_FOLDERS_ID,
    [Query.equal("userId", userId), ...queries],
  );
  // Cast via unknown to avoid strict TS overlap errors from Appwrite DefaultDocument
  return (response.documents ?? response) as unknown as Folders[];
}

export async function updateFolder(id: string, data: Partial<Folders>) {
  return await AppwriteService.updateFolder(id, data);
}

export async function deleteFolder(id: string) {
  return await AppwriteService.deleteFolder(id);
}

/**
 * Create a new folder.
 */
export async function createFolder(
  data: FoldersCreate,
) {
  return await AppwriteService.createFolder(data);
}

/**
 * Create a new TOTP secret (encrypted).
 */
export async function createTotpSecret(
  data: TotpSecretsCreate,
  options?: { linkedNoteIds?: string[] },
) {
  return await AppwriteService.createTOTPSecret(data, options);
}

/**
 * List TOTP secrets for a user (decrypted).
 */
export async function listTotpSecrets(userId: string, queries: string[] = []) {
  return await AppwriteService.listTOTPSecrets(userId, queries);
}

/**
 * Delete a TOTP secret by document ID.
 */
export async function deleteTotpSecret(id: string) {
  return await AppwriteService.deleteTOTPSecret(id);
}

/**
 * Update user profile (name/email).
 * A password must be provided if the user wants to change their email.
 */
export async function updateUserProfile(
  userId: string,
  data: { name?: string; email?: string },
  password?: string,
) {
  // Update Appwrite account name/email if changed
  if (data.name) {
    await appwriteAccount.updateName(data.name);
  }
  if (data.email) {
    // Appwrite requires a password to change the email address.
    await appwriteAccount.updateEmail(data.email, password || "");
  }

  // Update user doc in DB if email was changed
  if (data.email) {
    const userDoc = await AppwriteService.getUserDoc(userId);
    if (userDoc?.$id) {
      await AppwriteService.updateUserDoc(userDoc.$id, { email: data.email });
    }
  }
}

/**
 * Export all user data (credentials, totp, folders).
 */
export async function exportAllUserData(userId: string, options?: {
  credentials?: boolean;
  totpSecrets?: boolean;
  folders?: boolean;
}) {
  return await AppwriteService.exportUserData(userId, options);
}

/**
 * Backup user data to cloud storage.
 */
export async function cloudBackup(userId: string) {
  return await AppwriteService.cloudBackup(userId);
}

/**
 * List user's cloud backups.
 */
export async function listCloudBackups(userId: string) {
  return await AppwriteService.listCloudBackups(userId);
}


/**
 * Delete user account and all associated data.
 * This is a hard delete and is irreversible.
 */
export async function deleteUserAccount(_userId: string) {
  // Delete all user data from the database first
  const [creds, totps, folders, logs, userDoc] = await Promise.all([
    AppwriteService.listAllCredentials(_userId), // Use listAllCredentials to ensure all are deleted
    AppwriteService.listTOTPSecrets(_userId),
    AppwriteService.listFolders(_userId),
    AppwriteService.listSecurityLogs(_userId),
    AppwriteService.getUserDoc(_userId),
  ]);

  await Promise.all([
    ...creds.map((c: Credentials) => AppwriteService.deleteCredential(c.$id)),
    ...totps.map((t: TotpSecrets) => AppwriteService.deleteTOTPSecret(t.$id)),
    ...folders.map((f: Folders) => AppwriteService.deleteFolder(f.$id)),
    ...logs.map((l: SecurityLogs) => AppwriteService.deleteSecurityLog(l.$id)),
    userDoc?.$id
      ? AppwriteService.deleteUserDoc(userDoc.$id)
      : Promise.resolve(),
  ]);

  // Log the user out
  await appwriteAccount.deleteSession("current");

  // Finally, delete the Appwrite account itself
  // Note: Account deletion may not be available in all Appwrite versions
  // await appwriteAccount.delete();
}

/**
 * Check if user has set master password (returns boolean).
 */
export async function hasMasterpass(userId: string): Promise<boolean> {
  return await AppwriteService.hasMasterpass(userId);
}

/**
 * Set master password flag for user (after first setup).
 */
export async function setMasterpassFlag(
  userId: string,
  email: string,
): Promise<void> {
  return await AppwriteService.setMasterpassFlag(userId, email);
}

/**
 * Reset master password and wipe all user data.
 * This should be called after 2FA/email verification is successful.
 */
export async function resetMasterpassAndWipe(userId: string): Promise<void> {
  // Helper to delete all documents in a collection for a user in parallel batches
  const deleteCollectionDocs = async (collectionId: string, databaseId: string = APPWRITE_DATABASE_ID, customQueries: string[] = []) => {
    try {
      let hasMore = true;
      const baseQueries = customQueries.length > 0 ? customQueries : [Query.equal("userId", userId)];

      while (hasMore) {
        const response = await appwriteDatabases.listDocuments(
          databaseId,
          collectionId,
          [...baseQueries, Query.limit(50)],
        );

        if (response.documents.length === 0) {
          hasMore = false;
          break;
        }

        // Delete in parallel
        await Promise.all(
          response.documents.map((doc) =>
            appwriteDatabases
              .deleteDocument(databaseId, collectionId, doc.$id)
              .catch((e) => console.warn(`Failed to delete doc ${doc.$id} in ${collectionId}`, e))
          )
        );

        // If we got fewer than limit, we're done
        if (response.documents.length < 50) {
          hasMore = false;
        }
      }
    } catch (e: unknown) {
      console.error(`Failed to wipe collection ${collectionId} in database ${databaseId}`, e);
    }
  };

  // Execute deletions for all core vault collections in parallel
  const wipePromises = [
    deleteCollectionDocs(APPWRITE_COLLECTION_USER_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_CREDENTIALS_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_TOTPSECRETS_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_FOLDERS_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_SECURITYLOGS_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_KEYCHAIN_ID),
    deleteCollectionDocs(APPWRITE_COLLECTION_IDENTITIES_ID, PASSWORD_MANAGER_DATABASE_ID),
  ];

  // Ecosystem Chat Wipe: Personal/Saved Messages
  const wipeChatData = async () => {
    try {
      // 1. Find self-chats (direct chats where the user is the only participant or repeated)
      const memberRows = await appwriteDatabases.listDocuments(
        CHAT_DATABASE_ID,
        "conversationMembers",
        [
          Query.equal("userId", userId),
          Query.limit(1000)
        ]
      );
      const conversationIds = Array.from(new Set((memberRows.documents || []).map((row: any) => row.conversationId).filter(Boolean)));
      const selfChats = conversationIds.length ? await appwriteDatabases.listDocuments(
        CHAT_DATABASE_ID,
        CHAT_COLLECTION_CONVERSATIONS_ID,
        [
          Query.equal("$id", conversationIds),
          Query.equal("type", "direct")
        ]
      ) : { documents: [] as any[] };

      for (const conv of selfChats.documents) {
        const participants = Array.isArray(conv.participants) ? conv.participants : [userId];
        const isSelf = participants.length === 1 || participants.every((p: string) => p === userId);

        if (isSelf) {
          // Nuclear wipe messages in this self-chat
          await deleteCollectionDocs(CHAT_COLLECTION_MESSAGES_ID, CHAT_DATABASE_ID, [Query.equal("conversationId", conv.$id)]);
          // Delete the conversation itself
          await appwriteDatabases.deleteDocument(CHAT_DATABASE_ID, CHAT_COLLECTION_CONVERSATIONS_ID, conv.$id).catch(() => null);
        }
      }

      // 2. Clear publicKey in Chat Users (this makes existing encrypted chats un-addressable with old identity)
      const chatUserDoc = await appwriteDatabases.listDocuments(CHAT_DATABASE_ID, CHAT_COLLECTION_USERS_ID, [Query.equal("$id", userId)]).then(res => res.documents[0]).catch(() => null);
      if (chatUserDoc) {
        await appwriteDatabases.updateDocument(CHAT_DATABASE_ID, CHAT_COLLECTION_USERS_ID, userId, {
          publicKey: ""
        }).catch(err => console.warn("Failed to clear chat public key:", err));
      }
    } catch (err) {
      console.error("Ecosystem chat wipe failed:", err);
    }
  };

  await Promise.all([...wipePromises, wipeChatData()]);
}

/**
 * Search credentials for a user (Client-side only for encrypted data)
 */
export async function searchCredentials(
  userId: string,
  searchTerm: string,
): Promise<Credentials[]> {
  // Since 'name' and other fields are encrypted, server-side search won't work effectively.
  // We strictly use client-side search on decrypted data.
  return await AppwriteService.searchCredentials(userId, searchTerm);
}

/**
 * List all credentials for a user (decrypted and paginated).
 */
export async function listCredentials(
  userId: string,
  limit: number = 25,
  offset: number = 0,
) {
  return await AppwriteService.listCredentials(userId, limit, offset);
}

/**
 * Fetches ALL credentials for a user, handling pagination automatically.
 * Use this for operations that require the full dataset, like search or export.
 */
export async function listAllCredentials(
  userId: string,
  queries: string[] = [],
): Promise<Credentials[]> {
  return await AppwriteService.listAllCredentials(userId, queries);
}

/**
 * Create a new credential (encrypted).
 */
export async function createCredential(
  data: CredentialsCreate,
  options?: { linkedNoteIds?: string[] },
) {
  return await AppwriteService.createCredential(data, options);
}

/**
 * Update a credential by document ID (encrypted).
 */
export async function updateCredential(
  id: string,
  data: Partial<Credentials>,
  options?: { linkedNoteIds?: string[] },
) {
  return await AppwriteService.updateCredential(id, data, options);
}

/**
 * Delete a credential by document ID.
 */
export async function deleteCredential(id: string) {
  return await AppwriteService.deleteCredential(id);
}

/**
 * Unified authentication state handler
 * Determines the correct next route after login/registration
 */
export async function getAuthenticationNextRoute(
  userId: string,
): Promise<string> {
  try {
    // First check if MFA is required
    const mfaStatus = await getMfaAuthenticationStatus();

    if (mfaStatus.needsMfa) {
      return "/twofa/access";
    }

    if (!mfaStatus.isFullyAuthenticated) {
      throw new Error(mfaStatus.error || "Authentication failed");
    }

    // User is fully authenticated, check master password
    const hasMp = await hasMasterpass(userId);
    if (!hasMp) {
      return "/vault";
    }

    // Check if vault is unlocked
    try {
      const { masterPassCrypto } = await import(
        "../masterpass-crypto"
      );
      if (!masterPassCrypto.isVaultUnlocked()) {
        return "/vault";
      }
    } catch {
      // If can't import crypto module, assume needs master password
      return "/vault";
    }

    // Everything is ready, go to dashboard
    return "/vault";
  } catch (error: unknown) {
    console.error("Error determining authentication route:", error);
    throw error;
  }
}

/**
 * Redirects authenticated users to /vault (after master password unlock in drawer) as appropriate.
 * Updated to use the new MFA-aware authentication flow
 */
export async function redirectIfAuthenticated(
  user: { $id: string },
  isVaultUnlocked: () => boolean,
  router: { replace: (path: string) => void },
) {
  if (user) {
    try {
      const nextRoute = await getAuthenticationNextRoute(user.$id);
      router.replace(nextRoute);
      return true;
    } catch {
      // Fallback to original logic if there's an error
      const hasMp = await hasMasterpass(user.$id);
      if (!hasMp || !isVaultUnlocked()) {
        router.replace("/vault");
        return true;
      } else {
        router.replace("/vault");
        return true;
      }
    }
  }
  return false;
}

/**
 * Logs out the current user from Appwrite and clears session/local storage.
 * Use this everywhere for a consistent logout experience.
 */
export async function logoutAppwrite() {
  try {
    await appwriteAccount.deleteSession("current");
  } catch { }
  invalidateCurrentUserCache();
  // Clear vault/session data
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("vault_unlocked");
    sessionStorage.removeItem("kylrix_vault_unlocked");
    localStorage.removeItem("vault_timeout_minutes");
    // Optionally clear other app-specific keys here
  }
}

/**
 * Remove individual MFA factors and update user doc accordingly
 */
export async function removeMfaFactor(
  factorType: "totp" | "email" | "phone",
): Promise<void> {
  if (factorType === "totp") {
    await removeTotpFactor();
  }
  // Add handling for other factor types as Appwrite supports them
  // Note: Email factor removal is not straightforward in Appwrite
  // as verified emails are tied to the account itself
}

/**
 * Unified MFA status check that returns comprehensive MFA information
 * This should be used everywhere for consistent MFA status detection
 */
export async function getUnifiedMfaStatus(userId?: string): Promise<{
  isEnforced: boolean;
  factors: { totp: boolean; email: boolean; phone: boolean };
  requiresSetup: boolean;
  needsAuthentication: boolean;
  error?: string;
}> {
  try {
    // First check what factors are available
    const factors = await listMfaFactors();
    const hasAnyFactor = factors.totp || factors.email || factors.phone;

    // For logged-in users, we need to check MFA status differently
    // The account.get() method won't throw "user_more_factors_required" for already authenticated users
    // We need to determine MFA enforcement from the user document and factors
    let isEnforced = false;
    const needsAuthentication = false;

    // If user has factors, check if MFA is actually enforced by looking at user doc
    if (hasAnyFactor && userId) {
      try {
        const userDoc = await AppwriteService.getUserDoc(userId);
        isEnforced = userDoc?.twofa === true;
      } catch (error: unknown) {
        console.warn("Could not check user MFA status from database:", error);
        // Fallback: if user has factors, assume MFA should be enforced
        isEnforced = hasAnyFactor;
      }
    }

    const requiresSetup = !hasAnyFactor || !isEnforced;

    // Sync database status if userId is provided
    if (userId) {
      try {
        const userDoc = await AppwriteService.getUserDoc(userId);
        const dbMfaStatus = userDoc?.twofa === true;

        // If database status doesn't match actual enforcement, update it
        if (dbMfaStatus !== isEnforced && userDoc?.$id) {
          await AppwriteService.updateUserDoc(userDoc.$id, {
            twofa: isEnforced,
          });
        }
      } catch (error: unknown) {
        console.warn("Failed to sync MFA status with database:", error);
      }
    }

    return {
      isEnforced,
      factors,
      requiresSetup,
      needsAuthentication,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      isEnforced: false,
      factors: { totp: false, email: false, phone: false },
      requiresSetup: false,
      needsAuthentication: false,
      error: err.message || "Failed to check MFA status",
    };
  }
}

/**
 * Get MFA status directly from Appwrite account (native method)
 */
export async function getAppwriteMfaStatus(): Promise<{
  isEnforced: boolean;
  factors: { totp: boolean; email: boolean; phone: boolean };
}> {
  try {
    // Get factors available for MFA
    const factors = await listMfaFactors();

    // Get current user account info
    const account = await appwriteAccount.get();

    // Check if MFA is enforced by looking at account.mfa property
    // This is the most reliable way to check actual MFA enforcement
    const isEnforced = account.mfa || false;

    return {
      isEnforced,
      factors,
    };
  } catch (error: unknown) {
    console.error("Failed to get Appwrite MFA status:", error);
    return {
      isEnforced: false,
      factors: { totp: false, email: false, phone: false },
    };
  }
}

/**
 * Sync and validate MFA status between Appwrite and database
 * This function ensures the database user.twofa field matches Appwrite's actual MFA status
 */
export async function syncAndValidateMfaStatus(userId: string): Promise<{
  wasOutOfSync: boolean;
  currentStatus: boolean;
  error?: string;
}> {
  try {
    // Get MFA status from Appwrite (source of truth)
    const appwriteStatus = await getAppwriteMfaStatus();

    // Get current database status
    let databaseStatus = false;
    let userDocId: string | null = null;

    try {
      const userDocResponse = await appwriteDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        [Query.equal("userId", userId)],
      );

      if (userDocResponse.documents.length > 0) {
        const userDoc = userDocResponse.documents[0];
        databaseStatus = userDoc.twofa === true;
        userDocId = userDoc.$id;
      }
    } catch (dbError) {
      console.warn("Could not read user document for MFA sync:", dbError);
      return {
        wasOutOfSync: false,
        currentStatus: appwriteStatus.isEnforced,
        error: "Could not access database",
      };
    }

    // Check if they're out of sync
    const wasOutOfSync = databaseStatus !== appwriteStatus.isEnforced;

    // If out of sync, update database to match Appwrite
    if (wasOutOfSync && userDocId) {
      try {
        await appwriteDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_USER_ID,
          userDocId,
          { twofa: appwriteStatus.isEnforced },
        );
        console.log(
          `MFA status synced: database updated from ${databaseStatus} to ${appwriteStatus.isEnforced}`,
        );
      } catch (updateError) {
        console.error("Failed to sync MFA status to database:", updateError);
        return {
          wasOutOfSync,
          currentStatus: appwriteStatus.isEnforced,
          error: "Could not update database",
        };
      }
    }

    return {
      wasOutOfSync,
      currentStatus: appwriteStatus.isEnforced,
    };
  } catch (error: unknown) {
    console.error("Failed to sync MFA status:", error);
    const err = error as { message?: string };
    return {
      wasOutOfSync: false,
      currentStatus: false,
      error: err.message || "Sync failed",
    };
  }
}
