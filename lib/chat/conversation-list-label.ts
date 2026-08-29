import { getCachedIdentityById } from '@/lib/identity-cache';
import { isLikelyChatCiphertext } from '@/lib/chat/local-chat-cache';

const GENERIC_CONVERSATION_NAMES = /^(direct chat|chat|group chat|hangout|encrypted group)$/i;

export function isGenericConversationName(name?: string | null): boolean {
  if (!name?.trim()) return true;
  return GENERIC_CONVERSATION_NAMES.test(name.trim());
}

export function resolveDirectChatPeerId(
  participants: string[] | undefined,
  currentUserId?: string,
): string | undefined {
  if (!participants?.length || !currentUserId) return undefined;
  if (participants.length === 1 && participants[0] === currentUserId) return currentUserId;
  return participants.find((p) => p !== currentUserId);
}

export function resolveConversationListLabel(opts: {
  conversation: Record<string, unknown>;
  currentUserId?: string;
  workspaceTitle?: string;
}): { label: string; otherUserId?: string; isSelf?: boolean } {
  const c = opts.conversation;
  const type = String(c.type || 'direct');
  const stored = String(c.name || c.title || '').trim();
  const participants = (Array.isArray(c.participants) ? c.participants : []) as string[];

  if (type === 'group' || type === 'channel') {
    if (c.isWorkspace && opts.workspaceTitle) return { label: opts.workspaceTitle };
    if (stored && !isGenericConversationName(stored) && !isLikelyChatCiphertext(stored)) return { label: stored };
    return { label: c.isWorkspace ? (opts.workspaceTitle || 'Workspace') : 'Group' };
  }

  const isSelf =
    Boolean(opts.currentUserId) &&
    participants.length > 0 &&
    participants.every((p) => p === opts.currentUserId);

  if (isSelf && opts.currentUserId) {
    const me = getCachedIdentityById(opts.currentUserId);
    const myName = me?.displayName || me?.username || 'You';
    return { label: `${myName} (You)`, otherUserId: opts.currentUserId, isSelf: true };
  }

  const peerId = resolveDirectChatPeerId(participants, opts.currentUserId);
  if (peerId) {
    const cached = getCachedIdentityById(peerId);
    const fromCache = cached?.displayName || cached?.username;
    if (fromCache) return { label: fromCache, otherUserId: peerId };
    if (stored && !isGenericConversationName(stored) && !isLikelyChatCiphertext(stored)) return { label: stored, otherUserId: peerId };
    return { label: `@${peerId.slice(0, 7)}`, otherUserId: peerId };
  }

  if (stored && !isGenericConversationName(stored) && !isLikelyChatCiphertext(stored)) return { label: stored };
  return { label: 'Chat' };
}

/** Prefer the first non-generic display name from callers (list click, profile, cache). */
export function pickConversationDisplayName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value && !isGenericConversationName(value)) return value;
  }
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value.startsWith('@') && value.length > 1) return value;
  }
  return '';
}

/** Synchronous header label — identity cache first, never returns generic placeholders. */
export function resolveConversationHeaderName(opts: {
  conversation?: Record<string, unknown> | null;
  currentUserId?: string;
  seedTitle?: string | null;
  partnerProfile?: { displayName?: string | null; username?: string | null } | null;
}): string {
  const { conversation, currentUserId, seedTitle, partnerProfile } = opts;

  if (seedTitle && !isGenericConversationName(seedTitle)) return seedTitle;

  const peerId =
    (conversation?.otherUserId as string | undefined) ||
    resolveDirectChatPeerId(
      (conversation?.participants as string[] | undefined),
      currentUserId,
    );

  if (peerId) {
    const cached = getCachedIdentityById(peerId);
    const fromCache = cached?.displayName || cached?.username;
    if (fromCache && !isGenericConversationName(fromCache)) return fromCache;
  }

  const profileName = partnerProfile?.displayName || partnerProfile?.username;
  if (profileName && !isGenericConversationName(profileName)) return profileName;

  if (conversation && currentUserId) {
    const { label } = resolveConversationListLabel({ conversation, currentUserId });
    if (label && !isGenericConversationName(label)) return label;
    if (label?.startsWith('@')) return label;
  }

  if (peerId) return `@${peerId.slice(0, 7)}`;

  const stored = String(conversation?.name || conversation?.title || '').trim();
  if (stored && !isGenericConversationName(stored) && !isLikelyChatCiphertext(stored)) return stored;

  return '';
}

export function formatConversationListTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
