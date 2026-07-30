import type { TendonEnvelope } from "./types";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

export function encodeEnvelope(envelope: TendonEnvelope): string {
  const jsonStr = JSON.stringify(envelope);
  const bytes = new TextEncoder().encode(jsonStr);
  return toBase64(bytes);
}

export function decodeEnvelope(contentBase64: string): TendonEnvelope | null {
  try {
    const bytes = fromBase64(contentBase64);
    if (bytes.length === 0) return null;
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr) as TendonEnvelope;
  } catch {
    return null;
  }
}
