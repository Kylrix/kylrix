---
name: security
description: Comprehensive security architecture for Kylrix including zero-knowledge vault, MasterPass (Argon2id/AES-GCM), Sudo Mode, MFA verification, and RLS bypass patterns.
---

# Kylrix Security Architecture & Cryptography

## 1. Zero-Knowledge & Vault Cryptography
- **Non-Custodial**: Encryption keys and plaintext secrets never touch backend storage.
- **Argon2id KDF**: Master password derives AuthKey using Argon2id (64MB memory, 3 iterations, parallelism 4) with fallback support for legacy PBKDF2.
- **AES-256-GCM**: Master Encryption Key (MEK) encrypts individual Resource Encryption Keys (DEKs) and vault records with unique 12-byte/16-byte random IVs.
- **Volatile Memory**: MEK resides only in memory (\`CryptoKey\`) during active unlock and is completely zeroed upon lock or 10-minute idle timeout.

## 2. Sudo Mode & MFA Verification
- **Sudo Mode**: Sensitive operations (password export, keychain changes, key resets) require transient Sudo verification. Stored in volatile RAM timestamp window; never persisted to disk.
- **MFA Session Normalization**: MFA verification compares temporal factor stamps (\`mfaUpdatedAt\` vs \`createdAt\`) to prevent replay or expired factor bypass.

## 3. Row-Level Security (RLS) & Server-Side Bypass
- **Read-Focused Database Permissions**: Database-level ACLs are scoped to read-only or creator-scoped access.
- **Server SDK Escalation**: Mutations require server-side verification using verified user ID / session credentials.
- **Sharing Escape Hatches**: Direct support for \`isPublic\`, \`isGuest\`, and \`isGeneral\` fields for controlled public or guest view access without breaching zero-trust barriers.

## 4. Rate Limiting & Auth Lifecycle
- Progressive rate limiting applies across auth attempts to prevent brute-force attacks.
- Background tasks check session validity before firing to prevent 401 unhandled loops.

## 5. Agent Enclave Tokens (AET) — hard-won facts (issues #300–#319)

- **Token format**: `kyl_aet_<8hex>_<32 b64url auth secret>.etk_<64hex>`. Only the part left of the dot is the bearer credential — `apikey.key` stores its SHA-256. `etk_<64 hex>` is a 32-byte unlock secret that stays client-side. `kyl_apk_` remains Agent Provisioning Keys; do not reuse it for AETs (namespace collision).
- **Physical wrapped-DEK locations**: `vault_items` and `totp_secrets` have NO `dek` column — `dek` lives inside the `metadata` JSON blob. `lib/db/repository.ts` (and `lib/actions/turso-ops.ts` for client reads) expands it back to `row.dek`. `getRowWrappedDek()` in `lib/security/zero-knowledge.ts` checks both `row.dek` and `metadata.dek` — always use it. Rows without a wrapped DEK are legacy MEK-direct encrypted and cannot be shared via AET.
- **Row ciphertext format**: fields are `base64(IV16 || AES-GCM(DEK, utf8))` from `encryptFieldWithKey`/`decryptFieldWithKey` (`CryptoKey`, not bytes — import via `importMekCryptoKey`). Wrapped DEK format: `base64(IV16 || AES-GCM(MEK, utf8(base64(DEK))))` — the inner plaintext is base64 *text*. `sealRowFields` produces both; `unsealRowFields` reverses.
- **Note ciphertext format**: unverified against `decryptRowField` — the notes toggle is therefore hidden (`{false && ...}` in CreatePatDrawer) and `resources.note` is always `false` in shipped envelopes. Verify before enabling.
- **`shapeVaultItem` behavior**: without a MEK it still returns raw ciphertext in `password`/`notes`/`customFields` AND the MEK-wrapped `dek` field. For `?sealed=1` agent reads use `shapeSealedVaultItem`/`shapeSealedTotpSecret` in `lib/api/resources.ts`, which never emit `dek` and put ciphertext only under `sealed`.
- **AAD rationale**: each AET wrapped-DEK entry is AES-GCM sealed with AAD equal to its resource key (`credential:<id>`/`totp:<id>`/`note:<id>`) so a user cannot swap entries between items or kinds in `metadata.aet` without detection.
- **HKDF, not raw SHA-256**: `deriveAetWrappingKey` uses HKDF-SHA256 with a 16-byte random per-envelope salt. Never "KDF" by hashing the etk directly.
- **JS string wiping is impossible**: only `Uint8Array` can be zeroed (`zeroClearBytes`/`withSecretBytes`). `zeroClearStrings` was removed as dishonest; decrypted field *values* are dropped references, never wiped. Keep secrets in bytes as long as possible (etkSecret, salt, DEKs).
- **Header logging audit**: no request/header logger in `middleware.ts`, `app/api/dev/logs`, or `lib/api` dumps raw headers — `authorization` is read only for actor verification. `x-kylrix-agent-token`, `x-kylrix-mek`, and `authorization` must stay out of logs; audit before adding logging middleware.
- **Server enclave (header mode)**: `x-kylrix-agent-token` is accepted only over https or loopback, only for `agent_enclave_token` keys, and conflicts with a different `Authorization` bearer are rejected. The etk lives in a `WeakMap` keyed on the `ApiActor` (`lib/security/aet-server.ts`) so it can never be serialized; `withApiGuard` releases/zeroes it in `finally`. Enclave responses get `Cache-Control: no-store` + `Pragma: no-cache`.
- **Client-side mode endpoints**: `GET /api/v1/token/enclave` returns `{envelope, scopes, expiresAt}` for the calling AET only; `?sealed=1` on vault/totp list+get is AET-only and returns non-secret metadata + `sealed` ciphertexts.
- **`POST /api/v1/pats`** must not accept `keyCategory: 'agent_enclave_token'` or `aetEnvelope` — browser minting only (the MEK exists only client-side). Server-side `PatService.create` still validates the envelope via `validateAetEnvelope` and caps it at 196,608 bytes in `metadata.aet`.
- **CLI exec AET mode**: child env drops `KYLRIX_AGENT_KEY`/`KYLRIX_TOKEN`; granted rows only. `resolveExecArgs` is pure — keep it that way.
