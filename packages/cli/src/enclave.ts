// Client-side AET enclave: fetches the token's envelope, holds the unlock key
// (etkSecret) as zeroable bytes, and unwraps per-Row DEKs locally. The server
// never sees the unlock part in this mode.

import {
  type AetEnvelope,
  type AetResourceKey,
  base64ToBytes,
  parseAgentToken,
  unwrapDekFromMap,
  validateAetEnvelope,
  zeroClearBytes,
} from '@/lib/security/zero-knowledge';
import { getClient } from './client';
import { resolveEnvironment } from './config';

export interface OpenEnclave {
  bearer: string;
  envelope: AetEnvelope;
  scopes: string[];
  expiresAt: string | null;
  /** Unwraps one DEK; caller must zeroClearBytes() the result. */
  unlockDek(key: AetResourceKey): Promise<Uint8Array | null>;
  /** Zeroes etkSecret and salt. Idempotent. */
  close(): void;
}

export async function openEnclave(
  rawToken: string,
  opts: { url?: string } = {}
): Promise<OpenEnclave> {
  const parsed = parseAgentToken(rawToken); // throws ZeroKnowledgeError
  const env = resolveEnvironment({ url: opts.url });
  assertSecureTransport(env.apiUrl);
  const client = getClient({ url: opts.url, token: parsed.bearer });
  const info = await client.auth.enclave(); // GET /api/v1/token/enclave
  const envelope = validateAetEnvelope(info.envelope);
  const salt = base64ToBytes(envelope.salt);
  let closed = false;
  return {
    bearer: parsed.bearer,
    envelope,
    scopes: info.scopes || [],
    expiresAt: info.expiresAt || null,
    unlockDek: (key) => unwrapDekFromMap(envelope.deks, key, parsed.etkSecret, salt),
    close: () => {
      if (closed) return;
      closed = true;
      zeroClearBytes(parsed.etkSecret);
      zeroClearBytes(salt);
    },
  };
}

export function assertSecureTransport(apiUrl: string) {
  const u = new URL(apiUrl);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) {
    throw new Error('Agent keys can only be used over a secure (https) connection.');
  }
}
