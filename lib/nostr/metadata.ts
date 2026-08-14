'use client';

/**
 * Nostr Profile Metadata Substrate (NIP-01 kind:0)
 *
 * Fetches, caches, and indexes human-readable Nostr metadata (name, display_name,
 * nip05, picture/avatar, about) by hex pubkey / npub.
 * Stores in LocalEngine / IndexedDB to avoid repeated socket spam.
 */

import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { bytesToNpub, hexToBytes, npubToBytes, bytesToHex } from '@/lib/nostr/crypto';

export interface NostrProfileMetadata {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  username?: string;
  nip05?: string;
  picture?: string;
  about?: string;
  banner?: string;
  updatedAt: number;
}

const MEMORY_PROFILES = new Map<string, NostrProfileMetadata>();
const PENDING_PUBKEYS = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const DIRECTORY_RELAYS = [
  'wss://purplepag.es',
  'wss://user.kindpag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

const CACHE_PREFIX = 'nostr_profile_';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function getCachedNostrProfile(pubkeyOrNpub: string): NostrProfileMetadata | null {
  const clean = String(pubkeyOrNpub || '').trim();
  if (!clean) return null;
  return MEMORY_PROFILES.get(clean) || null;
}

export function formatNostrAuthorName(pubkey: string, npubFallback?: string): string {
  const prof = getCachedNostrProfile(pubkey);
  if (prof) {
    if (prof.displayName) return prof.displayName;
    if (prof.name) return prof.name;
    if (prof.nip05) return prof.nip05.split('@')[0] || prof.nip05;
  }
  const target = npubFallback || pubkey;
  if (target.startsWith('npub')) return `npub…${target.slice(-8)}`;
  return `npub…${target.slice(-8)}`;
}

/**
 * Asynchronously batches pubkeys and queries kind:0 metadata from directory indexers.
 */
export async function queueNostrProfileFetch(pubkeys: string[]): Promise<void> {
  for (const raw of pubkeys) {
    let hex = raw.trim();
    if (!hex) continue;
    if (hex.startsWith('npub')) {
      try {
        hex = bytesToHex(npubToBytes(hex));
      } catch {
        continue;
      }
    }
    if (MEMORY_PROFILES.has(hex)) continue;
    PENDING_PUBKEYS.add(hex);
  }

  if (!PENDING_PUBKEYS.size) return;
  if (batchTimer) return;

  batchTimer = setTimeout(() => {
    batchTimer = null;
    void flushPendingMetadata();
  }, 300);
}

async function flushPendingMetadata(): Promise<void> {
  const batch = Array.from(PENDING_PUBKEYS).slice(0, 50);
  for (const pk of batch) PENDING_PUBKEYS.delete(pk);
  if (!batch.length) return;

  // 1. Check LocalEngine cache first
  const missing: string[] = [];
  for (const pk of batch) {
    try {
      const cached = await LocalEngine.cacheGet<NostrProfileMetadata>(`${CACHE_PREFIX}${pk}`, MAX_CACHE_AGE_MS);
      if (cached) {
        MEMORY_PROFILES.set(pk, cached);
        if (cached.npub) MEMORY_PROFILES.set(cached.npub, cached);
      } else {
        missing.push(pk);
      }
    } catch {
      missing.push(pk);
    }
  }

  if (!missing.length) return;

  // 2. Query kind 0 metadata from fast directory relays
  try {
    const pool = new NostrRelayPool(DIRECTORY_RELAYS);
    const byPubkey = new Map<string, NostrEvent>();

    const onEvent = (event: NostrEvent) => {
      if (event.kind === 0 && missing.includes(event.pubkey)) {
        const existing = byPubkey.get(event.pubkey);
        if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
          byPubkey.set(event.pubkey, event);
        }
      }
    };

    pool.addListener(onEvent);
    pool.connect();

    const subId = `meta-sub-${Date.now()}`;
    pool.subscribe(subId, [{ kinds: [0], authors: missing, limit: missing.length }]);

    await new Promise((r) => setTimeout(r, 2200));

    pool.unsubscribe(subId);
    pool.removeListener(onEvent);
    pool.close();

    // 3. Parse and cache resolved metadata
    for (const [pk, event] of byPubkey.entries()) {
      try {
        const data = JSON.parse(event.content || '{}');
        const npub = bytesToNpub(hexToBytes(pk));
        const record: NostrProfileMetadata = {
          pubkey: pk,
          npub,
          name: data.name || data.username,
          displayName: data.display_name || data.name,
          username: data.nip05 || data.name || data.username,
          nip05: data.nip05,
          picture: data.picture || data.image || data.avatar,
          about: data.about,
          banner: data.banner,
          updatedAt: (event.created_at || 0) * 1000,
        };

        MEMORY_PROFILES.set(pk, record);
        MEMORY_PROFILES.set(npub, record);
        void LocalEngine.cacheSet(`${CACHE_PREFIX}${pk}`, record);
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix-nostr-metadata-updated'));
    }
  } catch (err) {
    console.warn('[NostrMetadata] batch resolve error:', err);
  }
}
