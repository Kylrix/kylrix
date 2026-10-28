/**
 * Zero-Knowledge Modular Encryption Primitives
 * Pluggable crypto module for Dual-Wrapped Enclave Crypto & Agent Enclave Tokens (AET).
 *
 * Server never holds MEK or Token Secrets (etkSecret).
 * Client wraps resource DEKs with etkSecret and stores wrappedDeks in token/item metadata.
 */

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  isEncrypted: boolean;
  algorithm: 'AES-256-GCM';
}

export interface WrappedDekMap {
  [resourceId: string]: {
    wrappedDek: string;
    iv: string;
    algorithm: 'AES-256-GCM';
  };
}

export interface ParsedAgentToken {
  tokenId: string;
  etkSecret: string;
  rawToken: string;
}

/**
 * Safe conversion from Uint8Array / ArrayBufferView to standard ArrayBuffer
 * respecting byteOffset and byteLength.
 */
function toArrayBuffer(view: Uint8Array | ArrayBufferView): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/**
 * Stack-safe Uint8Array to Base64 encoding.
 */
function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Stack-safe Base64 to Uint8Array decoding.
 */
function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Utility: Fill Uint8Array with zeroes to purge sensitive material from memory.
 */
export function zeroClearBytes(bytes: Uint8Array | null | undefined): void {
  if (bytes && bytes instanceof Uint8Array) {
    bytes.fill(0);
  }
}

/**
 * Utility: Overwrite string array references in memory.
 */
export function zeroClearStrings(strings: (string | null | undefined)[]): void {
  for (let i = 0; i < strings.length; i++) {
    strings[i] = '';
  }
}

async function deriveKeyFromSecret(secret: string | Uint8Array): Promise<CryptoKey> {
  const bytes = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
  // Digest to ensure exact 256-bit key length
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export const ZeroKnowledgeModule = {
  /**
   * Generates a 256-bit cryptographically secure Token Secret (etkSecret).
   */
  generateEtkSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `etk_${hex}`;
  },

  /**
   * Format full Agent Enclave Token string: kyl_apk_<tokenId>.<etkSecret>
   */
  formatAgentToken(tokenId: string, etkSecret: string): string {
    const cleanSecret = etkSecret.startsWith('etk_') ? etkSecret : `etk_${etkSecret}`;
    return `kyl_apk_${tokenId}.${cleanSecret}`;
  },

  /**
   * Parse Agent Enclave Token string: kyl_apk_<tokenId>.<etkSecret>
   */
  parseAgentToken(tokenString: string): ParsedAgentToken | null {
    if (!tokenString || typeof tokenString !== 'string') return null;
    const trimmed = tokenString.trim();
    if (!trimmed.startsWith('kyl_apk_')) return null;

    const parts = trimmed.slice(8).split('.');
    if (parts.length !== 2) return null;

    const [tokenId, etkSecret] = parts;
    if (!tokenId || !etkSecret) return null;

    return {
      tokenId,
      etkSecret,
      rawToken: trimmed,
    };
  },

  /**
   * Generate an ephemeral 256-bit Data Encryption Key (DEK).
   */
  async generateDEK(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(32));
  },

  /**
   * Encrypt plaintext string or JSON object using AES-256-GCM.
   */
  async encryptPayload(
    dekBytes: Uint8Array | string,
    plaintext: string | Record<string, any>
  ): Promise<EncryptedPayload> {
    const dek = await deriveKeyFromSecret(dekBytes);
    const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
    const encoded = new TextEncoder().encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      dek,
      toArrayBuffer(encoded)
    );

    const encryptedData = bytesToBase64(new Uint8Array(encryptedBuffer));
    const ivBase64 = bytesToBase64(iv);

    return {
      encryptedData,
      iv: ivBase64,
      isEncrypted: true,
      algorithm: 'AES-256-GCM',
    };
  },

  /**
   * Decrypt AES-256-GCM encrypted payload back to string or parsed object.
   */
  async decryptPayload(
    dekBytes: Uint8Array | string,
    encryptedData: string,
    ivBase64: string
  ): Promise<string> {
    const dek = await deriveKeyFromSecret(dekBytes);
    const ciphertext = base64ToBytes(encryptedData);
    const iv = base64ToBytes(ivBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      dek,
      toArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(decryptedBuffer);
  },

  /**
   * Wrap an item DEK with a wrapping key (e.g. etkSecret or MEK).
   */
  async wrapDEK(
    itemDek: Uint8Array,
    wrappingSecret: string | Uint8Array
  ): Promise<{ wrappedDek: string; iv: string }> {
    const wrappingKey = await deriveKeyFromSecret(wrappingSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrappedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      wrappingKey,
      toArrayBuffer(itemDek)
    );

    const wrappedDek = bytesToBase64(new Uint8Array(wrappedBuffer));
    const ivBase64 = bytesToBase64(iv);

    return { wrappedDek, iv: ivBase64 };
  },

  /**
   * Unwrap an item DEK using a wrapping key (e.g. etkSecret or MEK).
   */
  async unwrapDEK(
    wrappedDek: string,
    ivBase64: string,
    wrappingSecret: string | Uint8Array
  ): Promise<Uint8Array> {
    const wrappingKey = await deriveKeyFromSecret(wrappingSecret);
    const ciphertext = base64ToBytes(wrappedDek);
    const iv = base64ToBytes(ivBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      wrappingKey,
      toArrayBuffer(ciphertext)
    );

    return new Uint8Array(decryptedBuffer);
  },

  /**
   * Wrap a map of resource DEKs for an Agent Enclave Token.
   */
  async createWrappedDekMap(
    resourceDeks: Record<string, Uint8Array>,
    etkSecret: string
  ): Promise<WrappedDekMap> {
    const result: WrappedDekMap = {};
    for (const [resourceId, dek] of Object.entries(resourceDeks)) {
      const { wrappedDek, iv } = await this.wrapDEK(dek, etkSecret);
      result[resourceId] = {
        wrappedDek,
        iv,
        algorithm: 'AES-256-GCM',
      };
    }
    return result;
  },

  /**
   * Unwrap a specific resource DEK from a WrappedDekMap using etkSecret.
   */
  async unwrapDekFromMap(
    wrappedDekMap: WrappedDekMap,
    resourceId: string,
    etkSecret: string
  ): Promise<Uint8Array | null> {
    const entry = wrappedDekMap?.[resourceId];
    if (!entry || !entry.wrappedDek || !entry.iv) return null;
    return this.unwrapDEK(entry.wrappedDek, entry.iv, etkSecret);
  },

  /**
   * Memory purging helpers.
   */
  zeroClearBytes,
  zeroClearStrings,
};
