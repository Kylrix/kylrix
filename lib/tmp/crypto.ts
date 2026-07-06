import * as secp256k1 from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
export { sha256 };

// Configure secp256k1 with the sha256 hash function
secp256k1.hashes.sha256 = (message) => sha256(message);

import { bech32 } from "@scure/base";
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export function verifyVerification(username: string, npub: string, signature: string, domainPubkey: string): boolean {
  try {
    const encoder = new TextEncoder();
    const hash = sha256(encoder.encode(username + ":" + npub));
    return secp256k1.schnorr.verify(new Uint8Array(Buffer.from(signature, "hex")), hash, new Uint8Array(Buffer.from(domainPubkey, "hex")));
  } catch {
    return false;
  }
}

// Encrypted Vault model
export interface EncryptedVault {
  ciphertext: string; // hex
  iv: string; // hex
  salt: string; // hex
}

// Convert a byte array to hex
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
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

// Helper to encrypt a master private key (32 bytes nsec) with a derived symmetric key (32 bytes)
export async function encryptVault(privateKeyBytes: Uint8Array, keyBytes: Uint8Array, saltBytes: Uint8Array): Promise<EncryptedVault> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    privateKeyBytes as unknown as BufferSource
  );

  return {
    ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer)),
    iv: bytesToHex(iv),
    salt: bytesToHex(saltBytes),
  };
}

// Helper to decrypt a master private key with a derived symmetric key
export async function decryptVault(vault: EncryptedVault, keyBytes: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(vault.iv) as unknown as BufferSource },
    cryptoKey,
    hexToBytes(vault.ciphertext) as unknown as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}

// Pathway 1: WebAuthn Passkey (Hardware Boundary with PRF)
export async function registerPasskey(alias: string): Promise<{ key: Uint8Array; credentialIdHex: string }> {
  const rpId = window.location.hostname || "localhost";
  const prfSalt = new TextEncoder().encode("tendon-v3-prf-salt");

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Tendon Message Protocol", id: rpId },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: alias,
        displayName: alias,
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 (P-256)
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      extensions: {
        prf: {
          eval: { first: prfSalt },
        },
      } as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Failed to create credential");
  }

  interface PrfExtensionResult {
    prf?: {
      results?: {
        first?: ArrayBuffer;
      };
    };
  }
  const results = credential.getClientExtensionResults() as PrfExtensionResult;
  let prfBuffer: ArrayBuffer | undefined = results.prf?.results?.first;

  // Fallback if PRF extension isn't supported or returned by browser/device
  if (!prfBuffer) {
    console.warn("WebAuthn PRF not supported by browser/device. Falling back to SHA-256 of credential ID.");
    prfBuffer = sha256(new Uint8Array(credential.rawId)).buffer as ArrayBuffer;
  }

  const credentialIdHex = bytesToHex(new Uint8Array(credential.rawId));
  return {
    key: new Uint8Array(prfBuffer),
    credentialIdHex,
  };
}

export async function loginPasskey(credentialIdsHex: string[] | string): Promise<{ key: Uint8Array; credentialIdHex: string }> {
  const rpId = window.location.hostname || "localhost";
  const prfSalt = new TextEncoder().encode("tendon-v3-prf-salt");
  
  const ids = Array.isArray(credentialIdsHex) ? credentialIdsHex : [credentialIdsHex];
  const allowCredentials = ids.map(id => ({
    type: "public-key" as const,
    id: hexToBytes(id) as unknown as BufferSource,
  }));

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId,
      allowCredentials,
      userVerification: "required",
      extensions: {
        prf: {
          eval: { first: prfSalt },
        },
      } as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Failed to authenticate passkey");
  }

  interface PrfExtensionResult {
    prf?: {
      results?: {
        first?: ArrayBuffer;
      };
    };
  }
  const results = credential.getClientExtensionResults() as PrfExtensionResult;
  let prfBuffer: ArrayBuffer | undefined = results.prf?.results?.first;

  if (!prfBuffer) {
    console.warn("WebAuthn PRF not supported by browser/device. Falling back to SHA-256 of credential ID.");
    prfBuffer = sha256(new Uint8Array(credential.rawId)).buffer as ArrayBuffer;
  }

  const credentialIdHex = bytesToHex(new Uint8Array(credential.rawId));
  return {
    key: new Uint8Array(prfBuffer),
    credentialIdHex,
  };
}

// Pathway 2: Client-Side Argon2id Password (Portability Layer)
export async function deriveKeyFromPassword(password: string, saltHex: string): Promise<Uint8Array> {
  const { argon2id } = await import("hash-wasm");
  const hashBytes = await argon2id({
    password: password,
    salt: hexToBytes(saltHex),
    iterations: 3,
    memorySize: 65536,
    parallelism: 4,
    hashLength: 32,
    outputType: "binary",
  });
  return hashBytes;
}

// Pathway 3: BIP-39 Recovery Phrase (Absolute Fallback)
export function deriveKeyFromMnemonic(mnemonic: string): Uint8Array {
  const trimmed = mnemonic.trim().toLowerCase();
  const seed = mnemonicToSeedSync(trimmed);
  // Hash seed to get a 32-byte key
  return new Uint8Array(sha256(seed).slice(0, 32));
}

// Generate new random mnemonic
export function createNewMnemonic(): string {
  return generateMnemonic(wordlist);
}

// SECP256K1 functions
export function getPubkeyFromPrivkey(privkey: Uint8Array): Uint8Array {
  return secp256k1.schnorr.getPublicKey(privkey);
}

export function generateRandomPrivkey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
