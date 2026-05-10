import { Buffer } from 'buffer';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const GCM_TAG_LENGTH = 16;

function restoreStandardBase64(str: string): string {
    let res = str.replace(/-/g, '+').replace(/_/g, '/');
    while (res.length % 4) res += '=';
    return res;
}

function makeUrlSafe(str: string): string {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Encrypts a string using a provided or randomly generated key.
 * Returns the encrypted data (URL-safe base64) and the key (URL-safe base64).
 */
export async function encryptGhostData(text: string, providedKey?: string): Promise<{ encrypted: string; key: string }> {
    const key = providedKey ? Buffer.from(providedKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64') : randomBytes(32);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Package as: iv (base64) . encrypted (base64) . authTag (base64)
    const result = `${iv.toString('base64')}.${encrypted}.${authTag.toString('base64')}`;

    return {
        encrypted: makeUrlSafe(result),
        key: makeUrlSafe(key.toString('base64')),
    };
}

/**
 * Decrypts a string using the provided URL-safe base64 key.
 */
export async function decryptGhostData(encryptedData: string, keyBase64: string): Promise<string> {
    try {
        const [ivBase64, encrypted, authTagBase64] = restoreStandardBase64(encryptedData).split('.');
        if (!ivBase64 || !encrypted || !authTagBase64) {
            throw new Error('Invalid encrypted data format');
        }

        const key = Buffer.from(restoreStandardBase64(keyBase64), 'base64');
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (e) {
        console.error('[GhostCrypto] Decryption failed:', e);
        throw new Error('Failed to decrypt ghost note. The key may be invalid.');
    }
}

/** AES-256-GCM encrypt arbitrary bytes with the same 32-byte key material as ghost notes / Send URLs (URL-safe base64 key). */
export function encryptGhostBinaryToBytes(data: ArrayBuffer, keyBase64Url: string): Uint8Array {
    const key = Buffer.from(restoreStandardBase64(keyBase64Url), 'base64');
    if (key.length !== 32) {
        throw new Error('Invalid encryption key length');
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return new Uint8Array(Buffer.concat([iv, enc, authTag]));
}

export function decryptGhostBinaryFromBytes(data: ArrayBuffer, keyBase64Url: string): ArrayBuffer {
    const buf = Buffer.from(data);
    if (buf.length < IV_LENGTH + GCM_TAG_LENGTH) {
        throw new Error('Invalid encrypted blob');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(buf.length - GCM_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH, buf.length - GCM_TAG_LENGTH);
    const key = Buffer.from(restoreStandardBase64(keyBase64Url), 'base64');
    if (key.length !== 32) {
        throw new Error('Invalid decryption key length');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const out = new ArrayBuffer(decrypted.length);
    new Uint8Array(out).set(decrypted);
    return out;
}
