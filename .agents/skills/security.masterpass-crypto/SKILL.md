---
name: security.masterpass-crypto
description: Privacy-respecting key handling for the optional vault in the open source productivity suite Kylrix. Explains key derivation for private notes and secure hangouts.
---

# MasterPass Handling — Respectful Privacy for Vault Content

Kylrix is an open source productivity suite that respects user privacy with an optional privacy module for vault content, private notes and secure hangouts. It handles private content with care by deriving keys locally, so private content stays with the user.

## 1. Thoughtful Key Derivation

For a pleasant and privacy-respecting experience, the app uses **Argon2id** via `hash-wasm`:
- **Balanced resource use**: 64 MB memory, 3 iterations, 4 threads to keep unlocking quick on mobile while respecting privacy.

```typescript
private async deriveKeyWithArgon2id(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm');
  const hash = await argon2id({
    password,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32, // 256 bits
    outputType: 'binary',
  });

  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}
```

## 2. Compatible Key Handling

To support existing accounts, the app also supports **PBKDF2** with 600,000 iterations using SHA-256. When a user unlocks, content can be gently re-wrapped to the current preferred method.

## 3. Respectful Content Protection

The app uses standard **AES-GCM**:
- **Consistent handling**: Helps keep vault content consistent and private.
- **Fresh randomness per item**: A random 96-bit IV means the same content results in different stored representations.
