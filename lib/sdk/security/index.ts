/**
 * Ecosystem-wide Security Primitives.
 * Implements Zero-Knowledge AES-256-GCM encryption/decryption.
 */

export class KylrixSecurity {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_SIZE = 256;

  /**
   * Derives a cryptographic key from a master password and salt.
   */
  static async deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: this.ALGORITHM, length: this.KEY_SIZE },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Encrypts a string using AES-GCM.
   */
  static async encrypt(data: string, key: CryptoKey): Promise<{ cipher: string; iv: string }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await crypto.subtle.encrypt({ name: this.ALGORITHM, iv }, key, encoder.encode(data));

    return {
      cipher: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  }

  /**
   * Decrypts a base64 encoded cipher text using AES-GCM.
   */
  static async decrypt(cipher: string, iv: string, key: CryptoKey): Promise<string> {
    const decoder = new TextDecoder();
    const cipherBuffer = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
    const ivBuffer = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    const plainBuffer = await crypto.subtle.decrypt({ name: this.ALGORITHM, iv: ivBuffer }, key, cipherBuffer);

    return decoder.decode(plainBuffer);
  }
}

export * from './masterpass';
