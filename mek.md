# Kylrix Master Encryption Key (MEK) & MasterPass Architecture

This document provides the definitive cryptographic specification of the Kylrix Master Encryption Key (MEK), MasterPass key derivation, multi-credential wrapping, and WebAuthn Passkey integration (both with and without PRF extension support).

---

## 1. High-Level Cryptographic Topology

Kylrix operates on a **zero-knowledge, non-custodial** cryptographic foundation. Neither plaintext secrets, master passwords, nor raw unencrypted encryption keys ever touch backend databases or edge servers.

```
                  ┌────────────────────────────────────────────────────────┐
                  │              Master Encryption Key (MEK)               │
                  │             256-bit AES-GCM (In-Memory Only)           │
                  └────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┴────────────────────────┐
            ▼                                                  ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│     Keychain Wrapper 1        │              │     Keychain Wrapper 2..N     │
│   (Master Password / KDF)     │              │    (WebAuthn Passkeys 1..N)   │
└───────────────────────────────┘              └───────────────────────────────┘
            │                                                  │
            ▼                                                  ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│  Argon2id (64MB / 3 it / 4 p) │              │  PRF Extension Hardware Seed  │
│  or Legacy PBKDF2 (600k it)   │              │  or Enclave Fallback Seed     │
└───────────────────────────────┘              └───────────────────────────────┘
                                      │
                        (Decrypts wrapped DEK per row)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       Data Encryption Key (DEK)        │
                  │     Unique 256-bit AES-GCM per row     │
                  └────────────────────────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │      Encrypted Vault Record Fields     │
                  │     (Passwords, TOTPs, Notes, API)     │
                  └────────────────────────────────────────┘
```

### Key Separation of Concerns
1. **Master Encryption Key (MEK)**:
   - A single 256-bit AES-GCM symmetric key representing the root of trust for an account's vault.
   - Generated randomly using `crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ...)`.
   - Never stored directly anywhere. Only exists unencrypted in volatile browser RAM (`CryptoKey`) during an active unlock session.
2. **Data Encryption Keys (DEKs)**:
   - Each vault item (credential, TOTP, secure note) generates its own independent 256-bit AES-GCM key (`DEK`).
   - The item's sensitive fields (username, password, secret key) are encrypted with the `DEK`.
   - The `DEK` is encrypted (wrapped) with the `MEK` and stored alongside the record in the `dek` column.
   - **Why this matters**: Sharing a single vault item with a teammate only requires sharing that item's `DEK`—the account `MEK` is never exposed.
3. **Keychain Rows**:
   - The `keychain` table stores multiple alternative "wrappers" around the exact same `MEK`.
   - Adding a new passkey, hardware key, or changing the master password **does not re-encrypt vault items**. It simply creates or updates a single keychain entry wrapping the `MEK`.

---

## 2. MasterPass & MEK Generation

When a user initializes their vault for the first time (`setupVault` in `lib/masterpass-crypto.ts`):

1. **Random MEK Generation**:
   ```ts
   const mek = await crypto.subtle.generateKey(
     { name: "AES-GCM", length: 256 },
     true,
     ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
   );
   ```

2. **Key Derivation Function (KDF)**:
   A fresh 32-byte cryptographically secure random salt is generated:
   ```ts
   const salt = crypto.getRandomValues(new Uint8Array(32));
   ```
   The user's Master Password is run through **Argon2id** (via WebAssembly `hash-wasm`):
   - **Memory**: 65,536 KB (64 MB)
   - **Iterations (Time Cost)**: 3
   - **Parallelism (Lanes)**: 4
   - **Hash Length**: 32 bytes (256 bits)
   - **Fallback (Legacy)**: PBKDF2 with SHA-256 and 600,000 iterations (OWASP recommendation).

   The resulting 32-byte binary hash is imported as an AES-256-GCM `authKey`.

3. **Wrapping the MEK**:
   - The `MEK` is exported to raw 32 bytes.
   - A fresh 16-byte IV is generated (`crypto.getRandomValues(new Uint8Array(16))`).
   - The `MEK` is encrypted with the `authKey`:
     ```ts
     const encryptedMek = await crypto.subtle.encrypt(
       { name: "AES-GCM", iv },
       authKey,
       rawMekBytes
     );
     ```

4. **Mandatory In-Memory Roundtrip Validation**:
   Before anything is persisted to disk or remote servers, the client immediately tests decryption:
   ```ts
   const testDecrypted = await crypto.subtle.decrypt(
     { name: "AES-GCM", iv },
     authKey,
     encryptedMek
   );
   if (!testDecrypted || testDecrypted.byteLength !== rawMekBytes.byteLength) {
     throw new Error("KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED");
   }
   ```

5. **Keychain Entry Storage**:
   The IV and encrypted MEK ciphertext are concatenated (`[IV 16 bytes] + [Ciphertext 32 bytes + 16 bytes GCM tag] = 64 bytes total`), Base64-encoded, and saved into the `keychain` table:
   - `type`: `'password'`
   - `wrappedKey`: `Base64(iv + encryptedMek)`
   - `salt`: `Base64(salt)`
   - `params`: `JSON.stringify({ memory: 65536, iterations: 3, parallelism: 4, algo: "Argon2id" })`
   - `authPass`: `true` (marks whether master password aligns with account login password)

---

## 3. Passkey Wrapping (Multiple Passkeys & PRF Extension)

Kylrix supports registering **unlimited WebAuthn Passkeys** to unlock the vault. Because WebAuthn authenticators cannot directly hold custom symmetric keys, Kylrix uses a **key wrapping seed pattern**.

When adding a passkey (`components/overlays/PasskeySetup.tsx`), the vault must already be unlocked so the raw `MEK` is accessible in memory.

### Deriving the Passkey Wrapping Seed (`kwrapSeed`)

Every passkey derives a 32-byte symmetric wrapping key (`kwrapSeed`). Kylrix uses a tiered strategy supporting both modern hardware PRF and standard authenticators:

```
Passkey Registration / Unlock
             │
   Supports PRF Extension?
     ├── YES ──► Authenticator hardware evaluates HMAC-SHA-256 over 'kylrix-unified-salt-v1'
     │           └──► Returns 32-byte PRF buffer directly from Secure Enclave / YubiKey
     │
     └── NO  ──► Enclave Fallback Seed via getPasskeyRegisterFallbackSeedAction(credentialId)
                 └──► Local fallback SHA-256(credentialId + userId)
```

#### Path A: Authenticators with PRF Extension (`prf`)
Modern authenticators (Touch ID on macOS/iOS, Windows Hello, YubiKey 5 with FIDO 2.1) support the WebAuthn `prf` (Pseudo-Random Function) extension.
1. During registration, Kylrix declares:
   ```ts
   registrationOptions.extensions = { prf: {} };
   ```
2. When the authenticator completes registration, it returns `extensionResults.prf.enabled = true`.
3. During authentication / unlock (`lib/passkey.ts`), Kylrix passes the PRF evaluation salt:
   ```ts
   authOptions.extensions = {
     prf: {
       eval: {
         first: new TextEncoder().encode('kylrix-unified-salt-v1')
       }
     }
   };
   ```
4. The authenticator executes an internal HMAC-SHA-256 using its internal, non-exportable hardware key over `'kylrix-unified-salt-v1'` and returns 32 bytes in `clientExtensionResults.prf.results.first`.
5. This 32-byte buffer is `kwrapSeed`. **It never leaves the local machine and cannot be extracted from the hardware token.**

#### Path B: Authenticators Without PRF Extension (Fallback)
If an authenticator or browser (e.g., older Android/Linux browsers) does not support the PRF extension:
1. The client requests a 32-byte secure fallback seed from the server:
   ```ts
   const fallbackRes = await getPasskeyRegisterFallbackSeedAction(regResp.id);
   ```
2. If network is offline, a deterministic local digest is calculated:
   ```ts
   kwrapSeed = await crypto.subtle.digest("SHA-256", encoder.encode(credentialId + userId));
   ```
3. The seed is securely cached in IndexedDB via `SecurityEnclave.setPasskeyFallbackSeed(userId, credentialId, seed)`.

### Wrapping the MEK with the Passkey
Once `kwrapSeed` (32 bytes) is obtained:
1. It is imported as an AES-GCM wrapping key:
   ```ts
   const kwrap = await crypto.subtle.importKey(
     "raw",
     kwrapSeed,
     { name: "AES-GCM" },
     false,
     ["encrypt", "decrypt"]
   );
   ```
2. A random 12-byte IV is generated:
   ```ts
   const iv = crypto.getRandomValues(new Uint8Array(12));
   ```
3. The raw `MEK` is encrypted:
   ```ts
   const encryptedMasterKey = await crypto.subtle.encrypt(
     { name: "AES-GCM", iv },
     kwrap,
     rawMekBytes
   );
   ```
4. The IV and ciphertext are concatenated:
   ```ts
   const passkeyBlob = arrayBufferToBase64([12-byte IV] + [Ciphertext + 16-byte Tag]);
   ```
5. A new `keychain` entry is created for this specific passkey:
   - `type`: `'passkey'`
   - `credentialId`: WebAuthn Credential ID (base64url)
   - `wrappedKey`: `passkeyBlob`
   - `params`: JSON containing `publicKey` (COSE format), `rpId`, `prf: true/false`, `transports`
   - `authPasskey`: `true` (can also be used for passkey-first passwordless login)

---

## 4. Unlocking the Vault with Passkey (`unlockWithPasskey`)

When the user taps "Unlock with Passkey" (`lib/passkey.ts`):

1. **Keychain Fetch**:
   - The user's passkey keychain rows are retrieved from the local `SecurityEnclave` (IndexedDB) or fetched with a 4-second soft timeout from Appwrite.
2. **Challenge & WebAuthn Assertion**:
   - `allowCredentials` contains all registered `credentialId`s for that user.
   - If any passkey has `prf: true`, the `prf` extension evaluation is attached.
   - Browser prompts for Touch ID / Face ID / YubiKey tap.
3. **Matching the Entry**:
   - The browser returns `authResp.id` (the credential that signed the assertion).
   - Kylrix matches `authResp.id === entry.credentialId` to retrieve that passkey's `wrappedKey`.
4. **Seed Resolution & Unwrap Pipeline**:
   The client tests candidate seeds in deterministic priority order:
   ```
   Candidate 1: WebAuthn clientExtensionResults.prf.results.first (Hardware PRF output)
   Candidate 2: Local SecurityEnclave cached fallback seed
   Candidate 3: Local SHA-256(credentialId + userId) digest
   Candidate 4: Remote getPasskeyRegisterFallbackSeedAction(credentialId)
   ```
   Each seed is tested with `tryUnwrapMek(seed, wrappedKeyBytes)`:
   ```ts
   const kwrap = await crypto.subtle.importKey('raw', seed, { name: 'AES-GCM' }, false, ['decrypt']);
   const iv = wrappedKeyBytes.slice(0, 12);
   const ciphertext = wrappedKeyBytes.slice(12);
   const mekBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kwrap, ciphertext);
   ```
5. **Import & Activate**:
   - When decryption succeeds, `mekBytes` is imported into `ecosystemSecurity.importMasterKey(mekBytes)`.
   - The vault status changes to `unlocked`.
   - `markSudoActive()` grants transient sudo privilege for protected operations.

---

## 5. In-Memory Lifetime & Service Worker Preservation

To balance maximum security against intrusive password prompts on every page refresh:

1. **Volatile RAM Storage**:
   The unencrypted `MEK` is stored strictly as a non-extractable or session-scoped `CryptoKey` reference inside the `MasterPassCrypto` and `EcosystemSecurity` singleton instances.
2. **Page Reload Preservation (The "Session Worker")**:
   When the user refreshes the browser, JavaScript heap memory is wiped. To prevent requiring re-entry of the master password on every route change:
   - When unlocked, `MasterPassCrypto.syncToServiceWorker()` posts the raw `MEK` bytes over an in-memory `MessageChannel` to the active Service Worker.
   - The Service Worker stores the bytes **only in its volatile JavaScript heap** (never in IndexedDB, CacheStorage, or localStorage).
   - On the new page paint, `MasterPassCrypto.recoverFromServiceWorker()` queries the Service Worker to restore the `MEK`.
   - If the browser tab is closed or the Service Worker restarts, the memory is permanently lost and the user must unlock again.
3. **Automatic Lock Timeout**:
   - A 10-minute inactivity timer automatically zeroes out the in-memory keys and purges the Service Worker memory buffer.

---

## 6. Hierarchical Agentic MEKs (Gold Key vs. Silver Key)

Kylrix extends this architecture to autonomous AI agents operating within workspaces:

- **Personal / Default Workspaces**:
  - The Human Owner's `MEK` directly encrypts and decrypts all records ("Gold Key").
- **Agentic Workspaces (`isAgentic: true`)**:
  - Autonomous agents must perform work without exposing the human user's primary Personal Vault.
  - An independent **Agent MEK** ("Silver Key") is generated specifically for that agent/workspace.
  - The Silver Key is encrypted with the Owner's Gold Key (`encryptField(rawAgentMek)`) and stored in the agent's identity config.
  - When the human owner inspects or configures the agent, the Gold Key unseals the Silver Key.
  - When the autonomous agent executes API/MCP calls, it passes its own scoped token or Silver Key (`X-Kylrix-MEK`), mathematically isolating the human owner's personal credentials from autonomous subagents.

---

## 7. Summary of Cryptographic Primitives

| Component | Primitive / Algorithm | Key Size / Cost | Purpose |
|---|---|---|---|
| **Master Encryption Key (MEK)** | AES-GCM | 256 bits | Account root vault key (in-memory only) |
| **Data Encryption Key (DEK)** | AES-GCM | 256 bits | Per-record encryption key |
| **KDF (Primary)** | Argon2id | 64MB RAM, 3 it, 4 lanes | Derives `authKey` from Master Password |
| **KDF (Legacy)** | PBKDF2-SHA256 | 600,000 iterations | Legacy fallback for older accounts |
| **Passkey Hardware Seed** | WebAuthn `prf` (HMAC-SHA-256) | 256 bits | Non-exportable hardware-derived wrapping key |
| **Passkey Fallback Seed** | Server / Local SHA-256 | 256 bits | Fallback for authenticators lacking PRF |
| **Record IV** | Cryptographically Random | 12 or 16 bytes | Uniquely generated per encryption operation |
