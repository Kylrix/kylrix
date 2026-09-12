# Kylrix Crypto Wallet Architecture & Derivation Audit Document

This document provides a complete, unvarnished, and transparent cryptographic audit specification of the crypto wallet generation, key derivation, vault encryption, and key management systems implemented within the codebase.

---

## 1. Executive Summary & Security Model

The crypto wallet ecosystem in this codebase operates on a **client-side, non-custodial architecture**:

1. **Non-Custodial Design:** Seed phrases (BIP-39 mnemonics) and derived private keys are generated and computed exclusively on the client device inside volatile browser memory (`CryptoKey` / Web Crypto API).
2. **Zero Plaintext Knowledge:** Plaintext mnemonics and private keys are **never** transmitted to backend servers or persisted unencrypted anywhere.
3. **Encrypted Persistence:** Persistent wallet state is stored in an encrypted **Root Envelope** (`t4.wallet.root.v1`) encrypted using **AES-256-GCM**.
4. **Hierarchical Key Vault:** The encryption key used for root envelopes is the **Master Encryption Key (MEK)**. The MEK itself is wrapped inside a user-specific keychain by an **AuthKey** derived via **Argon2id** (64 MB RAM, 3 iterations, parallelism 4) or legacy **PBKDF2-HMAC-SHA256** (600,000 iterations).
5. **Multi-Chain Derivation:** A single 12-word BIP-39 mnemonic phrase acts as the sovereign seed for HD keys across EVM networks (Ethereum, Base, Arbitrum, Polygon), Solana, Bitcoin (Native SegWit), Sui, and Nostr identities.

---

## 2. Cryptographic Dependencies & Primitives

All cryptographic operations rely on audited, pure-JavaScript / Web Crypto primitives:

| Category | Library / Standard | Purpose |
| :--- | :--- | :--- |
| **Mnemonic / BIP-39** | `@scure/bip39` | Entropy generation & Mnemonic-to-Seed transformation |
| **HD Key Derivation** | `@scure/bip32` (`HDKey`) | BIP-32 Hierarchical Deterministic child key derivation |
| **Elliptic Curves** | `@noble/secp256k1`, `@noble/ed25519` | ECDSA, Schnorr, Ed25519 keypairs and signatures |
| **Encodings** | `@scure/base` (`base58`, `bech32`) | Base58 (Solana), Bech32 (Bitcoin, Nostr) |
| **Hash Functions** | `@noble/hashes` (`keccak_256`, `sha512`, `blake2b`, `ripemd160`) | Address derivation & checksums |
| **Symmetric Encryption** | Web Crypto API (`AES-GCM`, 256-bit) | Vault envelope encryption & field encryption |
| **Key Derivation (KDF)**| `hash-wasm` (`argon2id`) / Web Crypto `PBKDF2` | Master password to AuthKey derivation |

---

## 3. Entropy Generation & Mnemonic Creation

- **Entropy Source:** 128 bits of cryptographically secure random entropy obtained via browser `crypto.getRandomValues()`.
- **Wordlist:** English BIP-39 wordlist (`@scure/bip39/wordlists/english.js`).
- **Mnemonic Length:** 12 words.
- **Root Envelope Creation:** Upon wallet setup, a root envelope object is formed containing the mnemonic, a random UUID (`walletId`), and a ISO timestamp.

### Root Envelope Interface & Constructor (`lib/services/wallets.ts`)

```typescript
interface WalletRootEnvelope {
    version: 't4.wallet.root.v1';
    walletId: string;
    mnemonic: string;
    createdAt: string;
}

const createRootEnvelope = (): WalletRootEnvelope => ({
    version: 't4.wallet.root.v1',
    walletId: crypto.randomUUID(),
    mnemonic: bip39.generateMnemonic(wordlist, 128),
    createdAt: new Date().toISOString()
});
```

---

## 4. Multi-Chain HD Key Derivation Specification

From the 12-word mnemonic, a 512-bit seed is generated via PBKDF2-HMAC-SHA512 (standard BIP-39 `mnemonicToSeed`). The master HD key is initialized with `HDKey.fromMasterSeed(seed)`.

Each supported chain follows a distinct derivation path and address computation standard:

```
[BIP-39 Mnemonic] ──> [512-bit Seed] ──> [HDKey Master Seed]
                                              │
      ┌──────────────────┬────────────────────┼────────────────────┬──────────────────┐
      │                  │                    │                    │                  │
m/44'/60'/0'/0/0    m/44'/501'/0'/0'     m/84'/0'/0'/0/0      m/44'/784'/0'/0'/0'   EVM Child Key
 (EVM Family)          (Solana)           (Bitcoin)               (Sui)            (Nostr / Agent)
      │                  │                    │                    │                  │
 Keccak-256          Ed25519 Pub          RIPEMD160           Ed25519 Pub         Schnorr x-only
  (Last 20B)          (Base58)            + Bech32            + Blake2b-256        (npub / nsec)
      │                  │                    │                    │                  │
 0x... (EVM)         SOL Address          bc1q... (SegWit)     0x... (Sui)        npub1...
```

### 4.1. EVM Family (Ethereum, Base, Arbitrum, Polygon, USDC)
- **Derivation Path:** `m/44'/60'/0'/0/0`
- **Key Type:** secp256k1
- **Address Algorithm:**
  1. Derive child key at `m/44'/60'/0'/0/0`.
  2. Extract uncompressed public key (65 bytes), dropping the first byte (`0x04` prefix) to yield 64 bytes.
  3. Compute `keccak_256(pubKey64)`.
  4. Take the last 20 bytes of the hash.
  5. Format as lowercase hexadecimal string prefixed with `0x`.

### 4.2. Solana (SOL)
- **Derivation Path:** `m/44'/501'/0'/0'`
- **Key Type:** Ed25519
- **Address Algorithm:**
  1. Derive child key at `m/44'/501'/0'/0'`.
  2. Derive Ed25519 public key (32 bytes) using `@noble/ed25519`.
  3. Base58 encode the 32-byte public key.

### 4.3. Bitcoin (BTC - Native SegWit)
- **Derivation Path:** `m/84'/0'/0'/0/0` (BIP-84)
- **Key Type:** secp256k1
- **Address Algorithm:**
  1. Derive child key at `m/84'/0'/0'/0/0`.
  2. Extract compressed public key (33 bytes).
  3. Compute Hash160: `RIPEMD160(SHA256(compressedPubKey))`.
  4. Convert Hash160 bytes to 5-bit Bech32 words.
  5. Bech32 encode with human-readable part (HRP) `'bc'` and witness version `0`. Resulting format: `bc1q...`.

### 4.4. Sui (SUI)
- **Derivation Path:** `m/44'/784'/0'/0'/0'`
- **Key Type:** Ed25519
- **Address Algorithm:**
  1. Derive child key at `m/44'/784'/0'/0'/0'`.
  2. Derive Ed25519 public key (32 bytes).
  3. Prepend Sui Ed25519 scheme flag byte (`0x00`), creating a 33-byte buffer: `[0x00, ...pubKey32]`.
  4. Compute `blake2b(buffer33, { dkLen: 32 })`.
  5. Take the 32-byte digest, format as hex string prefixed with `0x` (first 64 hex characters).

### Code Implementation Snippet (`lib/services/wallets.ts`)

```typescript
const deriveAddress = async (
    root: WalletRootEnvelope,
    chain: SupportedWalletChain,
    cache: Map<SupportedWalletChain, string>
): Promise<string> => {
    const rootChain = getRootChain(chain);
    const cached = cache.get(rootChain);
    if (cached) return cached;

    let address = '';
    const seed = await bip39.mnemonicToSeed(root.mnemonic);
    const rootKey = HDKey.fromMasterSeed(seed);

    switch (NETWORKS[rootChain].family) {
        case 'evm': {
            // m/44'/60'/0'/0/0
            const child = rootKey.derive("m/44'/60'/0'/0/0");
            if (!child.privateKey) throw new Error('Failed to derive EVM key');
            const pubKey = secp256k1.getPublicKey(child.privateKey, false).slice(1);
            const hash = keccak_256(pubKey);
            address = '0x' + bytesToHex(hash.slice(-20)).toLowerCase();
            break;
        }
        case 'solana': {
            // m/44'/501'/0'/0'
            const child = rootKey.derive("m/44'/501'/0'/0'");
            if (!child.privateKey) throw new Error('Failed to derive Solana key');
            const pubKey = await ed25519.getPublicKey(child.privateKey);
            address = base58.encode(pubKey);
            break;
        }
        case 'bitcoin': {
            // m/84'/0'/0'/0/0 (Native SegWit P2WPKH)
            const child = rootKey.derive("m/84'/0'/0'/0/0");
            if (!child.publicKey) throw new Error('Failed to derive Bitcoin key');
            const pkh = hash160(child.publicKey);
            const words = bech32.toWords(pkh);
            address = bech32.encode('bc', [0, ...words]);
            break;
        }
        case 'sui': {
            // m/44'/784'/0'/0'/0'
            const child = rootKey.derive("m/44'/784'/0'/0'/0'");
            if (!child.privateKey) throw new Error('Failed to derive Sui key');
            const pubKey = await ed25519.getPublicKey(child.privateKey);
            const tmp = new Uint8Array(33);
            tmp.set([0x00]); // Flag for Ed25519 in Sui
            tmp.set(pubKey, 1);
            const hash = blake2b(tmp, { dkLen: 32 });
            address = '0x' + bytesToHex(hash).slice(0, 64);
            break;
        }
        default: {
            throw new Error(`Unsupported wallet family for ${chain}`);
        }
    }

    cache.set(rootChain, address);
    return address;
};
```

---

## 5. Key Storage, Vault Encryption Architecture & Hierarchy

To balance security with local-first responsiveness, the codebase implements a tiered key vault architecture managed by `EcosystemSecurity` (`lib/ecosystem/security.ts`) and `MasterPassCrypto` (`lib/masterpass-crypto.ts`).

### 5.1 Encryption Hierarchy

1. **Master Password / User Secret**
2. **KDF Derivation (Argon2id):**
   - Memory: 64 MB (`65536` KB)
   - Iterations: `3`
   - Parallelism: `4`
   - Output: 256-bit **AuthKey**
3. **Master Encryption Key (MEK):**
   - 256-bit AES-GCM key (`CryptoKey` object generated in Web Crypto API).
   - Encrypts vault fields and the wallet `WalletRootEnvelope`.
4. **Keychain Wrapping:**
   - AuthKey wraps the raw MEK bytes using AES-256-GCM (16-byte random IV).
   - The wrapped payload (`wrappedKey`, `salt`, `params`) is saved in the user's `keychain` table.
5. **Data Encryption Key (DEK):**
   - Individual resources (e.g., agentic items, secrets, TOTPs) can use item-specific DEKs wrapped by the MEK.

```
[Master Password] ──> [Argon2id KDF (64MB, t=3, p=4)] ──> [256-bit AuthKey]
                                                                  │
                                                        AES-256-GCM Unwrap
                                                                  │
                                                        ▼
                                           [Master Encryption Key (MEK)]
                                                    (In Memory)
                                                                  │
                                           ┌──────────────────────┴──────────────────────┐
                                           │                                             │
                                   AES-256-GCM Decrypt                           AES-256-GCM Decrypt
                                           │                                             │
                                           ▼                                             ▼
                               [Wallet Root Envelope]                             [Resource DEKs]
                         ({ version, mnemonic, walletId })
```

### 5.2 Key Derivation Snippets (`lib/masterpass-crypto.ts`)

```typescript
// Argon2id KDF Implementation
private async deriveKeyWithArgon2id(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm');
  const hash = await argon2id({
    password,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536, // 64 MB
    hashLength: 32, // 256 bits
    outputType: 'binary'
  });

  return crypto.subtle.importKey(
    "raw",
    hash as any,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}
```

### 5.3 RAM Ephemeral PIN Session (Quick Unlock)

Users can optionally configure a local PIN. Rather than storing the plaintext password or MEK on disk:
1. **Disk Verifier:** A PBKDF2 hash of the PIN is saved in `localStorage` for authentication.
2. **RAM Ephemeral Session:** When the session starts, an ephemeral key derived from the PIN mixed with a transient tab secret wraps the MEK in `sessionStorage`.
3. If the tab or session closes, the ephemeral session wrapper is cleared.

```typescript
private async deriveEphemeralKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const sessionSecret = this.getOrCreateSessionSecret();

  const pinBytes = encoder.encode(pin);
  const combined = new Uint8Array(pinBytes.length + sessionSecret.length);
  combined.set(pinBytes);
  combined.set(sessionSecret, pinBytes.length);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    combined,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 10000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
```

---

## 6. Agent Sovereign Crypto System

For autonomous AI agents operating within agentic workspaces, the system supports autonomous key derivation (`deriveAgentSovereignCrypto` in `lib/api/resources.ts`).

1. **Autonomous Seed:** Each agent receives an independent 12-word BIP-39 mnemonic.
2. **Derived Addresses:** The agent's seed derives multi-chain addresses (`eth`, `sol`, `btc`, `sui`) and Nostr keypairs (`npub`/`nsec`).
3. **Sealed Keyblob (Gold Key -> Silver Key Hierarchy):**
   - The agent's MEK is encrypted with the user/owner's MEK (`encryptedKeyBlob`).
   - When the owner accesses an agent workspace, `EcosystemSecurity.getAgentMek(agentId)` decrypts the agent's MEK in memory to perform workspace operations.

```typescript
// Excerpt from lib/api/resources.ts
async deriveAgentSovereignCrypto(customMnemonic?: string) {
  const bip39 = await import('@scure/bip39');
  const { wordlist } = await import('@scure/bip39/wordlists/english.js');
  const { HDKey } = await import('@scure/bip32');
  const secp256k1 = await import('@noble/secp256k1');
  const ed25519 = await import('@noble/ed25519');
  const { base58, bech32 } = await import('@scure/base');
  const { keccak_256 } = await import('@noble/hashes/sha3.js');
  const { ripemd160: hash160 } = await import('@noble/hashes/legacy.js');
  const { blake2b } = await import('@noble/hashes/blake2.js');

  const mnemonic = customMnemonic || bip39.generateMnemonic(wordlist, 128);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootKey = HDKey.fromMasterSeed(seed);

  // 1. EVM (m/44'/60'/0'/0/0)
  const evmChild = rootKey.derive("m/44'/60'/0'/0/0");
  const evmPub = secp256k1.getPublicKey(evmChild.privateKey!, false).slice(1);
  const evmHash = keccak_256(evmPub);
  const ethAddress = '0x' + bytesToHex(evmHash.slice(-20)).toLowerCase();

  // 2. Solana (m/44'/501'/0'/0')
  const solChild = rootKey.derive("m/44'/501'/0'/0'");
  const solPub = await ed25519.getPublicKey(solChild.privateKey!);
  const solAddress = base58.encode(solPub);

  // 3. Bitcoin (m/84'/0'/0'/0/0 Native SegWit)
  const btcChild = rootKey.derive("m/84'/0'/0'/0/0");
  const pkh = hash160(btcChild.publicKey!);
  const btcAddress = bech32.encode('bc', [0, ...bech32.toWords(pkh)]);

  // 4. Sui (m/44'/784'/0'/0'/0')
  const suiChild = rootKey.derive("m/44'/784'/0'/0'/0'");
  const suiPub = await ed25519.getPublicKey(suiChild.privateKey!);
  const tmp = new Uint8Array(33);
  tmp.set([0x00]);
  tmp.set(suiPub, 1);
  const suiHash = blake2b(tmp, { dkLen: 32 });
  const suiAddress = '0x' + bytesToHex(suiHash).slice(0, 64);

  // 5. Nostr keypair
  const nostrPriv = evmChild.privateKey!;
  const nostrPubRaw = secp256k1.getPublicKey(nostrPriv, true).slice(1);
  const nostrNpub = bech32.encode('npub', bech32.toWords(nostrPubRaw));
  const nostrNsec = bech32.encode('nsec', bech32.toWords(nostrPriv));

  return {
    mnemonic,
    ethAddress,
    solAddress,
    btcAddress,
    suiAddress,
    nostrNpub,
    nostrNsec,
    mekHex: bytesToHex(nostrPriv)
  };
}
```

---

## 7. Memory Zeroization, Locking & Session Lifecycle

The system enforces strict memory hygiene upon system locking or idle timeout (default 10 minutes):

1. **Master Key Zeroization:** `this.masterKey = null`, `this.identityKeyPair = null`.
2. **Cache Eviction:** Clear all in-memory decryption maps (`this.decryptionCache.clear()`, `this.conversationKeys.clear()`).
3. **SessionStorage Clearing:** Removal of `vault_unlocked` and `kylrix_vault_unlocked` keys.
4. **Service Worker Eviction:** Send `WIPE_CONTEXT` directive to service workers to clear any in-flight Web Worker keys.
5. **Disk Decrypted Cache Purge:** Direct purge of decrypted offline caches (`f_decrypted_totps_${uid}`, `f_decrypted_vault_${uid}`) via `LocalEngine`.

```typescript
lockApplication(): void {
  // Clear all decrypted data from memory
  this.masterKey = null;
  this.isUnlocked = false;
  resetSudo();

  // Wipe from Service Worker
  if (typeof window !== 'undefined' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'WIPE_CONTEXT' });
  }

  // Clear session storage
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("vault_unlocked");
    sessionStorage.removeItem("kylrix_vault_unlocked");
  }

  // Clear any cached decrypted data
  this.clearDecryptedCache();
}
```

---

## 8. On-Chain RPC Interactions & Multicall

For querying balances and estimating transaction costs without compromising privacy:
- **Client:** `viem` (v2) public clients.
- **Provider:** DRPC endpoints (`https://lb.drpc.org/ogrpc`).
- **Batching:** `getBalancesMulticall` aggregates native ETH/chain balances and ERC-20 `balanceOf` queries into single RPC requests via `Multicall3` contract (`0xcA11bde05977b3631167028862bE2a173976CA11`).

---

## 9. Verification & Audit Checklist

| Security Requirement | Status | Verification Detail |
| :--- | :--- | :--- |
| **BIP-39 Mnemonic Compliance** | Passed | Standard 128-bit entropy, 12 words, English wordlist |
| **BIP-44 / BIP-84 Standard Paths** | Passed | EVM (`m/44'/60'`), SOL (`m/44'/501'`), BTC (`m/84'/0'`), SUI (`m/44'/784'`) |
| **Symmetric Encryption Standard** | Passed | AES-256-GCM with unique 16-byte random IV per record |
| **Key Derivation Hardening** | Passed | Argon2id (64MB RAM, t=3, p=4) primary KDF |
| **Non-Custodial Guarantee** | Passed | Plaintext seed never sent to backend or logged |
| **Memory Isolation & Zeroization** | Passed | Keys held as non-exportable `CryptoKey` where possible, zeroed on lock |
