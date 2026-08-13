# Vault Loading — Secrets / TOTP — Full Audit

> **Status (2026-08-13): NOTHING LOADS — both `Secrets` and `TOTP` tabs render empty.**  
> `Secrets` shows `No Secrets Found` skeleton; `TOTP` shows empty list + spinner then empty. Console: `[Vault] Fetched 0 credentials via LocalEngine+VaultService` / `[TOTP] Successfully fetched 0 TOTP secrets` when bug present. File is **read-only audit** — do not use as fix plan without re-verifying against live code.

---

## 1. Object Shapes — Source of Truth

### 1.1 Generated types — `generated/appwrite/types.ts`

Both extend `Models.Row` (`$id`, `$createdAt`, `$updatedAt`, `$permissions`, `$databaseId`, `$tableId`, `$sequence`).

#### `Credentials` / `CredentialsCreate` (`credentials` table, `passwordManagerDb`)

```ts
export type CredentialsCreate = {
    "userId": string;
    "itemType": string;               // "login" | "card" | ...
    "name": string;
    "url"?: string | null;
    "notes"?: string | null;
    "totpId"?: string | null;
    "password"?: string | null;
    "cardNumber"?: string | null;
    "cardholderName"?: string | null;
    "cardExpiry"?: string | null;
    "cardCVV"?: string | null;
    "cardPIN"?: string | null;
    "cardType"?: string | null;
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "customFields"?: string | null;   // JSON string
    "faviconUrl"?: string | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastAccessedAt"?: string | null;
    "passwordChangedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "username"?: string | null;       // encrypted
    "sharedFrom"?: string | null;
    "attachments"?: string | null;    // JSON string
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;            // wrapped DEK (masterpass-crypto)
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
    "isWorkspace"?: boolean;
};
export type Credentials = Models.Row & CredentialsCreate;
```

Encrypted at rest (client-side, on top of Appwrite column encryption) — `lib/appwrite/vault-service.ts: ENCRYPTED_FIELDS.credentials`:

```ts
const ENCRYPTED_FIELDS = {
  credentials: ["name","url","username","password","notes","customFields","cardNumber","cardholderName","cardExpiry","cardCVV","cardPIN"],
  totpSecrets: ["issuer","accountName","secretKey","url"],
  // ...
}
```

Plaintext handle fields: `userId`, `itemType`, `totpId`, `cardType`, `folderId`, `tags`, `faviconUrl`, `isFavorite`, `isDeleted`, `deletedAt`, `lastAccessedAt`, `passwordChangedAt`, `createdAt`, `updatedAt`, `sharedFrom`, `attachments`, `isPublic`, `isGuest`, `isShared`, `isPinned`, `source`, `dek`, `keepPermission`, `isTrash`, `isWorkspace`, plus `$id` etc.

#### `TotpSecrets` / `TotpSecretsCreate` (`totpSecrets` table, `passwordManagerDb`)

```ts
export type TotpSecretsCreate = {
    "userId": string;
    "issuer": string;                 // encrypted
    "accountName": string;            // encrypted
    "secretKey": string;              // encrypted — CRITICAL
    "algorithm": string;              // "SHA1" | "SHA256" ...
    "digits": number;                 // 6..8
    "period": number;                 // 15..300
    "url"?: string | null;            // encrypted (otpauth://)
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastUsedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "sharedFrom"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
    "isWorkspace"?: boolean;
};
export type TotpSecrets = Models.Row & TotpSecretsCreate;
```

### 1.2 Appwrite schema — `appwrite.config.json` (excerpt)

**`credentials` columns (relevant for filtering):**

| key | type | required | encrypt | default |
|---|---|---|---|---|
| userId | string 255 | true | false | null |
| itemType | string 50 | true | false | null |
| name | string 255 | true | **true** | null |
| url | string 2048 | false | true | null |
| notes | string 65535 | false | true | null |
| totpId | string 255 | false | false | null |
| password | string 1000 | false | true | null |
| folderId | string 255 | false | false | null |
| tags | string[ ] 100 | false | false | null |
| isFavorite | boolean | false | — | false |
| isDeleted | boolean | false | — | false |
| deletedAt | datetime | false | — | null |
| isPublic/isGuest/isShared/isPinned | boolean | false | — | null |
| dek | string 1000 | false | false | null |
| isTrash/isWorkspace | boolean | false | — | false |
| keepPermission | boolean | false | — | null |

Indexes: `idx_userId(userId)`, `idx_itemType`, `idx_folderId`, `idx_isFavorite`, `idx_isDeleted`, `idx_totpId`, `idx_lastAccessed(lastAccessedAt DESC)`, `idx_user_type(userId,itemType)`, `idx_tags(tags)`, `idx_credentials_public(userId,isPublic)`, `idx_credentials_guest(userId,isGuest)`, `idx_credentials_shared(userId,isShared)`, `idx_credentials_pinned(userId,isPinned)`.

**`totpSecrets` columns:** `userId`*, `issuer`* enc, `accountName`* enc, `secretKey`* enc, `algorithm`* , `digits`* (6-8), `period`* (15-300), `url` enc, `folderId`, `tags[]`, `isFavorite`, `isDeleted`, `deletedAt`, `lastUsedAt`, `createdAt`, `updatedAt`, `sharedFrom`, `isPublic/isGuest/isShared/isPinned`, `source`, `dek` 5000, `keepPermission`, `isTrash/isWorkspace`.  
Indexes: `idx_userId`, `idx_folderId`, `idx_isFavorite`, `idx_isDeleted`, `idx_lastUsed(lastUsedAt DESC)`, `idx_tags`, `idx_totp_public(userId,isPublic)`, `idx_totp_guest`, `idx_totp_shared`, `idx_totp_pinned`.

`*` required.

**Database/table IDs — `generated/appwrite/constants.ts` + `APPWRITE_CONFIG`:**
`PROJECT_ID=67fe9627001d97e37ef3`, `ENDPOINT=https://api.kylrix.space/v1` (generated) vs `https://fra.cloud.appwrite.io/v1` (config — note mismatch, handled by `normalizeEndpoint` retry). `passwordManagerDb` is the single DB; `credentials` and `totpSecrets` live inside it (mandate: never `whisperrflow`).

---

## 2. Every Filtering Logic Currently In Place (code snippets)

### 2.1 Unified Object Service — `lib/services/unified-object-service.ts`

Central map + read path. Vault is two kinds sharing tables:

```ts
const OBJECT_TABLES: Record<string, TableConfig> = {
  secret:     { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, ownerField: 'userId' },
  credential: { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, ownerField: 'userId' },
  totp:       { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, ownerField: 'userId' },
  totpSecret: { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, ownerField: 'userId' },
  // ...
};
function resolveConfig(kind: ObjectKind): TableConfig {
  const key = String(kind).toLowerCase();
  const cfg = OBJECT_TABLES[key] || OBJECT_TABLES[key.replace(/s$/, '')];
  if (!cfg) throw new Error(`[unified] unknown kind: ${kind}`);
  return cfg;
}
```

Read — client SDK only, with index-missing fallback (no `Query.or` array — would be rejected):

```ts
export async function unifiedRead<T extends Models.Row>(kind: ObjectKind, queries: string[] = []): Promise<{ total: number; rows: T[] }> {
  const { databaseId, tableId } = resolveConfig(kind);
  try {
    const { databases } = await import('@/lib/appwrite/client');
    const res = await databases.listRows(databaseId, tableId, queries);
    return { total: res.total, rows: res.rows as unknown as T[] };
  } catch (e: any) {
    console.warn(`[unified] read ${kind} filtered failed, falling back:`, e?.message || e);
    try {
      const { databases } = await import('@/lib/appwrite/client');
      const res = await databases.listRows(databaseId, tableId, []);
      const ownerQ = queries.find(q => { try { const p = JSON.parse(q); return p.attribute === 'userId' || p.attribute === 'ownerId' || p.attribute === 'creatorId'; } catch { return false; } });
      if (ownerQ) {
        try {
          const parsed = JSON.parse(ownerQ);
          const ownerVal = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
          if (ownerVal) {
            const filtered = (res.rows as any[]).filter(r => r.userId === ownerVal || r.ownerId === ownerVal || r.creatorId === ownerVal);
            return { total: filtered.length, rows: filtered as unknown as T[] };
          }
        } catch {}
      }
      return { total: res.total, rows: res.rows as unknown as T[] };
    } catch (e2) {
      console.error(`[unified] read ${kind} fallback failed:`, e2);
      return { total: 0, rows: [] };
    }
  }
}
```

Create/update/delete go via `lib/actions/client-ops` (client) → `lib/actions/secure-ops` (server `node-appwrite`) — **never direct `databases.createRow` from UI**. Owner permission is set on create:

```ts
const perms = opts?.permissions || (ownerId ? [Permission.read(Role.user(ownerId))] : []);
// client-ops: createRow(databaseId, tableId, data, perms)
```

### 2.2 LocalEngine — `lib/services/LocalEngine.ts`

UI must never hit Appwrite directly. Two live paths:

**`query` — RxDB cache-first + background refresh + never wipe populated cache with empty fetch (vault starter bug fix):**

```ts
async query<T>(cacheKey: string, fetcher: (jwt?: string) => Promise<T>, opts?: { ttl?: number; realtimeChannel?: string }): Promise<T> {
  const cached = await this.cacheGet<T>(cacheKey, opts?.ttl);
  if (cached) {
    if (opts?.realtimeChannel) void this.subscribeRealtime(opts.realtimeChannel);
    void (async () => {
      try {
        const jwt = await getFreshJWT();
        const fresh = await fetcher(jwt);
        if (JSON.stringify(fresh) === JSON.stringify(cached)) return;
        const isFreshEmpty = Array.isArray(fresh) ? (fresh as any).length === 0 : (fresh as any)?.rows ? (fresh as any).rows.length === 0 : !fresh;
        const isCachedPopulated = Array.isArray(cached) ? (cached as any).length > 0 : (cached as any)?.rows ? (cached as any).rows.length > 0 : !!cached;
        if (isCachedPopulated && isFreshEmpty) return;
        await this.cacheSet(cacheKey, fresh as any);
      } catch {}
    })();
    return cached;
  }
  const jwt = await getFreshJWT();
  const fresh = await fetcher(jwt);
  await this.cacheSet(cacheKey, fresh as any);
  if (opts?.realtimeChannel) void this.subscribeRealtime(opts.realtimeChannel);
  return fresh;
}
```

**`fetch` — unifiedRead + same failsafe (used if UI opts into unified path):**

```ts
async fetch<T extends Models.Row>(kind: string, queries: string[] = [], opts?: { force?: boolean; cacheKey?: string; ttl?: number }): Promise<{ total: number; rows: T[] }> {
  const { unifiedRead } = await import('./unified-object-service');
  const cacheKey = opts?.cacheKey || `local:${kind}:${JSON.stringify(queries)}`;
  if (!opts?.force) {
    const cached = await this.cacheGet<{ total: number; rows: T[] }>(cacheKey, opts?.ttl);
    if (cached && Array.isArray((cached as any).rows) && (cached as any).rows.length) {
      void unifiedRead(kind, queries).then(fresh => {
        const isFreshEmpty = (fresh as any)?.rows ? (fresh as any).rows.length === 0 : !fresh;
        if (isFreshEmpty) return;
        return this.cacheSet(cacheKey, fresh);
      }).catch(()=>{});
      return cached;
    }
  }
  const fresh = await unifiedRead<T>(kind, queries);
  await this.cacheSet(cacheKey, fresh as any);
  return fresh;
}
```

`instantWrite/lazyWrite/batchedWrite` also dispatch `kylrix:nexus:update` for live UI.

### 2.3 VaultService — `lib/appwrite/vault-service.ts`

This is the actual network layer for vault; **all list paths fan out via `listRowsMergedAcrossFilters` + decrypt**.

**Owner filter builders:**

```ts
function getCredentialOwnerIndexQueries(userId: string): string[] {
  return [Query.equal("userId", userId)];
}
function buildCredentialOwnerFilterQueries(userId: string, resourceIds: string[] = []): string[] {
  const queries = [Query.equal("userId", userId)];
  if (resourceIds.length > 0) {
    const CHUNK = 50;
    for (let i = 0; i < resourceIds.length; i += CHUNK) {
      queries.push(Query.equal("$id", resourceIds.slice(i, i + CHUNK)));
    }
  }
  return queries;
}
```

`resourceIds` come from `getCollaboratedResourceIds` — **only shared rows where `isShared=true`**:

```ts
private static async getCollaboratedResourceIds(userId: string, resourceType: 'secret' | 'totp'): Promise<string[]> {
  try {
    const response = await originalAppwriteDatabases.listRows(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_KEY_MAPPING_ID, [
      Query.equal('grantee', userId),
      Query.equal('resourceType', resourceType === 'secret' ? 'credential' : 'totp'),
      Query.equal('isShared', true),
      Query.limit(100)
    ]);
    const rows = Array.isArray(response?.rows) ? response.rows : [];
    return rows.map((row: any) => row.resourceId).filter(Boolean);
  } catch (error) {
    console.error(`[VaultService] Failed to list collaborated resource IDs for ${resourceType}:`, error);
    return [];
  }
}
```

**Merged fan-out (the critical filtering step):**

```ts
async function listRowsMergedAcrossFilters(tableId: string, filterQueries: string[], extraQueries: string[] = []): Promise<Models.Row[]> {
  const byId = new Map<string, Models.Row>();
  const pageSize = 100;
  await Promise.all(filterQueries.map(async (filterQuery) => {
    let offset = 0;
    let response: Models.RowList<Models.Row> | null = null;
    try {
      do {
        response = await listRowsWithRetry(tableId, [filterQuery, Query.limit(pageSize), Query.offset(offset), ...extraQueries]);
        const rows = Array.isArray(response?.rows) ? response.rows : [];
        for (const row of rows) byId.set(row.$id, row);
        offset += pageSize;
      } while (Array.isArray(response?.rows) && response.rows.length > 0 && offset < (response.total || 0));
    } catch (e) {
      console.warn("[vault] listRowsMerged filter skipped:", (e as any)?.message || e);
    }
  }));
  return Array.from(byId.values());
}
function sortMergedRows(rows: Models.Row[], queries: string[]): Models.Row[] {
  // parses Query.orderAsc/orderDesc and localeCompare sorts; if none, returns as-is
}
async function listRowsWithRetry(tableId: string, queries: string[] = []): Promise<Models.RowList<Models.Row>> {
  try {
    return await databases.listRows(APPWRITE_DATABASE_ID, tableId, queries);
  } catch (err) {
    if (!isFetchNetworkError(err)) throw err;
    // retry once after normalizeEndpoint (envEp or window.location.origin + /v1)
    // else throws "Network request to Appwrite failed. Check NEXT_PUBLIC_APPWRITE_ENDPOINT, CORS, and /v1 suffix."
  }
}
```

**List entry points (all follow same pattern):**

```ts
static async listAllCredentials(userId: string, queries: string[] = []): Promise<Credentials[]> {
  this.ensureRuntimeSecurityHooks();
  const cacheKey = `${userId}:${JSON.stringify(queries)}`;
  const cached = this.credentialsListCache.get(cacheKey);
  if (cached) return cached.map((doc) => ({ ...doc }));
  const pending = this.credentialsListInflight.get(cacheKey);
  if (pending) return pending;
  const request = (async () => {
    const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
    const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
    const mergedRows = sortMergedRows(await listRowsMergedAcrossFilters(APPWRITE_COLLECTION_CREDENTIALS_ID, filterQueries, queries), queries);
    const rows = await Promise.all(mergedRows.map((doc: Models.Row) => this.decryptRowFields(doc, "credentials") as unknown as Credentials));
    const { masterPassCrypto } = await import("../masterpass-crypto");
    if (masterPassCrypto.isVaultUnlocked()) this.credentialsListCache.set(cacheKey, rows);
    return rows;
  })().finally(() => { this.credentialsListInflight.delete(cacheKey); });
  this.credentialsListInflight.set(cacheKey, request);
  return request;
}

static async listTOTPSecrets(userId: string, queries: string[] = []): Promise<TotpSecrets[]> {
  // identical structure, but table = totpSecrets, resourceType = 'totp'
}

static async listCredentials(userId, limit=25, offset=0, queries): Promise<{total, rows}> {
  const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
  const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
  const mergedRows = sortMergedRows(await listRowsMergedAcrossFilters(APPWRITE_COLLECTION_CREDENTIALS_ID, filterQueries), list);
  const pageRows = mergedRows.slice(offset, offset+limit);
  // decrypt each
}

static async listRawCredentials(userId, queries): Promise<Credentials[]> { // never decrypted, for RxDB
  const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
  const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
  const mergedRows = sortMergedRows(await listRowsMergedAcrossFilters(APPWRITE_COLLECTION_CREDENTIALS_ID, filterQueries, queries), queries);
  return mergedRows as unknown as Credentials[];
}
static async listRawTOTPSecrets(userId, queries): Promise<TotpSecrets[]> { /* same for totp */ }

static async listRecentCredentials(userId, limit=5) {
  const filterQueries = getCredentialOwnerIndexQueries(userId); // [userId] only
  // parallel listRowsWithRetry per filter, orderDesc $updatedAt, limit, dedupe by $id, sort $updatedAt desc
}

static async listFolders/ListSecurityLogs — simple Query.equal("userId", userId) + orderDesc
```

**Encryption gate — `decryptRowFields`:**

```ts
if (!masterPassCrypto.isVaultUnlocked()) {
  console.warn("Vault is locked - returning encrypted data as-is");
  return result; // encrypted blob — UI will show "Encrypted Code" / blur
}
// else unwrap DEK (owner: decrypt dek via MEK; collaborator: unwrap via ECDH + key_mapping), then ecosystemSecurity.decryptWithKey per field
```

If vault locked, `listAllCredentials` still returns rows but **encrypted** — callers don't filter them out.

**Cache layers inside VaultService (in-memory, not RxDB):**
`credentialsListCache: Map<cacheKey, Credentials[]>`, `totpSecretsCache`, `credentialsListInflight`, `totpSecretsInflight`. Key = `${userId}:${JSON.stringify(queries)}`. Only populated when `masterPassCrypto.isVaultUnlocked()`. Cleared on `vault-locked` event or `clearCredentialCache(userId)`.

### 2.4 Secrets UI — `app/(app)/vault/(protected)/page.tsx`

```ts
const loadAllCredentials = useCallback(async (background = false) => {
  const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || '') : '');
  if (!activeUserId) { setLoading(false); return; }
  if (!background && allCredentials.length === 0) setLoading(true);
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const { VaultService } = await import('@/lib/appwrite/vault-service');
    const cacheKey = `vault_credentials_${activeUserId}`;
    const credentials = await LocalEngine.query<Credentials[]>(cacheKey, async () => {
      const rows = await VaultService.listAllCredentials(activeUserId);
      return rows as any;
    }, { ttl: background ? 0 : undefined });
    const list = Array.isArray(credentials) ? credentials : (credentials as any)?.rows || [];
    console.log(`[Vault] Fetched ${list?.length ?? 0} credentials via LocalEngine+VaultService.`);
    if (Array.isArray(list) && list.length) {
      setAllCredentials(list as any);
    } else if (!background && allCredentials.length === 0) {
      setAllCredentials([]); // only wipe if truly no local data
    } else if (Array.isArray(list) && !list.length && allCredentials.length) {
      console.warn("[Vault] network empty but live copy populated — keeping live");
    }
  } catch (error) {
    console.error("[Vault] Failed to load via LocalEngine:", error);
    if (allCredentials.length === 0) toast.error(`Vault load error: ...`);
  } finally { setLoading(false); }
}, [user, allCredentials.length]);

const hydrateVaultData = useCallback(async () => { await loadAllCredentials(); }, [loadAllCredentials]);
useEffect(() => { void hydrateVaultData(); }, [hydrateVaultData]);
```

Expectation: `LocalEngine.query` returns cached RxDB `vault_credentials_<userId>` immediately if present (and background-refreshes), otherwise fetches via `VaultService.listAllCredentials`. **No additional `Query.equal("isTrash", false)` or `isDeleted` filtering in this page** — relies on backend list to already exclude trash/deleted (but backend listing does NOT explicitly filter those — see §2.3).

Write path (optimistic) — `CredentialDialog.tsx` local-first:

```ts
// update
const localUpdated = { ...initial, ...credentialData, $id: initial.$id, $updatedAt: new Date().toISOString() } as any;
await LocalEngine.cacheSet(`vault_credential_${initial.$id}`, localUpdated);
void updateCredential(initial.$id, credentialData).catch(()=>{});
onSaved(localUpdated);

// create
const tempId = ID.unique();
const localCreated = { ...credentialData, $id: tempId, $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() } as any;
await LocalEngine.cacheSet(`vault_credential_${tempId}`, localCreated);
// also warm list cache
try {
  const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
  const db = await getRxDB().catch(()=>null);
  if (db) {
    const cacheKey = `vault_credentials_${user?.$id}`;
    const existing = await db.cache.findOne(cacheKey).exec().catch(()=>null);
    const prev = (existing?.data as any) || [];
    await db.cache.upsert({ id: cacheKey, data: [localCreated, ...(Array.isArray(prev) ? prev : [])], timestamp: Date.now() });
  }
} catch {}
void createCredential(credentialData).then(async (created: any) => {
  await LocalEngine.cacheDelete(`vault_credential_${tempId}`);
  await LocalEngine.cacheSet(`vault_credential_${created.$id}`, created);
}).catch(()=>{});
onSaved(localCreated);
```

`page.tsx` `onSaved` then also warms `vault_credentials_<userId>` via `LocalEngine.cacheSet`.

### 2.5 TOTP UI — `app/(app)/vault/(protected)/totp/page.tsx`

Does **NOT** use `LocalEngine.query` for the main fetch — it does RxDB warm + direct `listTotpSecrets`:

```ts
const cacheKey = `vault_totp_${activeUserId}`;
// 1) warm from RxDB cache immediately
(async () => {
  const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
  const db = await getRxDB().catch(() => null);
  if (db && activeUserId) {
    const cachedDoc = await db.cache.findOne(cacheKey).exec().catch(() => null);
    if (cachedDoc?.data && Array.isArray(cachedDoc.data) && !isCancelled) {
      if (cachedDoc.data.length > 0) {
        setTotpCodes(cachedDoc.data as TotpItem[]);
        setLoading(false);
      } else {
        await db.cache.findOne(cacheKey).remove().catch(() => {}); // discard empty to force fresh fetch
      }
    }
  }
})();
// 2) network
console.log(`[TOTP] Fetching TOTP codes for user: ${activeUserId}...`);
Promise.allSettled([listTotpSecrets(activeUserId), listFolders(activeUserId)])
  .then(async ([secretsResult, foldersResult]) => {
    if (secretsResult.status === "fulfilled") {
      setTotpCodes(secretsResult.value);
      // then also cache RAW encrypted via listRawTotpSecrets (different call)
      const { listRawTotpSecrets } = await import('@/lib/appwrite/vault-actions');
      const rawEncrypted = await listRawTotpSecrets(user.$id).catch(() => null);
      if (rawEncrypted) await db.cache.upsert({ id: cacheKey, data: rawEncrypted, timestamp: Date.now() });
    } else {
      toast.error(`TOTP load error: ...`);
    }
  });
```

`listTotpSecrets` is `VaultService.listTOTPSecrets` → same merged fan-out as secrets but for `totpSecrets` table. Also listens to `vault-unlocked/locked` to re-fetch.

Card-level decrypt: `TOTPCardStable` checks `looksEncrypted(totp.issuer|accountName|secretKey|dek)` and only decrypts when `isVaultUnlockedState` true; otherwise shows `--- ---` / `Encrypted Code` / blur.

### 2.6 Other vault-adjacent filtering

- **RxDB `cache` collection** (`lib/webrtc/RxDBManager`): key = `vault_credentials_<userId>` (array) and `vault_credential_<id>` (single) for secrets; `vault_totp_<userId>` for totp. TTL via `cacheGet(id, maxAgeMs)` — page uses `ttl: background ? 0 : undefined` (0 = always stale, forces background refresh).
- **No `isDeleted`/`isTrash` predicate** in any vault list query — merged fan-out passes through `queries` param but neither page passes it, so deleted/trash rows would be returned if present (and then decrypted). `isDeleted` is a soft flag, not a server filter.
- **`isPublic/isGuest/isShared/isPinned`** — not used for vault list filtering; only for pin sort (`sortedCredentials` `isResourcePinned` then `$createdAt`) and share flows.
- **Workspace filtering** — `useWorkspaceFilteredItems(totpCodes, 'totp')` and `scopedTotpCodes` — filters by `isWorkspace` flag downstream; if a row was created without `isWorkspace=true` while in a custom workspace, it will be hidden in that workspace scope.

---

## 3. Everything Tried So Far (chronological)

1. **Unified read via client SDK with create-granted `Permission.read(Role.user(ownerId))`** — replaced direct `databases.listRows` behind `unifiedRead`; added fallback `listRows(database, table, [])` + client-side `userId` filter when filtered query fails (missing index / throttled).
2. **Single `userId` fan-out** — removed compound `userId+isPublic` etc. queries that hit missing indexes; `buildCredentialOwnerFilterQueries` now returns `[Query.equal("userId", userId)]` plus chunked `$id` fan-out for collaborated IDs, merged & deduped via `listRowsMergedAcrossFilters`.
3. **Chunked `$id` arrays (50)** — avoids URL length limits when many collaborated IDs.
4. **`listRowsWithRetry` endpoint normalization** — `normalizeEndpoint` + retry once on `Failed to fetch` / `NetworkError`, with clear error message about `NEXT_PUBLIC_APPWRITE_ENDPOINT` / CORS / `/v1` suffix.
5. **LocalEngine live-copy failsafe** — `LocalEngine.query` and `LocalEngine.fetch` both check `isFreshEmpty` vs `isCachedPopulated` and refuse to overwrite populated RxDB cache with empty network result (the "workspace-introduced vault empty bug").
6. **Credential dialog optimistic cache** — `CredentialDialog` now writes `vault_credential_<tempId>` + warms `vault_credentials_<userId>` list cache **before** `createCredential`/`updateCredential` network call, so item appears instantly like Notes `pushLiveNote`. Replaces temp with real `$id` on success.
7. **Vault page keep-live logic** — `loadAllCredentials` does not wipe `allCredentials` when network returns empty but live copy populated: `if (list.length && ...) setAllCredentials(list); else if (!background && allCredentials.length===0) set([]); else warn and keep live`.
8. **TOTP RxDB warm path** — discard empty `vault_totp_<userId>` cache entry to force fresh fetch (empty array is treated as stale, not as valid empty).
9. **VaultService in-memory dedup caches** — `credentialsListCache` / `totpSecretsCache` + `Inflight` maps per `cacheKey`; only populated when vault unlocked; `ensureRuntimeSecurityHooks` clears on `vault-locked`.
10. **DEK migration / collaborator key_mapping** — `getCollaboratedResourceIds` + `key_mapping` fan-out; `decryptRowFields` unwraps DEK via MEK (owner) or ECDH via `key_mapping.wrappedKey` + `metadata.senderPublicKey` (collaborator).
11. **Ghost word wipe / terminology fixes** — `isGhost`→`isExcludedNote`, thread-crypto aliases — not vault but part of same sweep; Appwrite schema still has `isGhost/isThread` columns and `call_signals` table (needs migration).
12. **Manual `Sync Remote` button** — `VaultService.clearVaultCaches()` + `db.cache.findOne(vault_credentials_<userId>).remove()` then `loadAllCredentials()`.
13. **Verbose logging** — `[Vault] Fetched N credentials via LocalEngine+VaultService` / `[TOTP] Successfully fetched N` for headless verification.

---

## 4. Current Status — Still Empty

- **Secrets tab:** `loadAllCredentials` → `LocalEngine.query("vault_credentials_<userId>", () => VaultService.listAllCredentials(userId))` returns `[]` (empty array). `allCredentials` stays `[]`, so UI renders `No Secrets Found` + `Add Secret`.
- **TOTP tab:** `listTotpSecrets(userId)` resolves to `[]`; `Promise.allSettled` sets `totpCodes=[]`; RxDB `vault_totp_<userId>` either missing or empty (and discarded), so no warm data.
- **No error toast** when network succeeds with 0 rows — only on throw.
- **Local optimistic writes do appear momentarily** (via `CredentialDialog` warming list cache) but disappear on next `loadAllCredentials` refresh because background fetch returns empty and (depending on timing) may still overwrite before failsafe engages, or `listAllCredentials` in-memory cache returns empty and poisons next read.
- **Vault locked vs unlocked:** if vault locked, `decryptRowFields` returns encrypted rows as-is; UI would still list them (with blur/`Encrypted Code`), so empty is not caused by decryption gate — it's upstream (no rows returned).

---

## 5. Suspect Surface — What Could Still Explain Empty

- **Row Security / Permissions:** `credentials`/`totpSecrets` have `rowSecurity: true` and no `$permissions: []` default. If a row was created without `Permission.read(Role.user(ownerId))` (e.g., old direct `databases.createRow` or failed `createRowSecure`), `listRows` as that user returns 0. `unifiedCreate` now sets it, but legacy rows may be invisible. Check via admin SDK `listRows` vs user JWT.
- **`APPWRITE_DATABASE_ID` / table IDs mismatch:** `lib/appwrite/config.ts` maps `APPWRITE_CONFIG.DATABASES.VAULT` / `TABLES.VAULT.*` — if env `NEXT_PUBLIC_APPWRITE_DATABASE_ID` vs `passwordManagerDb` diverges, `VaultService` hits wrong DB (empty). `generated/appwrite/constants.ts` `ENDPOINT` vs `appwrite.config.json` endpoint mismatch is already retried but DB ID mismatch is not.
- **`userId` value mismatch:** `user.$id` (Appwrite Account) vs `userId` column stored — if creation used `getCurrentUserSnapshot().$id` stale/guest, query `Query.equal("userId", currentUser.$id)` misses. Check one raw row's `userId` vs `account.get()` id.
- **Encrypted `name` search index pitfall (not applicable to list, but note):** `Query.search("name", ...)` would never match encrypted `name`; but list does not use it.
- **Collaborator fan-out poisoning:** `listRowsMergedAcrossFilters` runs `Promise.all(filterQueries.map(...))` — if `filterQueries` is `[userId, $id chunk1, $id chunk2...]` and any `$id` chunk throws (e.g., `Query.equal("$id", hugeArray)` URL too long or permission error), it is swallowed but primary `userId` still returns. So not the cause unless primary itself throws and is swallowed (then `byId` stays empty, returns `[]` silently).
- **In-memory cache poisoning:** `credentialsListCache` keyed by `userId:JSON.stringify(queries)` — if first call cached `[]` while unlocked, all subsequent calls return `[]` without network. `clearVaultCaches` + RxDB remove is the only reset.
- **RxDB cache poisoning:** `vault_credentials_<userId>` previously upserted with `[]` (from empty network) before failsafe was added; failsafe now guards `LocalEngine.query` but `VaultService.listAllCredentials` in-memory cache sits in front and may still serve `[]`.

---

## 6. Exact Column Reference (for quick lookup)

See §1.2 table. For vault, the only columns that matter for listing/filtering are `userId` (query), `$id` (fan-out), and display atoms `name/username/password/notes/url/tags/customFields/card*` (credentials) and `issuer/accountName/secretKey/algorithm/digits/period/url` (totp). All display atoms are encrypted except enumerated plaintext fields.

---

## 7. Files Involved (paths must be preserved)

- `generated/appwrite/types.ts` — `Credentials`, `TotpSecrets` shapes
- `generated/appwrite/databases.ts` — `databases` + `Query` builders
- `generated/appwrite/constants.ts` — `PROJECT_ID`, `ENDPOINT`
- `appwrite.config.json` — `credentials`, `totpSecrets`, `key_mapping`, `keychain` schemas + indexes
- `lib/services/unified-object-service.ts` — `OBJECT_TABLES`, `unifiedRead` + fallback, `unifiedCreate` permissions
- `lib/services/LocalEngine.ts` — `query`, `fetch`, `cacheGet/Set`, failsafe, `instantWrite`
- `lib/appwrite/vault-service.ts` — `getCredentialOwnerIndexQueries`, `buildCredentialOwnerFilterQueries`, `listRowsMergedAcrossFilters`, `sortMergedRows`, `listRowsWithRetry`, `getCollaboratedResourceIds`, `listAllCredentials`, `listTOTPSecrets`, `listRaw*`, `decryptRowFields`, `ENCRYPTED_FIELDS`, `COLLECTION_SCHEMAS`
- `app/(app)/vault/(protected)/page.tsx` — `loadAllCredentials`, `LocalEngine.query`, keep-live empty guard
- `app/(app)/vault/(protected)/totp/page.tsx` — RxDB warm + `listTotpSecrets` + `listRawTotpSecrets` cache, `TOTPCardStable` decrypt
- `components/app/dashboard/CredentialDialog.tsx` — local-first `vault_credential_<tempId>` + `vault_credentials_<userId>` warming, background `createCredential/updateCredential`
- `lib/appwrite/vault-actions.ts` / `lib/appwrite/vault.ts` — re-exports `listRaw*`, `addAttachment*`
- `lib/webrtc/RxDBManager.ts` — `cache` collection (`id`, `data`, `timestamp`)
- `lib/masterpass-crypto.ts` + `lib/ecosystem/security.ts` — `decryptField`, `encryptWithKey`, DEK unwrap, `isVaultUnlocked`

---

*End of audit — update this file in place if filtering changes; do not commit.*
