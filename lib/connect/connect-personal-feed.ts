import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import { bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
import { getCachedNostrProfile } from '@/lib/nostr/metadata';
import {
  fetchNostrEventsByIds,
  fetchNostrUserReactions,
  fetchNostrUserReplies,
  rootEventIdFromTags,
} from '@/lib/nostr/user-activity';
import type { NostrEvent } from '@/lib/nostr/nostr';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import type { BookmarkIndexEntry } from '@/lib/chat/bookmark-to-self-chat';
import { BOOKMARKS_INDEX_CACHE } from '@/lib/chat/bookmark-to-self-chat';

export type PersonalConnectTab = 'replies' | 'likes' | 'bookmarks';

export const PERSONAL_TAB_CACHE: Record<PersonalConnectTab, string> = {
  replies: 'f_connect_replies',
  likes: 'f_connect_likes',
  bookmarks: 'f_connect_bookmarks',
};

const UNIFIED_CACHE = 'f_unified_moments_feed';
const MOMENTS_CACHE = 'f_moments_list';
const MAX_ITEMS = 200;
const PAGE_SIZE = 16;

const memoryByTab: Partial<Record<PersonalConnectTab, UnifiedFeedItem[]>> = {};

export function peekPersonalTabMemory(tab: PersonalConnectTab): UnifiedFeedItem[] | null {
  return memoryByTab[tab] ? [...memoryByTab[tab]!] : null;
}

export function persistPersonalTab(tab: PersonalConnectTab, rows: UnifiedFeedItem[]) {
  const sliced = rows.slice(0, MAX_ITEMS);
  memoryByTab[tab] = sliced;
  void LocalEngine.cacheSet(PERSONAL_TAB_CACHE[tab], sliced);
}

export function ecoMomentToFeedItem(m: any, opts?: { isLiked?: boolean; createdAtOverride?: number }): UnifiedFeedItem {
  const rawDateStr = m.createdAt || m.$createdAt;
  const createdAtMs = opts?.createdAtOverride ?? (rawDateStr ? new Date(rawDateStr).getTime() : 0);
  return {
    id: `eco_${m.$id || m.id}`,
    source: 'ecosystem',
    authorName: m.userName || m.user?.name || m.username || 'You',
    authorUsername: m.username || m.user?.username || m.userName,
    authorAvatar: m.userAvatar || m.user?.avatarUrl,
    isEcosystemUser: true,
    content: m.caption || m.content || '',
    createdAt: createdAtMs,
    likesCount: m.stats?.likes ?? m.likeCount ?? 0,
    pulsesCount: m.stats?.pulses ?? m.pulseCount ?? 0,
    repliesCount: m.stats?.replies ?? m.replyCount ?? 0,
    zapsCount: m.stats?.zaps ?? m.zapCount ?? 0,
    repostsCount: m.stats?.reposts ?? m.repostCount ?? 0,
    isLiked: opts?.isLiked ?? Boolean(m.isLiked),
    rank: 50,
    rawEvent: m,
  };
}

export function nostrEventToFeedItem(
  event: NostrEvent,
  opts?: { isLiked?: boolean; createdAtOverride?: number; profiles?: Record<string, { username: string; avatarUrl?: string }> },
): UnifiedFeedItem {
  let authorName = `npub…${event.pubkey.slice(-8)}`;
  let authorAvatar: string | undefined;
  let authorUsername: string | undefined;
  let isEco = false;

  try {
    const npubStr = bytesToNpub(hexToBytes(event.pubkey));
    const profile = opts?.profiles?.[npubStr];
    if (profile) {
      authorName = profile.username;
      authorUsername = profile.username;
      authorAvatar = profile.avatarUrl;
      isEco = true;
    }
  } catch {
    /* ignore */
  }

  if (!isEco) {
    const nostrProf = getCachedNostrProfile(event.pubkey);
    if (nostrProf) {
      authorName = nostrProf.displayName || nostrProf.name || authorName;
      authorUsername = nostrProf.nip05 || nostrProf.username || authorUsername;
      authorAvatar = nostrProf.picture || authorAvatar;
    }
  }

  return {
    id: `nostr_${event.id}`,
    source: 'nostr',
    authorName,
    authorUsername,
    authorAvatar,
    isEcosystemUser: isEco,
    content: event.content || '',
    createdAt: opts?.createdAtOverride ?? event.created_at * 1000,
    isLiked: opts?.isLiked,
    rank: 50,
    rawEvent: event,
  };
}

function mergeFeedItems(incoming: UnifiedFeedItem[], prev: UnifiedFeedItem[] = []): UnifiedFeedItem[] {
  const byId = new Map<string, UnifiedFeedItem>();
  for (const row of prev) byId.set(row.id, row);
  for (const row of incoming) {
    const existing = byId.get(row.id);
    byId.set(row.id, existing ? { ...existing, ...row } : row);
  }
  return Array.from(byId.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ITEMS);
}

async function loadBookmarkEntries(): Promise<BookmarkIndexEntry[]> {
  const cached = await LocalEngine.cacheGet<BookmarkIndexEntry[]>(BOOKMARKS_INDEX_CACHE).catch(() => null);
  return Array.isArray(cached) ? cached : [];
}

async function resolveBookmarkFeedItems(entries: BookmarkIndexEntry[]): Promise<UnifiedFeedItem[]> {
  if (!entries.length) return [];

  const [unified, moments] = await Promise.all([
    LocalEngine.cacheGet<UnifiedFeedItem[]>(UNIFIED_CACHE).catch(() => []),
    LocalEngine.cacheGet<any[]>(MOMENTS_CACHE).catch(() => []),
  ]);

  const byUnifiedId = new Map((unified || []).map((i) => [i.id, i]));
  const byEcoId = new Map((moments || []).map((m) => [`eco_${m.$id || m.id}`, m]));
  const nostrIds: string[] = [];

  const rows: UnifiedFeedItem[] = [];

  for (const entry of entries) {
    const feedId =
      entry.source === 'nostr' ? `nostr_${entry.objectId}` : entry.source === 'ecosystem' ? `eco_${entry.objectId}` : '';
    const cachedItem = feedId ? byUnifiedId.get(feedId) : null;
    if (cachedItem) {
      rows.push({ ...cachedItem, createdAt: new Date(entry.createdAt).getTime() });
      continue;
    }

    if (entry.source === 'ecosystem') {
      const moment = byEcoId.get(`eco_${entry.objectId}`);
      if (moment) {
        rows.push(ecoMomentToFeedItem(moment, { createdAtOverride: new Date(entry.createdAt).getTime() }));
        continue;
      }
      try {
        const live = await SocialService.getMomentById(entry.objectId);
        if (live) {
          rows.push(ecoMomentToFeedItem(live, { createdAtOverride: new Date(entry.createdAt).getTime() }));
          continue;
        }
      } catch {
        /* fall through */
      }
    }

    if (entry.source === 'nostr') nostrIds.push(entry.objectId);

    rows.push({
      id: feedId || `bookmark_${entry.id}`,
      source: entry.source === 'nostr' ? 'nostr' : 'ecosystem',
      authorName: entry.title || 'Saved',
      isEcosystemUser: entry.source === 'ecosystem',
      content: [entry.title, entry.url, entry.snippet].filter(Boolean).join('\n'),
      createdAt: new Date(entry.createdAt).getTime(),
      rank: 50,
      rawEvent: entry,
    });
  }

  if (nostrIds.length) {
    const roots = await fetchNostrEventsByIds(nostrIds);
    return rows.map((row) => {
      if (!row.id.startsWith('nostr_')) return row;
      const eventId = row.id.slice(6);
      const root = roots.get(eventId);
      if (!root) return row;
      return nostrEventToFeedItem(root, { createdAtOverride: row.createdAt });
    });
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchPersonalTabItems(
  tab: PersonalConnectTab,
  opts: { userId?: string; nostrPubkeyHex?: string },
): Promise<UnifiedFeedItem[]> {
  const { userId, nostrPubkeyHex } = opts;

  if (tab === 'replies') {
    const [ecoReplies, nostrReplies] = await Promise.all([
      userId ? SocialService.getUserReplies(userId, userId).catch(() => []) : Promise.resolve([]),
      nostrPubkeyHex ? fetchNostrUserReplies(nostrPubkeyHex) : Promise.resolve([]),
    ]);
    const ecoItems = (ecoReplies || []).map((m) => ecoMomentToFeedItem(m));
    const nostrItems = (nostrReplies || []).map((e) => nostrEventToFeedItem(e));
    return mergeFeedItems([...ecoItems, ...nostrItems]);
  }

  if (tab === 'likes') {
    const [ecoLiked, nostrReactions] = await Promise.all([
      userId ? SocialService.getUserLikedMoments(userId, userId).catch(() => []) : Promise.resolve([]),
      nostrPubkeyHex ? fetchNostrUserReactions(nostrPubkeyHex) : Promise.resolve([]),
    ]);

    const ecoItems = (ecoLiked || []).map((m) => ecoMomentToFeedItem(m, { isLiked: true }));

    const rootIds = (nostrReactions || [])
      .map((r) => rootEventIdFromTags(r))
      .filter((id): id is string => Boolean(id));
    const roots = rootIds.length ? await fetchNostrEventsByIds(rootIds) : new Map<string, NostrEvent>();

    const nostrItems = (nostrReactions || []).map((reaction) => {
      const rootId = rootEventIdFromTags(reaction);
      const root = rootId ? roots.get(rootId) : null;
      if (root) {
        return nostrEventToFeedItem(root, { isLiked: true, createdAtOverride: reaction.created_at * 1000 });
      }
      return {
        id: rootId ? `nostr_${rootId}` : `nostr_reaction_${reaction.id}`,
        source: 'nostr' as const,
        authorName: 'Nostr',
        isEcosystemUser: false,
        content: 'Liked a post',
        createdAt: reaction.created_at * 1000,
        isLiked: true,
        rank: 50,
        rawEvent: reaction,
      };
    });

    return mergeFeedItems([...ecoItems, ...nostrItems]);
  }

  if (userId) {
    const { fetchUserBookmarksIndex } = await import('@/lib/chat/bookmark-to-self-chat');
    const entries = await fetchUserBookmarksIndex(userId).catch(() => loadBookmarkEntries());
    return resolveBookmarkFeedItems(entries);
  }
  const entries = await loadBookmarkEntries();
  return resolveBookmarkFeedItems(entries);
}

export { PAGE_SIZE as PERSONAL_TAB_PAGE_SIZE, MAX_ITEMS as PERSONAL_TAB_MAX_ITEMS };
