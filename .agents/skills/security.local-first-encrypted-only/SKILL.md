---
name: security.local-first-encrypted-only
description: Invariant for local-first encrypted storage: RxDB/IndexedDB/localStorage MUST ONLY store raw encrypted database payloads. Plaintexts live strictly in RAM.
---

# Local-First Encrypted-Only Storage Invariant

## Core Architecture Rule
**Decrypted sensitive data MUST NEVER be written to disk, IndexedDB, RxDB, or browser storage.**

All local-first persistence engines (RxDB, IndexedDB, localStorage, service worker caches) must strictly store **raw, un-decrypted database rows** containing ciphertext payloads (`aes-gcm:iv:ciphertext` or JSON ciphertexts).

---

## Technical Specifications

### 1. Persistence Layer Isolation
- **Disk Storage (RxDB / IndexedDB)**: Only write raw database rows returned by `listRawCredentials`, `listRawTotpSecrets`, or raw Appwrite row queries.
- **Forbidden**: Passing decrypted plaintext objects to `db.cache.upsert()`, `localStorage.setItem()`, or IndexedDB.

```ts
// ✅ CORRECT: Cache raw encrypted database rows
const rawRows = await VaultService.listRawCredentials(userId);
await db.cache.upsert({ id: cacheKey, data: rawRows, timestamp: Date.now() });

// ❌ FORBIDDEN: Caching decrypted plaintexts to local storage
const decryptedRows = await VaultService.listAllCredentials(userId);
await db.cache.upsert({ id: cacheKey, data: decryptedRows }); // VIOLATION!
```

### 2. In-Memory Volatile Decryption
- Decryption must occur on-the-fly strictly in **volatile RAM** when `masterPassCrypto.isVaultUnlocked()` is true.
- Plaintext values are stored in temporary React component state or volatile context refs (`setLiveCredential`, `useState`).
- When the application is locked (`masterPassCrypto.lock()`), clearing RAM instantly purges all plaintexts.

### 3. Offline Unlock Model
- Local RxDB holds raw encrypted rows + user auth key / salt metadata.
- Entering the master password offline derives the Master Encryption Key (MEK) via Argon2id in RAM.
- Component state consumes local raw rows and decrypts fields on-the-fly in RAM without persisting decrypted results.

### 4. Extending to Encrypted Objects (Ideas / Goals / Notes / Forms)
When extending encryption or locked states to other object types (e.g. locked ideas, confidential goals, encrypted notes):
1. **Raw Storage**: Save only `note.content` (encrypted ciphertext) or `goal.title` (ciphertext) to RxDB.
2. **UI Masking**: Render `looksEncrypted(val) ? 'Encrypted' : val` when vault is locked.
3. **RAM Decryption**: Decrypt fields on-the-fly in React component lifecycle when MEK is active.
