// JavaScript strings are immutable and cannot be wiped. Every secret this module
// produces is a Uint8Array so callers can zero it with zeroClearBytes(). Strings
// that unavoidably carry secrets (the token text, child-process env values) live
// until garbage collection; keep their lifetime short and drop references.

/**
 * Zero-Knowledge Modular Encryption Primitives
 * Pluggable crypto module for Dual-Wrapped Enclave Crypto & Agent Enclave Tokens (AET).
 *
 * Server never holds MEK or Token Secrets (etkSecret).
 * Client wraps resource DEKs with an AET wrapping key (HKDF-SHA256 over etkSecret
 * with a per-envelope salt) and stores wrappedDeks in token/item metadata.
 *
 * Token format: kyl_aet_<8 hex prefix>_<32 base64url auth secret>.etk_<64 hex>
 * The left side is a server-verifiable bearer credential; the right side is the
 * unlock key and never leaves the client in client-side mode.
 */

export type AetResourceKind = 'credential' | 'totp' | 'note';
/** `${kind}:${rowId}` — also used as AES-GCM AAD. */
export type AetResourceKey = `${AetResourceKind}:${string}`;

export interface WrappedDekEntry {
  wrappedDek: string; // base64, decodes to exactly 48 bytes (32 DEK + 16 GCM tag)
  iv: string; // base64, decodes to exactly 12 bytes
  algorithm: 'AES-256-GCM';
}

export type WrappedDekMap = {
  [resourceKey: AetResourceKey]: WrappedDekEntry;
};

/** Stored at apikey.metadata.aet (JSON). Never returned by list endpoints. */
export interface AetEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  salt: string; // base64, 16 random bytes
  resources: { credential: boolean; totp: boolean; note: boolean };
  createdAt: string; // ISO-8601
  deks: WrappedDekMap;
}

export interface ParsedAgentToken {
  prefix: string; // 8 hex chars
  bearer: string; // 'kyl_aet_<prefix>_<authSecret>' — the only part for Authorization
  etkSecret: Uint8Array; // 32 bytes; caller MUST zeroClearBytes() when done
}

export interface EncryptedPayload {
  encryptedData: string; // base64 ciphertext+tag
  iv: string; // base64, 12 bytes
  isEncrypted: true;
  algorithm: 'AES-256-GCM';
}

export type ZeroKnowledgeErrorCode =
  | 'invalid_token'
  | 'legacy_token_format'
  | 'invalid_encoding'
  | 'invalid_key_length'
  | 'unsupported_algorithm'
  | 'invalid_envelope'
  | 'decrypt_failed';

export class ZeroKnowledgeError extends Error {
  constructor(
    public readonly code: ZeroKnowledgeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ZeroKnowledgeError';
  }
}

// ── Token format ──

export const AET_PREFIX = 'kyl_aet_';
export const AET_REGEX = /^kyl_aet_([0-9a-f]{8})_([A-Za-z0-9_-]{32})\.etk_([0-9a-f]{64})$/;
export const AET_BEARER_REGEX = /^kyl_aet_([0-9a-f]{8})_([A-Za-z0-9_-]{32})$/;

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function isAgentEnclaveToken(value: unknown): value is string {
  return typeof value === 'string' && AET_REGEX.test(value.trim());
}

/** Returns the bearer part of an AET, or the input unchanged if it is not an AET. */
export function toBearerCredential(value: string): string {
  const t = value.trim();
  if (t.startsWith(AET_PREFIX) && t.includes('.')) return t.slice(0, t.indexOf('.'));
  return t;
}

/** Splits an AET into its bearer and unlock-part strings. Returns null if not an AET shape. */
export function splitAgentToken(input: unknown): { bearer: string; unlock: string } | null {
  if (typeof input !== 'string') return null;
  const t = input.trim();
  if (!t.startsWith(AET_PREFIX)) return null;
  const idx = t.indexOf('.');
  if (idx < 0) return null;
  return { bearer: t.slice(0, idx), unlock: t.slice(idx + 1) };
}

export function parseAgentToken(input: unknown): ParsedAgentToken {
  if (typeof input !== 'string') throw new ZeroKnowledgeError('invalid_token', 'Agent key must be text');
  const t = input.trim();
  if (t.startsWith('kyl_apk_') && t.includes('.')) {
    throw new ZeroKnowledgeError(
      'legacy_token_format',
      'This agent key uses an old preview format. Create a new agent key in Settings.'
    );
  }
  const m = AET_REGEX.exec(t);
  if (!m) throw new ZeroKnowledgeError('invalid_token', 'Not a valid agent key');
  const [, prefix, authSecret, etkHex] = m;
  return { prefix, bearer: `kyl_aet_${prefix}_${authSecret}`, etkSecret: hexToBytes(etkHex) };
}

export function formatAgentToken(bearer: string, etkSecret: Uint8Array): string {
  if (!AET_BEARER_REGEX.test(bearer)) throw new ZeroKnowledgeError('invalid_token', 'Invalid bearer part');
  if (etkSecret.byteLength !== 32) throw new ZeroKnowledgeError('invalid_key_length', 'Unlock key must be 32 bytes');
  return `${bearer}.etk_${bytesToHex(etkSecret)}`;
}

export function generateEtkSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** For input boxes: returns a plain-language error, or null when valid. Never echoes the value. */
export function validateAgentTokenInput(value: string): string | null {
  if (!value?.trim()) return 'Paste your agent key';
  try {
    const p = parseAgentToken(value);
    zeroClearBytes(p.etkSecret);
    return null;
  } catch (e) {
    if (e instanceof ZeroKnowledgeError && e.code === 'legacy_token_format') return e.message;
    return 'This does not look like an agent key. It should start with kyl_aet_';
  }
}

// ── Encoding ──

const B64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HEX_RE = /^(?:[0-9a-f]{2})+$/;

/** Stack-safe Uint8Array to Base64 encoding. */
export function bytesToBase64(bytes: Uint8Array): string {
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

/** Stack-safe strict Base64 to Uint8Array decoding. Throws on malformed input. */
export function base64ToBytes(b64: string): Uint8Array {
  if (typeof b64 !== 'string' || !B64_RE.test(b64)) {
    throw new ZeroKnowledgeError('invalid_encoding', 'Invalid base64 input');
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
    throw new ZeroKnowledgeError('invalid_encoding', 'Invalid hex input');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

// ── Memory ──

/** Fill Uint8Array with zeroes to purge sensitive material from memory. */
export function zeroClearBytes(bytes: Uint8Array | null | undefined): void {
  if (bytes && bytes instanceof Uint8Array) {
    bytes.fill(0);
  }
}

/** Runs fn with secret bytes and always zero-fills them afterwards, even on throw. */
export async function withSecretBytes<T>(
  bytes: Uint8Array,
  fn: (b: Uint8Array) => Promise<T>
): Promise<T> {
  try {
    return await fn(bytes);
  } finally {
    zeroClearBytes(bytes);
  }
}

// ── Buffers ──

/**
 * Safe conversion from Uint8Array / ArrayBufferView to a freshly allocated
 * standard ArrayBuffer, respecting byteOffset and byteLength and copying out of
 * SharedArrayBuffer-backed views.
 */
function toArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return out;
}

// ── Keys ──

/** Import a raw 32-byte AES-256-GCM key. No KDF: DEKs and wrapped keys are uniform random. */
export async function importAesKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt']
): Promise<CryptoKey> {
  if (!(raw instanceof Uint8Array) || raw.byteLength !== 32) {
    throw new ZeroKnowledgeError('invalid_key_length', 'Key must be 32 bytes');
  }
  const copy = toArrayBuffer(raw);
  try {
    return await crypto.subtle.importKey('raw', copy, { name: 'AES-GCM', length: 256 }, false, usages);
  } finally {
    new Uint8Array(copy).fill(0);
  }
}

/**
 * Derives the per-envelope AET wrapping key via HKDF-SHA256.
 * Input must be 32 random bytes. Never pass a password; use
 * lib/masterpass-crypto.ts for passwords.
 */
export async function deriveAetWrappingKey(
  etkSecret: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!(etkSecret instanceof Uint8Array) || etkSecret.byteLength !== 32) {
    throw new ZeroKnowledgeError('invalid_key_length', 'Unlock key must be 32 bytes');
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength !== 16) {
    throw new ZeroKnowledgeError('invalid_envelope', 'Invalid envelope salt');
  }
  const ikm = toArrayBuffer(etkSecret);
  try {
    const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(utf8('kylrix/aet/dek-wrap/v1')),
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    new Uint8Array(ikm).fill(0);
  }
}

// ── Payloads ──

/** Generate an ephemeral 256-bit Data Encryption Key (DEK). */
export async function generateDEK(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Encrypt plaintext string or JSON object using AES-256-GCM and a raw 32-byte DEK. */
export async function encryptPayload(
  dek: Uint8Array,
  plaintext: string | Record<string, unknown>
): Promise<EncryptedPayload> {
  const key = await importAesKey(dek, ['encrypt']);
  const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const encoded = utf8(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );

  return {
    encryptedData: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    isEncrypted: true,
    algorithm: 'AES-256-GCM',
  };
}

/** Decrypt an AES-256-GCM payload produced by encryptPayload. */
export async function decryptPayload(
  dek: Uint8Array,
  encryptedData: string,
  ivBase64: string
): Promise<string> {
  const key = await importAesKey(dek, ['decrypt']);
  const ciphertext = base64ToBytes(encryptedData);
  const iv = base64ToBytes(ivBase64);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not decrypt this payload');
  }
}

// ── DEK wrapping ──

async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad?: string
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const alg: AesGcmParams = { name: 'AES-GCM', iv: toArrayBuffer(iv) };
  if (aad) alg.additionalData = toArrayBuffer(utf8(aad));
  const ct = new Uint8Array(await crypto.subtle.encrypt(alg, key, toArrayBuffer(plaintext)));
  return { ciphertext: ct, iv };
}

/** Wrap one DEK under an imported AET wrapping key, bound to its resource key as AAD. */
export async function wrapDekEntry(
  wrapKey: CryptoKey,
  dek: Uint8Array,
  resourceKey: AetResourceKey
): Promise<WrappedDekEntry> {
  if (!(dek instanceof Uint8Array) || dek.byteLength !== 32) {
    throw new ZeroKnowledgeError('invalid_key_length', 'Key must be 32 bytes');
  }
  const { ciphertext, iv } = await aesGcmEncrypt(wrapKey, dek, resourceKey);
  return { wrappedDek: bytesToBase64(ciphertext), iv: bytesToBase64(iv), algorithm: 'AES-256-GCM' };
}

/** Wrap an item DEK with a raw 32-byte wrapping key (no AAD; prefer wrapDekEntry for AETs). */
export async function wrapDEK(
  itemDek: Uint8Array,
  wrappingKey: Uint8Array
): Promise<{ wrappedDek: string; iv: string }> {
  const key = await importAesKey(wrappingKey, ['encrypt']);
  const { ciphertext, iv } = await aesGcmEncrypt(key, itemDek);
  return { wrappedDek: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

/** Unwrap an item DEK with a raw 32-byte wrapping key. */
export async function unwrapDEK(
  wrappedDek: string,
  ivBase64: string,
  wrappingKey: Uint8Array
): Promise<Uint8Array> {
  const key = await importAesKey(wrappingKey, ['decrypt']);
  const ciphertext = base64ToBytes(wrappedDek);
  const iv = base64ToBytes(ivBase64);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not unlock this item');
  }
}

/** Wrap a map of resource DEKs for an Agent Enclave Token. */
export async function createWrappedDekMap(
  resourceDeks: Partial<Record<AetResourceKey, Uint8Array>>,
  etkSecret: Uint8Array,
  salt: Uint8Array
): Promise<WrappedDekMap> {
  const wrapKey = await deriveAetWrappingKey(etkSecret, salt);
  const result: WrappedDekMap = {} as WrappedDekMap;
  for (const [resourceKey, dek] of Object.entries(resourceDeks)) {
    if (!dek) continue;
    result[resourceKey as AetResourceKey] = await wrapDekEntry(wrapKey, dek, resourceKey as AetResourceKey);
  }
  return result;
}

/**
 * Unwrap a specific resource DEK from a WrappedDekMap using the etkSecret and
 * the envelope salt. Returns null when the resource is not granted; throws on
 * malformed or undecryptable entries.
 */
export async function unwrapDekFromMap(
  map: WrappedDekMap,
  resourceKey: AetResourceKey,
  etkSecret: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array | null> {
  const entry = map?.[resourceKey];
  if (!entry) return null; // not granted: not an error
  if (entry.algorithm !== 'AES-256-GCM') {
    throw new ZeroKnowledgeError('unsupported_algorithm', 'Unsupported key wrapping method');
  }
  const iv = base64ToBytes(entry.iv);
  const ct = base64ToBytes(entry.wrappedDek);
  if (iv.byteLength !== 12 || ct.byteLength !== 48) {
    throw new ZeroKnowledgeError('invalid_envelope', 'Malformed key entry');
  }
  const key = await deriveAetWrappingKey(etkSecret, salt);
  try {
    const dek = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: toArrayBuffer(utf8(resourceKey)) },
        key,
        toArrayBuffer(ct)
      )
    );
    if (dek.byteLength !== 32) throw new Error();
    return dek;
  } catch {
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not unlock this item');
  }
}

// ── Envelope validation ──

const AET_RESOURCE_KEY_RE = /^(credential|totp|note):[A-Za-z0-9_-]{1,64}$/;
export const AET_MAX_DEK_ENTRIES = 500;

/** Validates the shape of an AetEnvelope. Throws ZeroKnowledgeError('invalid_envelope'). */
export function validateAetEnvelope(e: unknown): AetEnvelope {
  const fail = (): never => {
    throw new ZeroKnowledgeError('invalid_envelope', 'Invalid agent key envelope');
  };
  if (!e || typeof e !== 'object') fail();
  const env = e as Record<string, unknown>;
  if (env.v !== 1 || env.alg !== 'AES-256-GCM' || env.kdf !== 'HKDF-SHA256') fail();
  if (typeof env.salt !== 'string') fail();
  try {
    if (base64ToBytes(env.salt).byteLength !== 16) fail();
  } catch {
    fail();
  }
  if (typeof env.createdAt !== 'string' || !env.createdAt) fail();
  const res = env.resources;
  if (
    !res ||
    typeof res !== 'object' ||
    typeof (res as any).credential !== 'boolean' ||
    typeof (res as any).totp !== 'boolean' ||
    typeof (res as any).note !== 'boolean'
  ) {
    fail();
  }
  const deks = env.deks;
  if (!deks || typeof deks !== 'object' || Array.isArray(deks)) fail();
  const entries = Object.entries(deks as Record<string, unknown>);
  if (entries.length > AET_MAX_DEK_ENTRIES) fail();
  for (const [key, entry] of entries) {
    if (!AET_RESOURCE_KEY_RE.test(key)) fail();
    if (!entry || typeof entry !== 'object') fail();
    const en = entry as Record<string, unknown>;
    if (en.algorithm !== 'AES-256-GCM') fail();
    if (typeof en.iv !== 'string' || typeof en.wrappedDek !== 'string') fail();
    try {
      if (base64ToBytes(en.iv).byteLength !== 12 || base64ToBytes(en.wrappedDek).byteLength !== 48) fail();
    } catch {
      fail();
    }
  }
  return e as AetEnvelope;
}

// ── Row format compatibility (lib/api/vault-crypto.ts) ──

function safeJson(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Reads the MEK-wrapped DEK carried by a Row (row.dek or metadata.dek). */
export function getRowWrappedDek(row: Record<string, unknown>): string | null {
  if (typeof row.dek === 'string' && row.dek.trim()) return row.dek.trim();
  const meta = safeJson(row.metadata);
  return typeof meta?.dek === 'string' && meta.dek.trim() ? meta.dek.trim() : null;
}

/**
 * Unwraps a Row DEK produced by lib/api/vault-crypto.ts:
 * base64( IV(16) || AES-GCM(MEK, utf8( base64(rawDek) )) ).
 * The inner plaintext is the base64 text of the 32-byte DEK.
 */
export async function unwrapRowDek(wrappedDekB64: string, mek: CryptoKey): Promise<Uint8Array> {
  const combined = base64ToBytes(wrappedDekB64);
  if (combined.byteLength < 17) {
    throw new ZeroKnowledgeError('invalid_envelope', 'Malformed wrapped key');
  }
  const iv = combined.subarray(0, 16);
  const ct = combined.subarray(16);
  let dek: Uint8Array;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      mek,
      toArrayBuffer(ct)
    );
    dek = base64ToBytes(new TextDecoder().decode(plaintext));
  } catch (e) {
    if (e instanceof ZeroKnowledgeError) throw e;
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not unlock this item');
  }
  if (dek.byteLength !== 32) {
    throw new ZeroKnowledgeError('invalid_key_length', 'Key must be 32 bytes');
  }
  return dek;
}

/** Decrypts one Row field produced by encryptFieldWithKey (16-byte IV prefix). */
export async function decryptRowField(fieldB64: string, dek: Uint8Array): Promise<string> {
  const key = await importAesKey(dek, ['decrypt']);
  const combined = base64ToBytes(fieldB64);
  if (combined.byteLength < 17) {
    throw new ZeroKnowledgeError('invalid_envelope', 'Malformed field ciphertext');
  }
  const iv = combined.subarray(0, 16);
  const ct = combined.subarray(16);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ct)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not decrypt this field');
  }
}

// ── Namespace export (compat) ──

export const ZeroKnowledgeModule = {
  generateEtkSecret,
  formatAgentToken,
  parseAgentToken,
  isAgentEnclaveToken,
  toBearerCredential,
  splitAgentToken,
  validateAgentTokenInput,
  generateDEK,
  encryptPayload,
  decryptPayload,
  wrapDEK,
  unwrapDEK,
  wrapDekEntry,
  createWrappedDekMap,
  unwrapDekFromMap,
  importAesKey,
  deriveAetWrappingKey,
  validateAetEnvelope,
  getRowWrappedDek,
  unwrapRowDek,
  decryptRowField,
  bytesToBase64,
  base64ToBytes,
  hexToBytes,
  bytesToHex,
  zeroClearBytes,
  withSecretBytes,
};
