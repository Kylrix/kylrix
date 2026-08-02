import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';

const RELAYS = [
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
  return c === '' || c === '+' || c === '❤️' || c === '🤙' || c === '💜';
}

/**
 * One-shot relay pull for replies (kind 1) and reactions (kind 7) on root event ids.
 */
export async function fetchNostrEngagement(
  eventIds: string[],
  timeoutMs = 3500,
): Promise<{
  repliesByRoot: Record<string, NostrEvent[]>;
  reactionsByRoot: Record<string, NostrEvent[]>;
  replyCount: Record<string, number>;
  likeCount: Record<string, number>;
}> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  const empty = {
    repliesByRoot: {} as Record<string, NostrEvent[]>,
    reactionsByRoot: {} as Record<string, NostrEvent[]>,
    replyCount: {} as Record<string, number>,
    likeCount: {} as Record<string, number>,
  };
  if (!ids.length || typeof window === 'undefined') return empty;

  const repliesByRoot: Record<string, NostrEvent[]> = {};
  const reactionsByRoot: Record<string, NostrEvent[]> = {};
  for (const id of ids) {
    repliesByRoot[id] = [];
    reactionsByRoot[id] = [];
  }

  const seen = new Set<string>();
  const pool = new NostrRelayPool(RELAYS);
  pool.connect();

  const onEvent = (event: NostrEvent) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    const roots = taggedEventIds(event).filter((id) => ids.includes(id));
    if (!roots.length) return;
    for (const root of roots) {
      if (event.kind === 1) {
        if (!repliesByRoot[root].some((e) => e.id === event.id)) {
          repliesByRoot[root].push(event);
        }
      } else if (event.kind === 7 && isPositiveReaction(event)) {
        if (!reactionsByRoot[root].some((e) => e.id === event.id)) {
          reactionsByRoot[root].push(event);
        }
      }
    }
  };

  pool.addListener(onEvent);
  const subId = `kylrix-thread-${Date.now()}`;
  pool.subscribe(subId, [
    { kinds: [1], '#e': ids, limit: 200 },
    { kinds: [7], '#e': ids, limit: 400 },
  ]);

  await new Promise((r) => setTimeout(r, timeoutMs));
  pool.unsubscribe(subId);
  pool.removeListener(onEvent);
  pool.close();

  const replyCount: Record<string, number> = {};
  const likeCount: Record<string, number> = {};
  for (const id of ids) {
    repliesByRoot[id].sort((a, b) => a.created_at - b.created_at);
    replyCount[id] = repliesByRoot[id].length;
    likeCount[id] = reactionsByRoot[id].length;
  }

  return { repliesByRoot, reactionsByRoot, replyCount, likeCount };
}

export async function fetchNostrThread(eventId: string, timeoutMs = 4000) {
  const result = await fetchNostrEngagement([eventId], timeoutMs);
  return {
    replies: result.repliesByRoot[eventId] || [],
    reactions: result.reactionsByRoot[eventId] || [],
    replyCount: result.replyCount[eventId] || 0,
    likeCount: result.likeCount[eventId] || 0,
  };
}
