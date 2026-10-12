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
