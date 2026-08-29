import { Query } from 'appwrite';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { peekChatsListMemory, writeChatsListLocal } from '@/lib/chat/local-chat-cache';
import { parseObjectBlocks, serializeObjectBlock } from '@/lib/note-object-secondary';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import type { PublicResourceType } from '@/lib/share/resource-types';
import { ChatService, rememberConversationRoster } from '@/lib/services/chat';
import { LocalEngine } from '@/lib/services/LocalEngine';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
export const BOOKMARKS_INDEX_CACHE = 'f_connect_bookmarks_index';

export type BookmarkObjectKind = PublicResourceType | 'moment' | 'other';

export type BookmarkToSelfChatInput = {
  userId: string;
  kind: BookmarkObjectKind;
  objectId: string;
  title?: string;
  url?: string;
  snippet?: string;
};

export type BookmarkIndexEntry = {
  id: string;
  userId: string;
  kind: BookmarkObjectKind;
  objectId: string;
  source: 'ecosystem' | 'nostr' | 'other';
  title: string;
  url?: string;
  snippet?: string;
  createdAt: string;
  conversationId?: string;
};

function bookmarkSourceFor(input: BookmarkToSelfChatInput): BookmarkIndexEntry['source'] {
  if (input.kind !== 'moment') return 'other';
  if (/^[0-9a-f]{64}$/i.test(input.objectId)) return 'nostr';
  return 'ecosystem';
}

function bookmarkSourceFromKind(kind: BookmarkObjectKind, objectId: string): BookmarkIndexEntry['source'] {
  if (kind !== 'moment') return 'other';
  if (/^[0-9a-f]{64}$/i.test(objectId)) return 'nostr';
  return 'ecosystem';
}

export async function appendBookmarkIndex(
  entry: Omit<BookmarkIndexEntry, 'id' | 'createdAt'> & { id?: string },
): Promise<BookmarkIndexEntry> {
  const row: BookmarkIndexEntry = {
    ...entry,
    id: entry.id || `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const existing = (await LocalEngine.cacheGet<BookmarkIndexEntry[]>(BOOKMARKS_INDEX_CACHE).catch(() => null)) || [];
  const next = [
    row,
    ...existing.filter((e) => !(e.objectId === row.objectId && e.kind === row.kind)),
  ].slice(0, 200);
  await LocalEngine.cacheSet(BOOKMARKS_INDEX_CACHE, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:bookmarks-updated', { detail: next }));
  }
  return row;
}

function parseLegacyBookmarkMessage(text: string): Pick<BookmarkIndexEntry, 'title' | 'url' | 'snippet'> | null {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length || !lines[0].toLowerCase().startsWith('bookmarked:')) return null;
  const title = lines[0].replace(/^bookmarked:\s*/i, '').trim() || 'Saved item';
  const urlLine = lines.find((l) => /^https?:\/\//i.test(l));
  const snippet = lines
    .slice(1)
    .filter((l) => l !== urlLine)
    .join('\n')
    .trim();
  return { title, url: urlLine, snippet: snippet || undefined };
}

function objectIdFromUrl(url: string): { objectId: string; kind: BookmarkObjectKind; source: BookmarkIndexEntry['source'] } {
  const momentMatch = url.match(/\/connect\/post\/([^/?#]+)/i) || url.match(/\/moment\/([^/?#]+)/i);
  if (momentMatch?.[1]) {
    const objectId = momentMatch[1].replace(/^(eco_|nostr_)/, '');
    return {
      objectId,
      kind: 'moment',
      source: /^[0-9a-f]{64}$/i.test(objectId) ? 'nostr' : 'ecosystem',
    };
  }
  return { objectId: url, kind: 'other', source: 'other' };
}

export function bookmarkEntryFromMessage(
  msg: any,
  userId: string,
  conversationId: string,
): BookmarkIndexEntry | null {
  const text = String(msg?.content || msg?.text || '').trim();
  if (!text) return null;

  const blocks = parseObjectBlocks(text);
  const bookmarkBlock = blocks.find((block) => Boolean(block.payload.metadata?.bookmark));
  if (bookmarkBlock) {
    const payload = bookmarkBlock.payload;
    const kind = (String(payload.metadata?.resourceKind || 'other') as BookmarkObjectKind) || 'other';
    const objectId = String(payload.childId || payload.objectId || '').trim();
    const href = payload.href || undefined;
    const source =
      (payload.metadata?.source as BookmarkIndexEntry['source'] | undefined) ||
      bookmarkSourceFromKind(kind, objectId);
    return {
      id: `bm_${msg.$id || msg.id}`,
      userId,
      kind,
      objectId: objectId || href || '',
      source,
      title: payload.label || 'Saved item',
      url: href,
      snippet: String(payload.metadata?.snippet || '').trim() || undefined,
      createdAt: msg.$createdAt || msg.createdAt || new Date().toISOString(),
      conversationId,
    };
  }

  const legacy = parseLegacyBookmarkMessage(text);
  if (!legacy) return null;

  const url = legacy.url || '';
  let source: BookmarkIndexEntry['source'] = 'other';
  let objectId = '';
  let kind: BookmarkObjectKind = 'other';

  if (url) {
    const parsed = objectIdFromUrl(url);
    objectId = parsed.objectId;
    kind = parsed.kind;
    source = parsed.source;
  } else {
    objectId = `msg_${msg.$id || msg.id}`;
  }

  return {
    id: `bm_${msg.$id || msg.id}`,
    userId,
    kind,
    objectId,
    source,
    title: legacy.title,
    url: legacy.url,
    snippet: legacy.snippet,
    createdAt: msg.$createdAt || msg.createdAt || new Date().toISOString(),
    conversationId,
  };
}

function messageLooksLikeBookmark(row: any): boolean {
  if (row?.isBookmark) return true;
  const text = String(row?.content || row?.text || '');
  if (!text) return false;
  if (/^bookmarked:/im.test(text)) return true;
  return parseObjectBlocks(text).some((block) => Boolean(block.payload.metadata?.bookmark));
}

/** Indexed pull of bookmark rows in the user's plaintext self chat. */
export async function fetchUserBookmarkMessages(conversationId: string, limit = 120): Promise<any[]> {
  const byId = new Map<string, any>();

  try {
    const res = await tablesDB.listRows(DB_ID, MSG_TABLE, [
      Query.equal('conversationId', conversationId),
      Query.equal('isBookmark', true),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);
    for (const row of res.rows || []) byId.set(row.$id || row.id, row);
  } catch {
    /* column may not exist on very old stacks */
  }

  if (byId.size < limit) {
    const res = await tablesDB
      .listRows(DB_ID, MSG_TABLE, [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
      ])
      .catch(() => ({ rows: [] as any[] }));
    for (const row of res.rows || []) {
      if (!messageLooksLikeBookmark(row)) continue;
      const id = row.$id || row.id;
      if (!id || byId.has(id)) continue;
      byId.set(id, row);
    }
  }

  return Array.from(byId.values())
    .sort(
      (a, b) =>
        new Date(b.$createdAt || b.createdAt || 0).getTime() -
        new Date(a.$createdAt || a.createdAt || 0).getTime(),
    )
    .slice(0, limit);
}

function dedupeBookmarkEntries(rows: BookmarkIndexEntry[]): BookmarkIndexEntry[] {
  return rows
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(
      (row, idx, arr) =>
        arr.findIndex((x) => x.objectId === row.objectId && x.kind === row.kind) === idx,
    )
    .slice(0, 200);
}

/** Load bookmarks via indexed message query, with local cache hydration. */
export async function fetchUserBookmarksIndex(userId: string): Promise<BookmarkIndexEntry[]> {
  const cached = (await LocalEngine.cacheGet<BookmarkIndexEntry[]>(BOOKMARKS_INDEX_CACHE).catch(() => null)) || [];
  const conversation = await ensureUnencryptedSelfBookmarksConversation(userId).catch(() => null);
  if (!conversation) return cached;

  const conversationId = conversation.$id || conversation.id;
  const messages = await fetchUserBookmarkMessages(conversationId);
  const parsed = messages
    .map((msg) => bookmarkEntryFromMessage(msg, userId, conversationId))
    .filter((row): row is BookmarkIndexEntry => Boolean(row));

  const deduped = dedupeBookmarkEntries(parsed.length ? parsed : cached);
  if (deduped.length) {
    await LocalEngine.cacheSet(BOOKMARKS_INDEX_CACHE, deduped);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:bookmarks-updated', { detail: deduped }));
    }
  }
  return deduped;
}

/** @deprecated Use fetchUserBookmarksIndex */
export async function backfillBookmarksIndexFromSelfChat(userId: string): Promise<BookmarkIndexEntry[]> {
  return fetchUserBookmarksIndex(userId);
}

const ensureInflight = new Map<string, Promise<any>>();

async function listSelfConversations(userId: string): Promise<any[]> {
  try {
    const res = await tablesDB.listRows(DB_ID, CONV_TABLE, [
      Query.contains('participants', userId),
      Query.equal('type', 'direct'),
      Query.limit(100),
    ]);
    return (res.rows || []).filter((row: any) => ChatService.isSelfChatConversation(row, userId));
  } catch {
    return [];
  }
}

function pickUnencryptedSelfKeeper(rows: any[]): any | null {
  const unencrypted = rows.filter((row) => !row?.isEncrypted);
  if (!unencrypted.length) return null;
  return [...unencrypted].sort((a, b) => {
    const timeA = new Date(a.lastMessageAt || a.$createdAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastMessageAt || b.$createdAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  })[0];
}

function normalizeSelfBookmarkConv(conv: any, userId: string) {
  const id = conv.$id || conv.id;
  return {
    ...conv,
    $id: id,
    id,
    type: 'direct',
    isSelf: true,
    isEncrypted: false,
    participants:
      Array.isArray(conv.participants) && conv.participants.length
        ? conv.participants
        : [userId],
  };
}

function upsertLocalBookmarksChat(conv: any, userId: string) {
  const row = normalizeSelfBookmarkConv(conv, userId);
  const current = peekChatsListMemory();
  const id = row.$id;
  const idx = current.findIndex((c) => (c.$id || c.id) === id);
  const next =
    idx >= 0
      ? current.map((c, i) => (i === idx ? { ...c, ...row, isSelfBookmarks: true } : c))
      : [{ ...row, isSelfBookmarks: true }, ...current];
  writeChatsListLocal(next);
  rememberConversationRoster(next);
}

/**
 * Ensure the user's plaintext self hangout used for bookmarks (never the E2EE self chat).
 */
export async function ensureUnencryptedSelfBookmarksConversation(userId: string): Promise<any> {
  const inflight = ensureInflight.get(userId);
  if (inflight) return inflight;

  const promise = (async () => {
    const all = await listSelfConversations(userId);
    const keeper = pickUnencryptedSelfKeeper(all);
    if (keeper) {
      const normalized = normalizeSelfBookmarkConv(keeper, userId);
      upsertLocalBookmarksChat(normalized, userId);
      return normalized;
    }

    try {
      const created = await ChatService.createConversation([userId], 'direct', undefined, {
        encrypted: false,
      });
      const normalized = normalizeSelfBookmarkConv(created, userId);
      upsertLocalBookmarksChat(normalized, userId);
      return normalized;
    } catch (error) {
      const retry = pickUnencryptedSelfKeeper(await listSelfConversations(userId));
      if (retry) {
        const normalized = normalizeSelfBookmarkConv(retry, userId);
        upsertLocalBookmarksChat(normalized, userId);
        return normalized;
      }
      throw error;
    } finally {
      ensureInflight.delete(userId);
    }
  })();

  ensureInflight.set(userId, promise);
  return promise;
}

function formatBookmarkMessage(input: BookmarkToSelfChatInput): string {
  const title = String(input.title || 'Saved item').trim();
  const url =
    input.url ||
    (input.kind !== 'other'
      ? buildPublicResourceUrl(input.kind as PublicResourceType, input.objectId)
      : '');
  const block = serializeObjectBlock({
    childId: input.objectId,
    childKind: 'link',
    href: url || undefined,
    label: title,
    appTheme: 'connect',
    metadata: {
      bookmark: true,
      resourceKind: input.kind,
      source: bookmarkSourceFor(input),
      snippet: input.snippet || undefined,
    },
  });
  const snippet = String(input.snippet || '').trim();
  if (snippet && snippet !== title) return `${block}\n\n${snippet}`;
  return block;
}

/** Save any object reference into the user's unencrypted self chat as a message. */
export async function bookmarkToSelfChat(input: BookmarkToSelfChatInput): Promise<{
  conversationId: string;
  messageText: string;
}> {
  if (!input.userId?.trim()) throw new Error('Sign in to bookmark');
  if (!input.objectId?.trim()) throw new Error('Missing bookmark target');

  const conversation = await ensureUnencryptedSelfBookmarksConversation(input.userId);
  const conversationId = conversation.$id || conversation.id;
  if (!conversationId) throw new Error('Could not open your personal chat');

  const messageText = formatBookmarkMessage(input);
  await ChatService.sendMessage(
    conversationId,
    input.userId,
    messageText,
    'text',
    [],
    undefined,
    undefined,
    undefined,
    { isBookmark: true },
  );
  upsertLocalBookmarksChat(conversation, input.userId);
  await appendBookmarkIndex({
    userId: input.userId,
    kind: input.kind,
    objectId: input.objectId,
    source: bookmarkSourceFor(input),
    title: String(input.title || 'Saved item').trim(),
    url:
      input.url ||
      (input.kind !== 'other'
        ? buildPublicResourceUrl(input.kind as PublicResourceType, input.objectId)
        : undefined),
    snippet: input.snippet,
    conversationId,
  });
  return { conversationId, messageText };
}
