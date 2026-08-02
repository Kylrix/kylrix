/**
 * Server-side one-shot Nostr relay queries (Node WebSocket).
 * Browser feed/thread helpers stay in thread.ts / useNostrFeed.
 */

import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';

const RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

const FILTER_TAGS = [
  'sovereignengineering',
  'localfirst',
  'linux',
  'openbuidl',
  'nostr',
  'bitcoin',
];

async function queryRelays(
  filters: Record<string, unknown>[],
  timeoutMs = 4000,
): Promise<NostrEvent[]> {
  const pool = new NostrRelayPool(RELAYS);
  const byId = new Map<string, NostrEvent>();
  const onEvent = (event: NostrEvent) => {
    if (!byId.has(event.id)) byId.set(event.id, event);
  };
  pool.addListener(onEvent);
  pool.connect();
  // Give sockets a beat to open before REQ
  await new Promise((r) => setTimeout(r, 400));
  const subId = `kylrix-api-${Date.now()}`;
  pool.subscribe(subId, filters);
  await new Promise((r) => setTimeout(r, timeoutMs));
  pool.unsubscribe(subId);
  pool.removeListener(onEvent);
  pool.close();
  return Array.from(byId.values());
}

export async function fetchNostrEventById(
  eventId: string,
  timeoutMs = 4000,
): Promise<NostrEvent | null> {
  const id = String(eventId || '').trim();
  if (!id) return null;
  const events = await queryRelays([{ ids: [id], limit: 1 }], timeoutMs);
  return events[0] || null;
}

export async function fetchNostrReplies(
  eventId: string,
  timeoutMs = 4000,
): Promise<{ replies: NostrEvent[]; likeCount: number }> {
  const id = String(eventId || '').trim();
  if (!id) return { replies: [], likeCount: 0 };
  const events = await queryRelays(
    [
      { kinds: [1], '#e': [id], limit: 200 },
      { kinds: [7], '#e': [id], limit: 400 },
    ],
    timeoutMs,
  );
  const replies = events
    .filter((e) => e.kind === 1)
    .sort((a, b) => a.created_at - b.created_at);
  const likeCount = events.filter((e) => {
    if (e.kind !== 7) return false;
    const c = (e.content || '').trim();
    return c === '' || c === '+' || c === '❤️' || c === '🤙' || c === '💜';
  }).length;
  return { replies, likeCount };
}

export async function fetchNostrFeed(limit = 40, timeoutMs = 4500): Promise<NostrEvent[]> {
  const events = await queryRelays(
    [
      {
        kinds: [1],
        '#t': FILTER_TAGS,
        limit: Math.min(100, Math.max(1, limit)),
      },
    ],
    timeoutMs,
  );
  return events
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, Math.min(100, Math.max(1, limit)));
}
