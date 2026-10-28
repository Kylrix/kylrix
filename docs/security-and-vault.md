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
When an Agent Enclave Token (`kyl_apk_<tokenId>.<etkSecret>`) is minted in Settings:
1. **Local Vault Unlock**: The browser unlocks the vault locally using MEK or Passkey PRF.
2. **Ephemeral Secret Generation**: The client generates a 256-bit secure secret key (`etkSecret`).
3. **Double-Wrapped DEK Map (`wrappedDeks`)**: The client wraps the DEKs of permitted resources (Vault credentials, TOTP keys, or Encrypted Notes/Ideas) using `etkSecret`.
4. **Metadata Persistence**: The wrapped DEK map is stored in `apikey.metadata` or item metadata (`notes.metadata`, `vault_items.metadata`).
5. **Zero Server Exposure**: The server receives `wrappedDeks` but **never possesses MEK or `etkSecret`**.

```json
{
  "wrappedDeks": {
    "vault_item_1": {
      "wrappedDek": "bXl3cmFwcGVkZGVr...",
      "iv": "MTJieXRlaXY...",
      "algorithm": "AES-256-GCM"
    }
  }
}
```

---

## 🛡️ RAM Memory Protection & Zeroing (`kylrix exec`)

To prevent process memory dumps or sub-shell environment leakage when running commands with injected vault secrets via `kylrix exec <idOrUrl> -- <command>`:

1. Secrets are decrypted directly in Node.js process RAM.
2. Transient variables are injected into `childEnv = { ...process.env, ...resolved.variables }`.
3. Upon process termination (`child.on('exit')`), string allocations in memory are explicitly zeroed out:
   ```typescript
   for (const key of Object.keys(resolved.variables)) {
     (childEnv as any)[key] = '';
     (resolved.variables as any)[key] = '';
   }
   ```

---

## 🔐 Authentication, 2FA & Passkeys

- **Better Auth Integration:** Universal session management, supporting OAuth 2.1, magic links, email/password, and WebAuthn Passkeys.
- **2FA & Passkeys:** Status queries check user `twoFactorEnabled` and `authClient.passkey.listUserPasskeys()`. Configuration updates force-refresh session state using `authClient.getSession({ query: { disableCookieCache: true } })`.
- **Sudo Mode:** High-security actions (deleting workspaces, changing passwords, exporting vault secrets) enforce Sudo Mode re-authentication, which expires after a 10-minute window.
