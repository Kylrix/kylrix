---
name: vault-security
description: Applies zero-knowledge security constraints to masterpass, passkeys, keychain, credentials, and TOTP flows. Use for unlock/reset/wipe/security-critical logic.
disable-model-invocation: true
---

# Vault Security

## Rules

1. Treat MEK/masterpass/passkey flows as security-critical.
2. Never log secrets, wrapped keys, decrypted values, or sensitive payloads.
3. Preserve reset semantics (tier-2 data invalidation on key reset/rotation).
4. Keep secure verification/sudo-style checks on destructive paths.
5. Preserve encryption tier boundaries across apps.

