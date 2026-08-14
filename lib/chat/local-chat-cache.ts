/**
 * Local-copy cache keys for communicative surfaces (chats, threads, later calls).
 * UI hydrates from memory → LocalEngine first; network refresh writes through.
 *
 * Security: never persist decrypted ciphertext payloads at rest.
 * Encrypted message bodies / previews stay as ciphertext (or redacted).
 */
import { LocalEngine } from '@/lib/services/LocalEngine';

export const CHATS_LIST_CACHE_KEY = 'f_chats_list';
export const THREADS_LIST_CACHE_KEY = 'f_threads_list';

/** Sync in-memory mirrors — remount / tab switch paint at 0ms without waiting on RxDB. */
let memoryChatsList: any[] | null = null;
let memoryThreadsList: any[] | null = null;

export function chatConversationCacheKey(conversationId: string) {
  return `f_chat_conv_${conversationId}`;
}

export function chatMessagesCacheKey(conversationId: string) {
  return `f_chat_messages_${conversationId}`;
}

function isLikelyCiphertext(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  const trimmed = val.trim();
  // Fast negative checks for URLs, protocols, and standard text patterns
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('ftp://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('nostr:') ||
    trimmed.startsWith('npub1') ||
    trimmed.startsWith('nsec1') ||
    trimmed.startsWith('note1')
  ) {
    return false;
  }
  if (
    trimmed.startsWith('{"iv"') ||
    trimmed.startsWith('{"data"') ||
    trimmed.startsWith('{"ct"') ||
    trimmed.startsWith('{"ciphertext"') ||
    trimmed.startsWith('[DECRYPTION_')
  ) {
    return true;
  }
  // Pure base64 or hex ciphertext (never containing slashes after scheme or standard punctuation like :// or ?=)
  if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('?')) {
    return false;
  }
  return trimmed.length >= 32 && !trimmed.includes(' ') && /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
}

/** Strip decrypted secure fields before LocalEngine write. */
export function sanitizeConversationListForRest<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => {
    if (!row?.isEncrypted) return row;
    const next: Record<string, any> = { ...row };
    if (typeof next.lastMessageText === 'string' && next.lastMessageText && !isLikelyCiphertext(next.lastMessageText)) {
      next.lastMessageText = '';
    }
    return next as T;
  });
}

/** Only persist ciphertext (or non-secure plaintext) message bodies. */
export function sanitizeMessagesForRest<T extends Record<string, any>>(
  messages: T[],
  isEncrypted: boolean,
): T[] {
  if (!isEncrypted) return messages.map((m) => ({ ...m }));
  return messages.map((m) => {
    const next: Record<string, any> = { ...m };
    if (typeof next.content === 'string' && next.content && !isLikelyCiphertext(next.content)) {
      next.content = '';
    }
    if (next.metadata && typeof next.metadata === 'object') {
      next.metadata = null;
    } else if (typeof next.metadata === 'string' && next.metadata && !isLikelyCiphertext(next.metadata)) {
      next.metadata = null;
    }
    return next as T;
  });
}

export function peekChatsListMemory(): any[] {
  return memoryChatsList ? [...memoryChatsList] : [];
}

export function peekThreadsListMemory(): any[] {
  return memoryThreadsList ? [...memoryThreadsList] : [];
}

export async function readChatsListLocal(): Promise<any[]> {
  if (memoryChatsList?.length) return [...memoryChatsList];
  const cached = await LocalEngine.cacheGet<any[]>(CHATS_LIST_CACHE_KEY);
  if (cached?.length) {
    memoryChatsList = cached;
    return [...cached];
  }
  return [];
}

export async function readThreadsListLocal(): Promise<any[]> {
  if (memoryThreadsList?.length) return [...memoryThreadsList];
  const cached = await LocalEngine.cacheGet<any[]>(THREADS_LIST_CACHE_KEY);
  if (cached?.length) {
    memoryThreadsList = cached;
    return [...cached];
  }
  return [];
}

export function writeChatsListLocal(rows: any[]): void {
  const safe = sanitizeConversationListForRest(rows || []);
  memoryChatsList = safe;
  void LocalEngine.cacheSet(CHATS_LIST_CACHE_KEY, safe);
}

export function writeThreadsListLocal(rows: any[]): void {
  const safe = rows || [];
  memoryThreadsList = safe;
  void LocalEngine.cacheSet(THREADS_LIST_CACHE_KEY, safe);
}

export function clearChatsListMemory(): void {
  memoryChatsList = null;
}

export function clearThreadsListMemory(): void {
  memoryThreadsList = null;
}

export { isLikelyCiphertext as isLikelyChatCiphertext };
