// Server-assisted AET unlock (opt-in header mode). The etkSecret lives only in
// this WeakMap keyed by the ApiActor object — it can never be serialized into
// JSON responses, error bodies, or logs — and is zeroed when the request ends.
// This mode is a documented trade-off, not zero-knowledge.

import {
  type AetEnvelope,
  type AetResourceKey,
  decryptRowField,
  unwrapDekFromMap,
  zeroClearBytes,
} from './zero-knowledge';

export interface EnclaveContext {
  etkSecret: Uint8Array;
  salt: Uint8Array;
  envelope: AetEnvelope;
  issued: Uint8Array[]; // every DEK handed out, zeroed on release
}

const enclaves = new WeakMap<object, EnclaveContext>();

export function attachEnclave(actor: object, ctx: Omit<EnclaveContext, 'issued'>) {
  enclaves.set(actor, { ...ctx, issued: [] });
}

export function getEnclave(actor: object): EnclaveContext | undefined {
  return enclaves.get(actor);
}

export function releaseEnclave(actor: object) {
  const ctx = enclaves.get(actor);
  if (!ctx) return;
  zeroClearBytes(ctx.etkSecret);
  zeroClearBytes(ctx.salt);
  ctx.issued.forEach(zeroClearBytes);
  ctx.issued.length = 0;
  enclaves.delete(actor);
}

/**
 * Unwraps the Row's DEK through the enclave and decrypts the listed fields.
 * Returns null when the Row is not granted or its entry fails to open — callers
 * treat it as a locked item, never as a request error.
 */
export async function unsealRowWithEnclave(
  ctx: EnclaveContext,
  key: AetResourceKey,
  row: Record<string, unknown>,
  fields: readonly string[]
): Promise<Record<string, string | null> | null> {
  try {
    const dek = await unwrapDekFromMap(ctx.envelope.deks, key, ctx.etkSecret, ctx.salt);
    if (!dek) return null;
    ctx.issued.push(dek);
    const out: Record<string, string | null> = {};
    for (const f of fields) {
      const v = row[f];
      out[f] = typeof v === 'string' && v.trim() ? await decryptRowField(v, dek) : null;
    }
    return out;
  } catch {
    return null;
  }
}
