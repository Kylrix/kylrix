import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { NostrRelayPool, signEvent, type NostrEvent } from './nostr';
import { bytesToHex, hexToBytes, bytesToNpub, npubToBytes, nsecToBytes, normalizePrivateKeyBytes } from './crypto';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

// Configure secp256k1
secp256k1.hashes.sha256 = (message) => sha256(message);

export interface NostrDirectMessage {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  createdAt: number;
  content: string;
  decryptedText?: string;
  isOutgoing: boolean;
}

export interface NostrDMConversation {
  id: string;
  peerPubkey: string;
  peerNpub: string;
  lastMessageText: string;
  lastMessageAt: string;
  messages: NostrDirectMessage[];
}

const DEFAULT_DM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.primal.net',
];

/**
 * Retrieves current active Nostr keypair for logged in user.
 */
export async function getActiveNostrKeyPair(): Promise<{
  npub: string;
  pubkeyHex: string;
  privateKeyBytes: Uint8Array | null;
} | null> {
  // 1. Try LocalEngine cache
  try {
    const cached = await LocalEngine.cacheGet<any>('nostr:active_identity');
    if (cached?.npub && cached?.pubkey) {
      let privBytes: Uint8Array | null = null;
      if (cached.nsec) {
        try { privBytes = nsecToBytes(cached.nsec); } catch {}
      } else if (cached.privateKeyHex) {
        try { privBytes = hexToBytes(cached.privateKeyHex); } catch {}
      }
      return {
        npub: cached.npub,
        pubkeyHex: cached.pubkey,
        privateKeyBytes: privBytes,
      };
    }
  } catch {}

  // 2. Try Appwrite Nostr Identity row for user
  try {
    const { getNostrIdentityAction } = await import('@/lib/actions/secure-ops/nostr');
    const row = await getNostrIdentityAction();
    if (row?.npub) {
      let pubkeyHex = '';
      try { pubkeyHex = bytesToHex(npubToBytes(row.npub)); } catch {}
      let privBytes: Uint8Array | null = null;

      if (row.encryptedNsec && ecosystemSecurity.status.isUnlocked) {
        try {
          const decryptedNsec = await ecosystemSecurity.decrypt(row.encryptedNsec);
          privBytes = normalizePrivateKeyBytes(decryptedNsec);
        } catch {}
      }

      return {
        npub: row.npub,
        pubkeyHex,
        privateKeyBytes: privBytes,
      };
    }
  } catch {}

  return null;
}

/**
 * Computes NIP-04 ECDH shared secret (32 bytes x-coordinate) between private key and public key.
 */
export function getEcdhSharedSecret(privKey: Uint8Array | string, pubKeyHex: string): Uint8Array {
  const priv = typeof privKey === 'string' ? hexToBytes(privKey) : privKey;
  let hexPub = pubKeyHex.trim().replace(/^npub/, '');
  if (hexPub.length !== 64) {
    try {
      hexPub = bytesToHex(npubToBytes(pubKeyHex));
    } catch {
      /* fallback */
    }
  }

  // Prepend 02 compressed header for x-only pubkey
  const fullPubKeyHex = hexPub.length === 64 ? '02' + hexPub : hexPub;
  const pubBytes = hexToBytes(fullPubKeyHex);
  const sharedPoint = secp256k1.getSharedSecret(priv, pubBytes, true);
  return sharedPoint.slice(1, 33);
}

/**
 * Helper to convert Uint8Array / Buffer / ArrayBuffer to base64 string across environments.
 */
function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to convert base64 string to Uint8Array across environments.
 */
function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * NIP-04 AES-256-CBC Encryption using WebCrypto API / Node Crypto.
 */
export async function encryptNip04(
  text: string,
  privKey: Uint8Array | string,
  recipientPubkeyHex: string
): Promise<string> {
  const sharedSecret = getEcdhSharedSecret(privKey, recipientPubkeyHex);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encodedText = new TextEncoder().encode(text);

  if (crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      sharedSecret as BufferSource,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );
    const encryptedBuf = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      encodedText as BufferSource
    );
    const ciphertextBase64 = toBase64(new Uint8Array(encryptedBuf));
    const ivBase64 = toBase64(iv);
    return `${ciphertextBase64}?iv=${ivBase64}`;
  }

  throw new Error('WebCrypto API unavailable for AES-CBC encryption');
}

/**
 * NIP-04 AES-256-CBC Decryption using WebCrypto API / Node Crypto.
 */
export async function decryptNip04(
  content: string,
  privKey: Uint8Array | string,
  counterpartyPubkeyHex: string
): Promise<string> {
  if (!content || !content.includes('?iv=')) {
    return content;
  }

  const [ciphertextBase64, ivBase64] = content.split('?iv=');
  if (!ciphertextBase64 || !ivBase64) return content;

  const sharedSecret = getEcdhSharedSecret(privKey, counterpartyPubkeyHex);
  const ciphertext = fromBase64(ciphertextBase64);
  const iv = fromBase64(ivBase64);

  if (crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      sharedSecret as BufferSource,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return new TextDecoder().decode(decryptedBuf);
  }

  throw new Error('WebCrypto API unavailable for AES-CBC decryption');
}

/**
 * Sends a NIP-04 direct message via Nostr relays.
 */
export async function sendNostrDirectMessage(params: {
  senderPrivateKey: Uint8Array | string;
  senderPubkeyHex: string;
  recipientPubkeyHex: string;
  text: string;
  relays?: string[];
}): Promise<NostrEvent> {
  const { senderPrivateKey, senderPubkeyHex, recipientPubkeyHex, text, relays = DEFAULT_DM_RELAYS } = params;

  let cleanRecipient = recipientPubkeyHex.trim();
  if (cleanRecipient.startsWith('npub')) {
    cleanRecipient = bytesToHex(npubToBytes(cleanRecipient));
  }

  const privBytes = typeof senderPrivateKey === 'string' ? hexToBytes(senderPrivateKey) : senderPrivateKey;
  const encryptedContent = await encryptNip04(text, privBytes, cleanRecipient);

  const eventPayload = {
    pubkey: senderPubkeyHex,
    created_at: Math.floor(Date.now() / 1000),
    kind: 4,
    tags: [['p', cleanRecipient]],
    content: encryptedContent,
  };

  const signedEvent = signEvent(eventPayload, privBytes);

  const pool = new NostrRelayPool(relays);
  await pool.publishAndClose(signedEvent);

  return signedEvent;
}

/**
 * Fetches Nostr DMs (kind 4) for a Nostr public key from relays.
 */
export async function fetchNostrDirectMessages(params: {
  myPubkeyHex: string;
  myPrivateKey?: Uint8Array | string | null;
  relays?: string[];
  timeoutMs?: number;
}): Promise<NostrDMConversation[]> {
  const { myPubkeyHex, myPrivateKey, relays = DEFAULT_DM_RELAYS, timeoutMs = 3500 } = params;

  let cleanMyPub = myPubkeyHex.trim();
  if (cleanMyPub.startsWith('npub')) {
    cleanMyPub = bytesToHex(npubToBytes(cleanMyPub));
  }

  const pool = new NostrRelayPool(relays);
  const eventsById = new Map<string, NostrEvent>();

  const onEvent = (event: NostrEvent) => {
    if (event.kind === 4 && !eventsById.has(event.id)) {
      eventsById.set(event.id, event);
    }
  };

  pool.addListener(onEvent);
  pool.connect();

  await new Promise((r) => setTimeout(r, 300));

  const subId = `dms-${Date.now()}`;
  pool.subscribe(subId, [
    { kinds: [4], '#p': [cleanMyPub], limit: 100 },
    { kinds: [4], authors: [cleanMyPub], limit: 100 },
  ]);

  await new Promise((r) => setTimeout(r, timeoutMs));

  pool.unsubscribe(subId);
  pool.removeListener(onEvent);
  pool.close();

  const events = Array.from(eventsById.values()).sort((a, b) => a.created_at - b.created_at);

  const conversationsByPeer = new Map<string, NostrDirectMessage[]>();

  for (const event of events) {
    const isOutgoing = event.pubkey === cleanMyPub;
    const recipientTag = event.tags.find((t) => t[0] === 'p')?.[1];
    const peerPubkey = isOutgoing ? recipientTag : event.pubkey;

    if (!peerPubkey) continue;

    let decryptedText = event.content;
    if (myPrivateKey && event.content.includes('?iv=')) {
      try {
        decryptedText = await decryptNip04(event.content, myPrivateKey, peerPubkey);
      } catch {
        decryptedText = '[Encrypted Nostr Message]';
      }
    }

    const dm: NostrDirectMessage = {
      id: event.id,
      senderPubkey: event.pubkey,
      recipientPubkey: recipientTag || '',
      createdAt: event.created_at * 1000,
      content: event.content,
      decryptedText,
      isOutgoing,
    };

    if (!conversationsByPeer.has(peerPubkey)) {
      conversationsByPeer.set(peerPubkey, []);
    }
    conversationsByPeer.get(peerPubkey)!.push(dm);
  }

  const conversations: NostrDMConversation[] = [];

  for (const [peerPubkey, msgs] of conversationsByPeer.entries()) {
    const lastMsg = msgs[msgs.length - 1];
    let peerNpub = peerPubkey;
    try {
      peerNpub = bytesToNpub(hexToBytes(peerPubkey));
    } catch {}

    conversations.push({
      id: `nostr_dm_${peerPubkey}`,
      peerPubkey,
      peerNpub,
      lastMessageText: lastMsg?.decryptedText || lastMsg?.content || 'Direct Message',
      lastMessageAt: new Date(lastMsg?.createdAt || Date.now()).toISOString(),
      messages: msgs,
    });
  }

  return conversations.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}
