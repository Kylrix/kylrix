import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
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
