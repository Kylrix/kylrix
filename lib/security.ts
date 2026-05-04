/**
 * Security utility functions
 * Implements various security best practices and protections
 */

import { logWarn } from './logger';

/**
 * Generate a cryptographically secure random string
 * @param length Length of the string
 * @returns Base64 encoded random string
 */
export function generateSecureRandom(length: number = 32): string {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Web Crypto API not available');
  }

  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Generate a truly random salt for key derivation
 * @param size Size in bytes (default: 32)
 * @returns Uint8Array containing random salt
 */
export function generateRandomSalt(size: number = 32): Uint8Array {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Web Crypto API not available');
  }

  const salt = new Uint8Array(size);
  window.crypto.getRandomValues(salt);
  return salt;
}

/**
 * Securely compare two strings in constant time
 * Prevents timing attacks (CVE-KYL-2026-003)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  let result = a.length ^ b.length;
  
  // Iterate through a fixed length to prevent timing leaks about secret length
  // 512 characters is sufficient for all Kylrix ecosystem keys and tokens
  const maxCompareLen = 512;
  
  for (let i = 0; i < maxCompareLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}

/**
 * Clear sensitive data from memory
 * Overwrites the string/array with zeros
 */
export function clearSensitiveData(data: string | Uint8Array): void {
  if (typeof data === 'string') {
    // JavaScript strings are immutable, so we can't actually clear them
    // This is a limitation of JavaScript
    // Best practice: minimize lifetime of sensitive strings
    logWarn('Attempted to clear sensitive string data (strings are immutable in JS)');
    return;
  }

  // For typed arrays, we can overwrite
  if (data instanceof Uint8Array) {
    data.fill(0);
  }
}

/**
 * Create a secure session token
 */
export function createSessionToken(): string {
  return generateSecureRandom(48);
}

/**
 * Hash data using SHA-256
 */
export async function hashData(data: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify integrity of encrypted data using HMAC
 * @param data The encrypted data
 * @param hmac The HMAC to verify against
 * @param key The HMAC key
 */
export async function verifyHMAC(
  data: string,
  hmac: string,
  key: CryptoKey
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }

  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hmacBuffer = await window.crypto.subtle.sign(
      'HMAC',
      key,
      dataBuffer
    );
    const computedHmac = btoa(String.fromCharCode(...new Uint8Array(hmacBuffer)));
    return constantTimeCompare(hmac, computedHmac);
  } catch (error: unknown) {
    logWarn('HMAC verification failed', { error });
    return false;
  }
}

/**
 * Generate HMAC for encrypted data
 */
export async function generateHMAC(
  data: string,
  key: CryptoKey
): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hmacBuffer = await window.crypto.subtle.sign(
    'HMAC',
    key,
    dataBuffer
  );
  return btoa(String.fromCharCode(...new Uint8Array(hmacBuffer)));
}

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/**
 * Get device fingerprint (for session validation)
 * Note: This is not foolproof but adds an extra layer
 */
export async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height,
    screen.colorDepth,
  ];

  const fingerprint = components.join('|');
  return await hashData(fingerprint);
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let safe = filename.replace(/^.*[\\\/]/, '');
  
  // Remove dangerous characters
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (safe.length > 255) {
    safe = safe.substring(0, 255);
  }
  
  return safe;
}

/**
 * Check if password has been compromised (client-side k-anonymity check)
 * This would require integration with Have I Been Pwned API
 * Placeholder implementation
 */
export async function checkPasswordCompromised(password: string): Promise<boolean> {
  // TODO: Implement k-anonymity check against HIBP API
  // For now, just do basic checks
  
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
    'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
    'bailey', 'passw0rd', 'shadow', '123123', '654321'
  ];

  return commonPasswords.includes(password.toLowerCase());
}

/**
 * Zeroize a CryptoKey (make it unusable)
 * Note: JavaScript doesn't allow direct memory manipulation
 * Best we can do is drop references and hope GC cleans up
 */
export function zeroizeCryptoKey(key: CryptoKey | null): void {
  if (key) {
    // Drop reference
    key = null;
  }
  
  // Suggest garbage collection if available
  if (typeof window !== 'undefined' && 'gc' in window) {
    try {
      (window as typeof window & { gc?: () => void }).gc?.();
    } catch {
      // GC is not available or failed
    }
  }
}

/**
 * Parse and validate JSON safely
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Encode data for safe URL transmission
 */
export function safeBase64Encode(data: string): string {
  try {
    return btoa(encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch {
    throw new Error('Failed to encode data');
  }
}

/**
 * Decode base64 data safely
 */
export function safeBase64Decode(encoded: string): string {
  try {
    return decodeURIComponent(
      Array.from(atob(encoded), c => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch {
    throw new Error('Failed to decode data');
  }
}
