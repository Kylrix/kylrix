/**
 * Local-copy cache keys for communicative surfaces (chats, threads, later calls).
 * UI hydrates from LocalEngine first; network refresh writes through.
 */
export const CHATS_LIST_CACHE_KEY = 'f_chats_list';
export const THREADS_LIST_CACHE_KEY = 'f_threads_list';

export function chatConversationCacheKey(conversationId: string) {
  return `f_chat_conv_${conversationId}`;
}

export function chatMessagesCacheKey(conversationId: string) {
  return `f_chat_messages_${conversationId}`;
}
