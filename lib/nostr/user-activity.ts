import { NostrRelayPool, signEvent, type NostrEvent } from '@/lib/nostr/nostr';
import { bytesToHex, normalizePrivateKeyBytes } from '@/lib/nostr/crypto';
import { getNostrWriteRelays } from '@/lib/connect/feed-settings';
import * as secp256k1 from '@noble/secp256k1';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

const FALLBACK_WRITE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
];

function isPositiveReaction(event: NostrEvent): boolean {
  const c = (event.content || '').trim();
  return c === '' || c === '+' || c === '❤️' || c === '🤙' || c === '💜' || c === '👍' || c === '🔥' || c === '⚡';
}

function isReplyEvent(event: NostrEvent): boolean {
  return event.kind === 1 && event.tags.some((t) => t[0] === 'e' && t[1]);
}

async function queryRelays(
  filters: Record<string, unknown>[],
  timeoutMs = 4000,
): Promise<NostrEvent[]> {
  if (typeof WebSocket === 'undefined') return [];

  const byId = new Map<string, NostrEvent>();
  const pool = new NostrRelayPool(DEFAULT_RELAYS);
  const onEvent = (event: NostrEvent) => {
    if (!byId.has(event.id)) byId.set(event.id, event);
  };

  pool.addListener(onEvent);
  pool.connect();
  await new Promise((r) => setTimeout(r, 350));
  const subId = `kylrix-user-act-${Date.now()}`;
  pool.subscribe(subId, filters);
  await new Promise((r) => setTimeout(r, timeoutMs));
  pool.unsubscribe(subId);
  pool.removeListener(onEvent);
  pool.close();

  return Array.from(byId.values());
}

/** Kind-1 notes from the user that reference another event (replies). */
export async function fetchNostrUserReplies(pubkeyHex: string, timeoutMs = 4000): Promise<NostrEvent[]> {
  const hex = String(pubkeyHex || '').trim();
  if (!hex) return [];
  const events = await queryRelays([{ kinds: [1], authors: [hex], limit: 120 }], timeoutMs);
  return events.filter(isReplyEvent).sort((a, b) => b.created_at - a.created_at);
}

/** Kind-7 positive reactions from the user. */
export async function fetchNostrUserReactions(pubkeyHex: string, timeoutMs = 4000): Promise<NostrEvent[]> {
  const hex = String(pubkeyHex || '').trim();
  if (!hex) return [];
  const events = await queryRelays([{ kinds: [7], authors: [hex], limit: 120 }], timeoutMs);
  return events.filter(isPositiveReaction).sort((a, b) => b.created_at - a.created_at);
}

/** Batch-fetch root events for liked posts / bookmark resolution. */
export async function fetchNostrEventsByIds(
  eventIds: string[],
  timeoutMs = 3500,
): Promise<Map<string, NostrEvent>> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  const out = new Map<string, NostrEvent>();
  if (!ids.length) return out;

  const chunkSize = 40;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const events = await queryRelays([{ ids: chunk, limit: chunk.length }], timeoutMs);
    for (const event of events) out.set(event.id, event);
  }
  return out;
}

export function rootEventIdFromTags(event: NostrEvent): string | null {
  const eTag = event.tags.find((t) => t[0] === 'e' && t[1]);
  return eTag ? String(eTag[1]) : null;
}

/** Fetch users who follow the given pubkey (Kind-3 contact list events with #p: [pubkeyHex]). */
export async function fetchNostrFollowers(
  pubkeyHex: string,
  timeoutMs = 4500,
): Promise<{ pubkey: string; createdAt: number }[]> {
  const hex = String(pubkeyHex || '').trim().toLowerCase();
  if (!hex) return [];

  const events = await queryRelays(
    [
      {
        kinds: [3],
        '#p': [hex],
        limit: 250,
      },
    ],
    timeoutMs,
  );

  // Group by author, keeping the latest contact list event per follower
  const latestByAuthor = new Map<string, number>();
  for (const ev of events) {
    if (!ev.pubkey || ev.pubkey === hex) continue;
    const prev = latestByAuthor.get(ev.pubkey);
    if (!prev || ev.created_at > prev) {
      // Ensure the tag #p still contains the user's pubkey
      const hasTarget = ev.tags.some((t) => t[0] === 'p' && t[1]?.toLowerCase() === hex);
      if (hasTarget) {
        latestByAuthor.set(ev.pubkey, ev.created_at);
      } else {
        latestByAuthor.delete(ev.pubkey);
      }
    }
  }

  return Array.from(latestByAuthor.entries()).map(([pubkey, createdAt]) => ({
    pubkey,
    createdAt,
  }));
}

/** Fetch users that the given pubkey follows (Kind-3 contact list from the user). */
export async function fetchNostrFollowing(
  pubkeyHex: string,
  timeoutMs = 4000,
): Promise<string[]> {
  const hex = String(pubkeyHex || '').trim().toLowerCase();
  if (!hex) return [];

  const events = await queryRelays([{ kinds: [3], authors: [hex], limit: 5 }], timeoutMs);
  if (!events.length) return [];

  // Get most recent contact list event
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
  const followingPubkeys = latest.tags
    .filter((t) => t[0] === 'p' && t[1])
    .map((t) => t[1].toLowerCase());

  return Array.from(new Set(followingPubkeys));
}

/** Publish a Nostr Kind-3 contact list (follow list) event. */
export async function publishNostrContactList(
  privBytesInput: Uint8Array | Record<string, number> | any,
  followingPubkeys: string[],
): Promise<void> {
  const privBytes = normalizePrivateKeyBytes(privBytesInput);
  if (!privBytes) throw new Error('Valid private key required to publish Nostr follow list');

  const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(privBytes));
  const uniqueFollowing = Array.from(new Set(followingPubkeys.map((p) => p.toLowerCase())));
  const tags: string[][] = uniqueFollowing.map((p) => ['p', p, '', '']);

  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 3,
    tags,
    content: '',
  };

  const signed = signEvent(unsigned, privBytes);
  const configured = await getNostrWriteRelays().catch(() => []);
  const writeRelays = Array.from(new Set([...FALLBACK_WRITE_RELAYS, ...configured]));
  const pool = new NostrRelayPool(writeRelays);
  await pool.publishAndClose(signed);
}

/** Toggle follow status for a given target pubkey on Nostr and sync local cache. */
export async function toggleNostrFollow(
  targetPubkeyHex: string,
  shouldFollow: boolean,
  privBytesInput: Uint8Array | Record<string, number> | any,
): Promise<{ success: boolean; following: boolean; followingCount: number }> {
  const privBytes = normalizePrivateKeyBytes(privBytesInput);
  if (!privBytes) throw new Error('Unlock vault to follow or unfollow on Nostr');

  const userPubkey = bytesToHex(secp256k1.schnorr.getPublicKey(privBytes));
  const targetHex = targetPubkeyHex.trim().toLowerCase();
  if (!targetHex) throw new Error('Invalid target pubkey');

  const currentFollowing = await fetchNostrFollowing(userPubkey, 3500);
  let updatedFollowing: string[];

  if (shouldFollow) {
    if (currentFollowing.includes(targetHex)) {
      updatedFollowing = currentFollowing;
    } else {
      updatedFollowing = [...currentFollowing, targetHex];
    }
  } else {
    updatedFollowing = currentFollowing.filter((p) => p.toLowerCase() !== targetHex);
  }

  await publishNostrContactList(privBytes, updatedFollowing);

  // Sync with LocalEngine cache
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    await LocalEngine.cacheSet('kylrix:follows', updatedFollowing);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: updatedFollowing }));
    }
  } catch {}

  return {
    success: true,
    following: shouldFollow,
    followingCount: updatedFollowing.length,
  };
}
