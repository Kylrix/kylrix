import * as secp256k1 from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
;

// Configure secp256k1 with the sha256 hash function
secp256k1.hashes.sha256 = (message) => sha256(message);

import { bech32 } from "@scure/base";


// Encrypted Vault model

// Convert a byte array to hex
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b: any) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert a hex string to bytes
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Bech32 conversion helpers for Nostr npub/nsec
export function bytesToNpub(pubkeyBytes: Uint8Array): string {
  const words = bech32.toWords(pubkeyBytes);
  return bech32.encode("npub", words);
}

export function npubToBytes(npub: string): Uint8Array {
  const { prefix, words } = bech32.decode(npub);
  if (prefix !== "npub") throw new Error("Invalid npub prefix");
  return new Uint8Array(bech32.fromWords(words));
}

export function bytesToNsec(privkeyBytes: Uint8Array): string {
  const words = bech32.toWords(privkeyBytes);
  return bech32.encode("nsec", words);
}

export function nsecToBytes(nsec: string): Uint8Array {
  const { prefix, words } = bech32.decode(nsec);
  if (prefix !== "nsec") throw new Error("Invalid nsec prefix");
  return new Uint8Array(bech32.fromWords(words));
}

/** Normalise private key material after IndexedDB / JSON cache round-trips. */
export function normalizePrivateKeyBytes(
  raw: Uint8Array | Record<string, number> | string | null | undefined,
): Uint8Array | null {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw.length === 32 ? raw : null;
  if (typeof raw === 'string') {
    try {
      if (raw.startsWith('nsec')) return nsecToBytes(raw);
      if (/^[0-9a-fA-F]{64}$/.test(raw)) return hexToBytes(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    try {
      const values = Array.isArray(raw)
        ? raw
        : Object.keys(raw)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => (raw as Record<string, number>)[key]);
      const arr = new Uint8Array(values as number[]);
      return arr.length === 32 ? arr : null;
    } catch {
      return null;
    }
  }
  return null;
}


// Helper to encrypt a master private key (32 bytes nsec) with a derived symmetric key (32 bytes)

// Helper to decrypt a master private key with a derived symmetric key

// Pathway 1: WebAuthn Passkey (Hardware Boundary with PRF)


// Pathway 2: Client-Side Argon2id Password (Portability Layer)

// Pathway 3: BIP-39 Recovery Phrase (Absolute Fallback)

// Generate new random mnemonic

// SECP256K1 functions

