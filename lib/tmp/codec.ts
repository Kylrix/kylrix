import type { TendonEnvelope } from "./types";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export function encodeEnvelope(envelope: TendonEnvelope): string {
  const jsonStr = JSON.stringify(envelope);
  const bytes = new TextEncoder().encode(jsonStr);
  return toBase64(bytes);
}

export function decodeEnvelope(contentBase64: string): TendonEnvelope | null {
  try {
    const bytes = fromBase64(contentBase64);
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr) as TendonEnvelope;
  } catch {
    return null;
  }
}
