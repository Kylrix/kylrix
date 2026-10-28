# Security, Zero-Knowledge Vault & Authentication Architecture

This document details the security architecture, zero-knowledge encryption protocols, MasterPass key derivation schemes, multi-factor authentication, and RAM memory protection mechanisms in Kylrix.

---

## 🔒 Zero-Knowledge Encryption Model

Kylrix implements a client-side zero-knowledge encryption architecture for all sensitive vault items (`credentials` and `totpSecrets`).

- **Unreadable on Server:** Plaintext passwords, TOTP secret seeds, and custom fields are encrypted in the client's browser or terminal before transmission. Server databases store only Web Crypto AES-256-GCM ciphertexts and salt parameters.
- **Key Derivation (MasterPass):** The user's Master Password (`MasterPass`) never leaves the user's local memory.

```
+-----------------------------------------------------------------------------------+
|                                  USER MASTERPASS                                  |
+-----------------------------------------------------------------------------------+
                                         |
                       Argon2id (Primary) / PBKDF2 (Fallback)
                                         v
+-----------------------------------------------------------------------------------+
|                        MASTER ENCRYPTION KEY (MEK)                                |
+-----------------------------------------------------------------------------------+
                                         |
                           Unwraps Workspace / Item DEK
                                         v
+-----------------------------------------------------------------------------------+
|                         DATA ENCRYPTION KEY (DEK)                                 |
+-----------------------------------------------------------------------------------+
                                         |
                            AES-256-GCM Decryption
                                         v
+-----------------------------------------------------------------------------------+
|                DECRYPTED VAULT ITEM (Password / TOTP Seed / URL)                  |
+-----------------------------------------------------------------------------------+
```

---

## 🔑 Key Hierarchy & Derivation Details

### 1. Master Passphrase Key Derivation (`MasterPassCrypto`)
- **Primary Algorithm:** **Argon2id**
  - **Memory:** 64 MB (`65536` KB)
  - **Iterations:** 3
  - **Parallelism:** 4
- **Fallback / Legacy Standard:** **PBKDF2-HMAC-SHA256**
  - **Iterations:** 600,000 (OWASP 2023 recommendation)
  - **Salt Size:** 32 bytes (256-bit)
  - **Key Size:** 256-bit AES-GCM

### 2. Keychain Normalization (`normalizeKeychainRow`)
When loading keychain records from Turso SQLite (`listKeychainTurso`), raw columns (`encryptedPayload`, `nonce`, `metadata`) are normalized into standard fields (`$id`, `wrappedKey`, `salt`, `params`, `isArgon`) via `normalizeKeychainRow` to ensure fast unlock without decryption fallback loops.

### 3. Multi-Tiered Secret Decryption Cascade
When decrypting credentials (`CredentialItem.tsx`, `CredentialDetail.tsx`), the client executes a resilient multi-tier decryption sequence:
1. **Tier 1 (DEK AES-GCM):** Attempt decryption using workspace Data Encryption Key.
2. **Tier 2 (Direct MEK Pass):** Fall back to unwrapping fields directly using Master Encryption Key.
3. **Tier 3 (Field-Level Iteration):** Safely attempt unwrap across all candidate fields (`name`, `username`, `password`, `url`, `notes`, `customFields`).

Reactive events (`vault-unlocked`, `kylrix:vault-unlocked`, `vault-locked`) automatically trigger UI credential decryption or state clearing.

---

## 🤖 Dual-Wrapped Enclave Crypto & Agent Enclave Tokens (AET)

Kylrix provides zero-knowledge secret access and persistent memory for AI agents (Claude Code, Cursor, AutoGPT, CLI, VS Code, REST API, WebMCP, Discord/Telegram) via **Dual-Wrapped Enclave Crypto**.

### Token Secret (`etkSecret`) & Item-Level DEK Wrapping
An AET has the canonical form `kyl_aet_<8 hex>_<32 b64url auth secret>.etk_<64 hex>`. The part left of the dot is the bearer credential (SHA-256 hashed in `apikey.key`); `etk_<64 hex>` is a 32-byte unlock secret that never leaves the client. `kyl_apk_` remains reserved for Agent Provisioning Keys.

When an agent key is minted in Settings:
1. **Local Vault Unlock**: The browser unlocks the vault locally using MEK or Passkey PRF.
2. **Ephemeral Secret Generation**: The client generates a 256-bit `etkSecret`.
3. **Envelope Construction**: For each permitted Row, the client unwraps the Row DEK with the MEK and re-wraps it under an HKDF-SHA256 key derived from `etkSecret` + a random 16-byte envelope salt. Each entry is AES-256-GCM sealed with AAD equal to its resource key (`credential:<id>` or `totp:<id>`), so entries cannot be swapped between items. Rows without a wrapped DEK (legacy MEK-direct encryption) are skipped and reported.
4. **Metadata Persistence**: The envelope is stored at `apikey.metadata.aet`. It is never returned by PAT list/me endpoints; `GET /api/v1/token/enclave` serves it only to the authenticating agent key itself.
5. **Zero Server Exposure**: In the default client-side mode the server holds the envelope but **never possesses MEK or `etkSecret`**. The opt-in `X-Kylrix-Agent-Token` header mode decrypts in-memory for one request (https/loopback only) and is a documented non-zero-knowledge trade-off.

```json
{
  "v": 1,
  "alg": "AES-256-GCM",
  "kdf": "HKDF-SHA256",
  "salt": "<b64, 16 bytes>",
  "resources": { "credential": true, "totp": true, "note": false },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "deks": {
    "credential:<id>": { "wrappedDek": "<b64>", "iv": "<b64, 12 bytes>", "algorithm": "AES-256-GCM" }
  }
}
```

Agents read ciphertext via `?sealed=1` on `GET /api/v1/vault[/id]` and `GET /api/v1/totp[/id]` (agent keys only; the MEK-wrapped `dek` is never included), fetch their envelope from `GET /api/v1/token/enclave`, and unlock locally — see `packages/cli/src/enclave.ts`.

---

## 🛡️ RAM Memory Protection & Zeroing (`kylrix exec`)

To prevent process memory dumps or sub-shell environment leakage when running commands with injected vault secrets via `kylrix exec <idOrUrl> -- <command>`:

1. Secrets are decrypted directly in Node.js process RAM.
2. Transient variables are injected into `childEnv = { ...process.env, ...resolved.variables }`.
3. Upon process termination (`child.on('exit')`), references to decrypted values are deleted from the child env map:
   ```typescript
   for (const key of Object.keys(vars)) {
     delete (childEnv as any)[key];
     delete (vars as any)[key];
   }
   ```
   Note: JavaScript strings are immutable and cannot be overwritten in memory — only `Uint8Array` buffers (unlock keys, salts, DEKs) are truly zeroed via `.fill(0)`. String references are dropped so the GC can reclaim them.

---

## 🔐 Authentication, 2FA & Passkeys

- **Better Auth Integration:** Universal session management, supporting OAuth 2.1, magic links, email/password, and WebAuthn Passkeys.
- **2FA & Passkeys:** Status queries check user `twoFactorEnabled` and `authClient.passkey.listUserPasskeys()`. Configuration updates force-refresh session state using `authClient.getSession({ query: { disableCookieCache: true } })`.
- **Sudo Mode:** High-security actions (deleting workspaces, changing passwords, exporting vault secrets) enforce Sudo Mode re-authentication, which expires after a 10-minute window.
