/**
 * Blossom (Blob Storage for Nostr) & Media Upload Substrate
 * Standard: Blossom (SHA-256 Content-Addressed Blobs) with NIP-98 Auth
 * Fallback: NIP-96 (nostr.build)
 */

import { signEvent } from '@/lib/nostr/nostr';
import { bytesToHex } from '@/lib/nostr/crypto';
import { sha256 } from '@noble/hashes/sha2.js';

export const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.primal.net',
  'https://cdn.satellite.earth',
  'https://nostr.download',
];

export const DEFAULT_NIP96_SERVERS = [
  'https://nostr.build/api/v2/nip96/upload',
  'https://void.cat/d/',
];

export interface MediaUploadResult {
  url: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  dim?: string;
  blurhash?: string;
  thumbUrl?: string;
  serverType: 'blossom' | 'nip96';
}

/**
 * Generate NIP-98 HTTP Authorization header for Nostr media servers.
 * Kind 27235 ephemeral event containing URL and HTTP method.
 */
export function createNip98AuthHeader(opts: {
  url: string;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  privateKeyBytes: Uint8Array;
  payloadSha256?: string;
}): string {
  const tags: string[][] = [
    ['u', opts.url],
    ['method', opts.method],
  ];

  if (opts.payloadSha256) {
    tags.push(['payload', opts.payloadSha256]);
  }

  const unsigned = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  };

  const signed = signEvent(unsigned, opts.privateKeyBytes);
  const base64Event = btoa(JSON.stringify(signed));
  return `Nostr ${base64Event}`;
}

/**
 * Upload a media file to a Blossom server (preferred standard).
 * Content-addressed, decentralized blob storage.
 */
export async function uploadToBlossom(
  file: File | Blob,
  privateKeyBytes: Uint8Array,
  serverUrl = DEFAULT_BLOSSOM_SERVERS[0]
): Promise<MediaUploadResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hashBytes = sha256(bytes);
  const hashHex = bytesToHex(hashBytes);

  const endpoint = `${serverUrl.replace(/\/$/, '')}/upload`;
  const authHeader = createNip98AuthHeader({
    url: endpoint,
    method: 'PUT',
    privateKeyBytes,
    payloadSha256: hashHex,
  });

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      Authorization: authHeader,
    },
    body: bytes,
  });

  if (!response.ok) {
    throw new Error(`Blossom upload failed with status ${response.status}`);
  }

  const json = await response.json().catch(() => ({}));
  const blobUrl = json.url || `${serverUrl.replace(/\/$/, '')}/${hashHex}`;

  return {
    url: blobUrl,
    sha256: hashHex,
    sizeBytes: file.size,
    mimeType: file.type || 'image/jpeg',
    dim: json.dim,
    blurhash: json.blurhash,
    thumbUrl: json.thumb || blobUrl,
    serverType: 'blossom',
  };
}
