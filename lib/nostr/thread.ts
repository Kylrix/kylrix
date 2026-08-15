import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';

const DEFAULT_ENGAGEMENT_RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

function taggedEventIds(event: NostrEvent): string[] {
  return event.tags.filter((t) => t[0] === 'e' && t[1]).map((t) => t[1] as string);
}

function isPositiveReaction(event: NostrEvent): boolean {
  const c = (event.content || '').trim();
  // NIP-25: "+" or "" or heart emoji or thumbs up is positive reaction, "-" is dislike
  return c === '' || c === '+' || c === '❤️' || c === '🤙' || c === '💜' || c === '👍' || c === '🔥' || c === '⚡';
}

function isZapEvent(event: NostrEvent): boolean {
  // NIP-57: kind 9735 is zap receipt
  return event.kind === 9735;
}

export interface NostrEngagementData {
  repliesByRoot: Record<string, NostrEvent[]>;
  reactionsByRoot: Record<string, NostrEvent[]>;
  zapsByRoot: Record<string, NostrEvent[]>;
  repostsByRoot: Record<string, NostrEvent[]>;
  replyCount: Record<string, number>;
  likeCount: Record<string, number>;
  zapCount: Record<string, number>;
  repostCount: Record<string, number>;
}

/**
 * Robust relay pull for replies (kind 1), reposts (kind 6), reactions (kind 7), and zaps (kind 9735) on root event IDs.
 * Totally open Nostr read protocol — no keys or unlock required.
 */
export async function fetchNostrEngagement(
  eventIds: string[],
  timeoutMs = 3500,
): Promise<NostrEngagementData> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  const empty: NostrEngagementData = {
    repliesByRoot: {},
    reactionsByRoot: {},
    zapsByRoot: {},
    repostsByRoot: {},
    replyCount: {},
    likeCount: {},
    zapCount: {},
    repostCount: {},
  };

  if (!ids.length || typeof WebSocket === 'undefined') return empty;

  const repliesByRoot: Record<string, NostrEvent[]> = {};
  const reactionsByRoot: Record<string, NostrEvent[]> = {};
  const zapsByRoot: Record<string, NostrEvent[]> = {};
  const repostsByRoot: Record<string, NostrEvent[]> = {};

  for (const id of ids) {
    repliesByRoot[id] = [];
    reactionsByRoot[id] = [];
    zapsByRoot[id] = [];
    repostsByRoot[id] = [];
  }

  const seen = new Set<string>();
  const pool = new NostrRelayPool(DEFAULT_ENGAGEMENT_RELAYS);
  pool.connect();

  const onEvent = (event: NostrEvent) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);

    // Extract all referenced 'e' tag event IDs (root or reply)
    const roots = taggedEventIds(event).filter((id) => ids.includes(id));
    if (!roots.length) return;

    for (const root of roots) {
      if (event.kind === 1) {
        if (!repliesByRoot[root].some((e) => e.id === event.id)) {
          repliesByRoot[root].push(event);
        }
      } else if (event.kind === 6) {
        // NIP-18 repost
        if (!repostsByRoot[root].some((e) => e.id === event.id)) {
          repostsByRoot[root].push(event);
        }
      } else if (event.kind === 7 && isPositiveReaction(event)) {
        if (!reactionsByRoot[root].some((e) => e.id === event.id)) {
          reactionsByRoot[root].push(event);
        }
      } else if (isZapEvent(event)) {
        // NIP-57 zap receipt
        if (!zapsByRoot[root].some((e) => e.id === event.id)) {
          zapsByRoot[root].push(event);
        }
      }
    }
  };

  pool.addListener(onEvent);
  const subId = `kylrix-eng-${Date.now()}`;
  pool.subscribe(subId, [
    { kinds: [1], '#e': ids, limit: 200 },
    { kinds: [6], '#e': ids, limit: 150 },
    { kinds: [7], '#e': ids, limit: 400 },
    { kinds: [9735], '#e': ids, limit: 150 },
  ]);

  await new Promise((r) => setTimeout(r, timeoutMs));
  pool.unsubscribe(subId);
  pool.removeListener(onEvent);
  pool.close();

  const replyCount: Record<string, number> = {};
  const likeCount: Record<string, number> = {};
  const zapCount: Record<string, number> = {};
  const repostCount: Record<string, number> = {};

  for (const id of ids) {
    repliesByRoot[id].sort((a, b) => a.created_at - b.created_at);
    replyCount[id] = repliesByRoot[id].length;
    likeCount[id] = reactionsByRoot[id].length;
    zapCount[id] = zapsByRoot[id].length;
    repostCount[id] = repostsByRoot[id].length;
  }

  return {
    repliesByRoot,
    reactionsByRoot,
    zapsByRoot,
    repostsByRoot,
    replyCount,
    likeCount,
    zapCount,
    repostCount,
  };
}

export async function fetchNostrThread(eventId: string, timeoutMs = 4000) {
  const result = await fetchNostrEngagement([eventId], timeoutMs);
  return {
    replies: result.repliesByRoot[eventId] || [],
    reactions: result.reactionsByRoot[eventId] || [],
    zaps: result.zapsByRoot[eventId] || [],
    reposts: result.repostsByRoot[eventId] || [],
    replyCount: result.replyCount[eventId] || 0,
    likeCount: result.likeCount[eventId] || 0,
    zapCount: result.zapCount[eventId] || 0,
    repostCount: result.repostCount[eventId] || 0,
  };
}

/** Fetch a single Nostr event by ID from relays (for parent context in reply/reaction views). */
export async function fetchNostrEventById(
  eventId: string,
  timeoutMs = 3000,
): Promise<NostrEvent | null> {
  if (!eventId || typeof WebSocket === 'undefined') return null;
  return new Promise((resolve) => {
    let found: NostrEvent | null = null;
    const pool = new NostrRelayPool(DEFAULT_ENGAGEMENT_RELAYS);
    pool.connect();
    const timer = setTimeout(() => {
      pool.unsubscribe('single-fetch');
      pool.close();
      resolve(found);
    }, timeoutMs);
    pool.addListener((ev) => {
      if (ev.id === eventId && !found) {
        found = ev;
        clearTimeout(timer);
        pool.unsubscribe('single-fetch');
        pool.close();
        resolve(found);
      }
    });
    pool.subscribe('single-fetch', [{ ids: [eventId], limit: 1 }]);
  });
}

