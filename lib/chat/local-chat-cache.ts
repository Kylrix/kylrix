/**
 * Local-copy cache keys for communicative surfaces (chats, threads, later calls).
 * UI hydrates from LocalEngine first; network refresh writes through.
 *
 * Security: never persist decrypted ciphertext payloads at rest.
 * Encrypted message bodies / previews stay as ciphertext (or redacted).
 */
export const CHATS_LIST_CACHE_KEY = 'f_chats_list';
export const THREADS_LIST_CACHE_KEY = 'f_threads_list';

export function chatConversationCacheKey(conversationId: string) {
  return `f_chat_conv_${conversationId}`;
}

export function chatMessagesCacheKey(conversationId: string) {
  return `f_chat_messages_${conversationId}`;
}

function isLikelyCiphertext(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('{"iv"') ||
    trimmed.startsWith('{"data"') ||
    trimmed.startsWith('{"ct"') ||
    trimmed.startsWith('[DECRYPTION_')
  ) {
    return true;
  }
  return trimmed.length >= 24 && !trimmed.includes(' ');
}

/** Strip decrypted secure fields before LocalEngine write. */
export function sanitizeConversationListForRest<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => {
    if (!row?.isEncrypted) return row;
    const next: Record<string, any> = { ...row };
    if (typeof next.lastMessageText === 'string' && next.lastMessageText && !isLikelyCiphertext(next.lastMessageText)) {
      next.lastMessageText = '';
    }
    if (typeof next.name === 'string' && next.name && isLikelyCiphertext(next.name)) {
      // keep ciphertext name for later decrypt; fine at rest
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
      // decrypted metadata object — drop at rest
      next.metadata = null;
    } else if (typeof next.metadata === 'string' && next.metadata && !isLikelyCiphertext(next.metadata)) {
      next.metadata = null;
    }
    return next as T;
  });
}

export { isLikelyCiphertext as isLikelyChatCiphertext };
