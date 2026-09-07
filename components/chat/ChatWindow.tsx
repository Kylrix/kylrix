'use client';
import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useRouter, useSearchParams } from 'next/navigation';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
    Box,
    Typography,
    IconButton,
    Button,
    AppBar,
    Toolbar,
    Menu,
    MenuItem,
    Popover,
    Drawer,
    Stack,
    useTheme,
    useMediaQuery,
} from '@/lib/openbricks/primitives';
import { ChatSettingsPanel } from '@/components/chat/ChatSettingsPanel';
import {
    ChevronLeft,
    File as FileIcon,
    MoreVertical,
    Trash2,
    FileText,
    Key,
    X,
    Reply,
    Copy,
    Pin,
    Lock,
    Zap,
} from 'lucide-react';
import { NoteSelectorModal } from './NoteSelectorModal';
import { SecretSelectorModal } from './SecretSelectorModal';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import SudoModal from '../overlays/SudoModal';
import { usePresence } from '../providers/PresenceProvider';
import type { AttachmentMetadata } from '@/types/p2p';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { toast } from 'react-hot-toast';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { getVerificationState } from '@/lib/verification';
import { markConversationRead } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import MuralPattern from './MuralPattern';
import { IdentityAvatar, IdentityName } from '../common/IdentityBadge';
import { buildNoteAttachmentMetadata } from '@/sdk';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { showUpgradeIsland } from '@/lib/upgrade-island';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useSudo } from '@/context/SudoContext';
import { PresenceService } from '@/lib/services/presence';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
    chatConversationCacheKey,
    chatMessagesCacheKey,
    sanitizeMessagesForRest,
    peekChatsListMemory,
} from '@/lib/chat/local-chat-cache';
import type { ChatMessage, ChatReaction, SenderProfile } from './chat-types';
import { MessagesType } from './chat-types';
import {
    getClientReadSegments,
    dedupeReactionsByUser,
    sortReactionGroups,
    getReactionActorLabel
} from './chat-message-utils';
import { ChatDraftInput } from './ChatDraftInput';
import {
  composeChatMessageText,
  parseChatAttachFile,
  type ChatPendingObject,
} from '@/lib/chat/pending-object';
import { ChatMessageContent } from './ChatMessageContent';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import {
import { handleSend as handleSend_ext } from './ChatWindowSections/handleSend';
import { toggleRecording as toggleRecording_ext } from './ChatWindowSections/toggleRecording';
import { initRealtime as initRealtime_ext } from './ChatWindowSections/initRealtime';
import { handleClearChat as handleClearChat_ext } from './ChatWindowSections/handleClearChat';
import { hydrateSenders as hydrateSenders_ext } from './ChatWindowSections/hydrateSenders';
import { handleSecretSelect as handleSecretSelect_ext } from './ChatWindowSections/handleSecretSelect';
import { hydrateMembers as hydrateMembers_ext } from './ChatWindowSections/hydrateMembers';
import { initRealtime as initRealtime_ext } from './ChatWindowSections/initRealtime_d0_20870';
import { ChatWindowView } from './ChatWindowSections/ChatWindowView';
import { seedConversationFromList as seedConversationFromList_ext } from './ChatWindowSections/seedConversationFromList';
import { handleNoteSelect as handleNoteSelect_ext } from './ChatWindowSections/handleNoteSelect';
import { handleExport as handleExport_ext } from './ChatWindowSections/handleExport';
    pickConversationDisplayName,
    resolveConversationHeaderName,
} from '@/lib/chat/conversation-list-label';
const seedConversationFromList = (..._args: any[]) => seedConversationFromList_ext({ handleExport, handleNoteSelect, seedConversationFromList });
export const ChatWindow = ({
    conversationId,
    onBack,
    layout = 'fill',
    seedTitle,
}: {
    conversationId: string;
    onBack?: () => void;
    /** fill = in-page / object detail (respects primary sidebar). fixed = legacy fullscreen. */
    layout?: 'fill' | 'fixed';
    /** Resolved label from chat list / opener — avoids flashing generic "Direct Chat". */
    seedTitle?: string;
}) => {
    const { user } = useAuth();
    const { openProUpgrade } = useProUpgrade();
    const { markConversationRead: markConversationReadInContext } = useChatNotifications();
    const { globalPresence} = usePresence();
    const [typingUsers, _setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [ownTypingEnabled, setOwnTypingEnabled] = useState(true);
    const [ownOnlineEnabled, setOwnOnlineEnabled] = useState(true);
    const [partnerTypingEnabled, setPartnerTypingEnabled] = useState(true);
    const [partnerOnlineEnabled, setPartnerOnlineEnabled] = useState(true);
    const [_partnerPresence, setPartnerPresence] = useState<any>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversation, setConversation] = useState<any>(() =>
        seedConversationFromList(conversationId, seedTitle, user?.$id),
    );
    const [_loading, setLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [pendingObject, setPendingObject] = useState<ChatPendingObject | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [attachAnchorEl, setAttachAnchorEl] = useState<null | HTMLElement>(null);
    void anchorEl; void attachAnchorEl;
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [secretModalOpen, setSecretModalOpen] = useState(false);
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const { promptSudo } = useSudo();
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [messageAnchorEl, setMessageAnchorEl] = useState<{ el: HTMLElement, msg: ChatMessage } | null>(null);
    const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
    const [partnerVerification, setPartnerVerification] = useState(() => getVerificationState(null));
    const [conversationReadAt, setConversationReadAt] = useState(0);
    const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({});
    const [messageReactions, setMessageReactions] = useState<Record<string, ChatReaction[]>>({});
    const [reactionPopoverAnchorEl, setReactionPopoverAnchorEl] = useState<HTMLElement | null>(null);
    const [reactionPopoverMessageId, setReactionPopoverMessageId] = useState<string | null>(null);
    const initialLoadRef = useRef<string | null>(null);
    const { openFileDrawer } = useUnifiedFileDrawer();
    const { open: openUnifiedDrawer } = useUnifiedDrawer();
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const { openOverlay, closeOverlay } = useOverlay();
    const [_isPending, startTransition] = useTransition();
    const isProPlan = hasPaidKylrixPlan(user);
    const { openWalletWithIntent } = useWalletOverlay();
    const _searchParams = useSearchParams();
    const partnerId = useMemo(() => {
        if (!conversation) return null;
        if (conversation.otherUserId) return conversation.otherUserId as string;
        const type = String(conversation.type || 'direct');
        if (type !== 'direct' || !user?.$id) return null;
        return conversation.participants?.find((p: string) => p !== user.$id) || null;
    }, [conversation, user?.$id]);
    const handleTip = () => {
        if (!partnerId) return;
        setAnchorEl(null);
        openWalletWithIntent({
            mode: 'send',
            toUser: {
                id: partnerId,
                username: conversation?.name?.replace(/^@/, '') || 'User',
                displayName: conversation?.name || 'User'}});
    };
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<any>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const router = useRouter();
    const clientReadSegments = React.useMemo(
        () => getClientReadSegments(messages, user?.$id, conversation?.type === 'direct', conversationReadAt),
        [messages, user?.$id, conversation?.type, conversationReadAt]
    );
    const messageSenderIds = React.useMemo(
        () => Array.from(new Set(messages.map((msg) => msg.senderId).filter(Boolean))) as string[],
        [messages]
    );
    const groupMentionTargets = React.useMemo(() => {
        if (conversation?.type !== 'group' || !Array.isArray(conversation?.participants)) return [];
        const participantIds = conversation.participants.filter((participantId: unknown): participantId is string => typeof participantId === 'string' && participantId.trim().length > 0);
        const uniqueParticipantIds: string[] = Array.from(new Set(participantIds));
        return uniqueParticipantIds
            .filter((participantId) => participantId !== user?.$id)
            .map((participantId) => {
                const cached = senderProfiles[participantId] || getCachedIdentityById(participantId);
                const username = cached?.username || null;
                return {
                    id: participantId,
                    label: cached?.displayName || username || `@${participantId.slice(0, 7)}`,
                    token: username ? `@${username}` : `@${participantId.slice(0, 7)}`};
            });
    }, [conversation?.participants, conversation?.type, senderProfiles, user?.$id]);
    const reactionsByMessageId = React.useMemo(() => messageReactions, [messageReactions]);
    const reactionPopoverMessage = React.useMemo(
        () => messages.find((message) => message.$id === reactionPopoverMessageId) || null,
        [messages, reactionPopoverMessageId]
    );
    const reactionPopoverRows = React.useMemo(() => {
        if (!reactionPopoverMessageId) return [];
        return reactionsByMessageId[reactionPopoverMessageId] || [];
    }, [reactionPopoverMessageId, reactionsByMessageId]);
    const reactionPopoverGroups = React.useMemo(() => {
        const groups = new Map<string, { emoji: string; actors: { userId: string; label: string; isSelf: boolean }[] }>();
        reactionPopoverRows.forEach((reaction) => {
            if (!reaction?.emoji || !reaction?.userId) return;
            const existing = groups.get(reaction.emoji);
            const actor = {
                userId: reaction.userId,
                label: getReactionActorLabel(reaction.userId, senderProfiles),
                isSelf: reaction.userId === user?.$id};
            if (existing) {
                if (!existing.actors.some((entry) => entry.userId === reaction.userId)) {
                    existing.actors.push(actor);
                }
                return;
            }
            groups.set(reaction.emoji, { emoji: reaction.emoji, actors: [actor] });
        });
        return Array.from(groups.values());
    }, [reactionPopoverRows, senderProfiles, user?.$id]);
    const isSelf = conversation?.type === 'direct' && conversation?.participants && (conversation.participants.length === 1 || conversation.participants.length === 2) && conversation.participants.every((p: string) => p === user?.$id);
    const hasRepliedToPartner = messages.some((message) => message.senderId === user?.$id);
    const _showFirstContactWarning = Boolean(
        conversation?.type === 'direct' &&
        !isSelf &&
        partnerProfile &&
        !partnerVerification.verified &&
        !hasRepliedToPartner
    );
    const applyDisplayName = React.useCallback(
        (conv: any, profile?: { displayName?: string | null; username?: string | null } | null) => {
            if (!conv) return conv;
            const name = resolveConversationHeaderName({
                conversation: conv,
                currentUserId: user?.$id,
                seedTitle,
                partnerProfile: profile,
            });
            if (!name || name === conv.name) return conv;
            return { ...conv, name, title: name };
        },
        [seedTitle, user?.$id],
    );
    const conversationDisplayName = useMemo(() => {
        const resolved = resolveConversationHeaderName({
            conversation,
            currentUserId: user?.$id,
            seedTitle,
            partnerProfile,
        });
        return resolved || 'Loading...';
    }, [conversation, seedTitle, user?.$id, partnerProfile]);
    useEffect(() => {
        if (!partnerId) return undefined;
        const cached = getCachedIdentityById(partnerId);
        if (cached && !partnerProfile) {
            setPartnerProfile(cached);
        }
        return subscribeIdentityCache((identity) => {
            if (identity?.userId !== partnerId) return;
            startTransition(() => {
                setPartnerProfile(identity);
                setConversation((prev: any) => {
                    if (!prev) return prev;
                    const name = resolveConversationHeaderName({
                        conversation: prev,
                        currentUserId: user?.$id,
                        seedTitle,
                        partnerProfile: identity,
                    });
                    if (!name || name === prev.name) return prev;
                    return { ...prev, name, title: name };
                });
            });
        });
    }, [partnerId, seedTitle, user?.$id, startTransition]);
    useEffect(() => {
        if (!conversationId) return;
        setConversation((prev: any) => {
            const fromList = peekChatsListMemory().find(
                (c: any) => c.$id === conversationId || c.id === conversationId,
            );
            const base = prev || fromList;
            if (!base) {
                if (!seedTitle) return prev;
                return {
                    $id: conversationId,
                    id: conversationId,
                    name: seedTitle,
                    title: seedTitle,
                    type: 'direct',
                    participants: [],
                };
            }
            const name = resolveConversationHeaderName({
                conversation: base,
                currentUserId: user?.$id,
                seedTitle,
                partnerProfile,
            });
            if (!name || base.name === name) return base;
            return { ...base, name, title: name };
        });
    }, [conversationId, user?.$id, seedTitle, partnerProfile?.displayName, partnerProfile?.username]);
    const loadConversation = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            const cachedConv = await LocalEngine.cacheGet<any>(chatConversationCacheKey(conversationId));
            if (cachedConv?.$id || cachedConv?.id) {
                startTransition(() => setConversation(applyDisplayName(cachedConv)));
            }
            if (ecosystemSecurity.status.isUnlocked) {
                void UsersService.forceSyncProfileWithIdentity(user);
            }
            let conv: any = null;
            try {
              conv = await ChatService.getConversationById(conversationId, user.$id);
              if (!conv) throw new Error('Conversation not found');
            } catch (e) {
              try {
                const rosterHit = (await import('@/lib/chat/local-chat-cache')).peekChatsListMemory?.().find((c: any) => c.$id === conversationId || c.id === conversationId)
                  || (await import('@/lib/chat/local-chat-cache')).peekThreadsListMemory?.().find((c: any) => c.$id === conversationId || c.id === conversationId)
                  || null;
                if (rosterHit) {
                  const fallbackName =
                    resolveConversationHeaderName({
                      conversation: rosterHit,
                      currentUserId: user?.$id,
                      seedTitle,
                    }) ||
                    pickConversationDisplayName(seedTitle, rosterHit.title, rosterHit.name) ||
                    'Thread';
                  const fallback = {
                    $id: conversationId,
                    id: conversationId,
                    name: fallbackName,
                    title: fallbackName,
                    type: rosterHit.type || 'thread',
                    participants: rosterHit.participants || [],
                    isEncrypted: !!(rosterHit as any).isEncrypted,
                    avatarUrl: rosterHit.avatarUrl || rosterHit.avatar || null,
                    isThreadFallback: true,
                  };
                  startTransition(() => setConversation(fallback as any));
                  void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), fallback);
                  return;
                }
                const { ThreadService } = await import('@/lib/services/threads');
                const t = await (ThreadService as any).getById?.(conversationId).catch(() => null);
                if (t) {
                  const fallbackName =
                    resolveConversationHeaderName({
                      conversation: { ...t, type: 'thread', title: t.title },
                      currentUserId: user?.$id,
                      seedTitle,
                    }) ||
                    pickConversationDisplayName(seedTitle, t.title) ||
                    'Thread';
                  const fallback = {
                    $id: t.id,
                    id: t.id,
                    name: fallbackName,
                    title: fallbackName,
                    type: 'thread',
                    participants: [],
                    isEncrypted: !!t.isEncrypted,
                    isThreadFallback: true,
                  };
                  startTransition(() => setConversation(fallback as any));
                  void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), fallback);
                  return;
                }
              } catch {}
              throw e;
            }
            if (!conv || conv.type === undefined) {
              console.error('Failed to load conversation: null conv after fallback', { conversationId });
              return;
            }
            if (conv.type === 'direct') {
                const otherId = conv.participants.find((p: string) => p !== user.$id);
                if (otherId) {
                    try {
                        const profile = await UsersService.getProfileById(otherId);
                        startTransition(() => {
                            setPartnerProfile(profile || null);
                            setPartnerVerification(getVerificationState(profile?.preferences || null));
                        });
                        let avatarUrl = null;
                        if (profile?.avatar?.startsWith?.('http')) {
                            avatarUrl = profile.avatar;
                        } else if (profile?.avatar) {
                            try {
                                const url = await fetchProfilePreview(profile.avatar, 64, 64);
                                avatarUrl = url as unknown as string;
                            } catch (_e) {}
                        }
                        seedIdentityCache({ ...profile, avatar: profile?.avatar || avatarUrl });
                        const next = applyDisplayName(
                            {
                                ...conv,
                                name: profile
                                    ? profile.displayName || profile.username
                                    : `@${otherId.slice(0, 7)}`,
                                avatarUrl,
                            },
                            profile,
                        );
                        startTransition(() => setConversation(next));
                        void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), next);
                    } catch (_e: unknown) {
                        startTransition(() => {
                            setPartnerProfile(null);
                            setPartnerVerification(getVerificationState(null));
                            setConversation(
                                applyDisplayName({ ...conv, name: `@${otherId.slice(0, 7)}` }),
                            );
                        });
                    }
                } else {
                    const myProfile = await UsersService.getProfileById(user.$id);
                    const myName = myProfile ? (myProfile.displayName || myProfile.username) : (user.name || 'You');
                    startTransition(() => {
                        setPartnerProfile(null);
                        setPartnerVerification(getVerificationState(null));
                    });
                    let avatarUrl = null;
                    if (myProfile?.avatar?.startsWith?.('http')) {
                        avatarUrl = myProfile.avatar;
                    } else if (myProfile?.avatar) {
                        try {
                            const url = await fetchProfilePreview(myProfile.avatar, 64, 64);
                            avatarUrl = url as unknown as string;
                        } catch (_e) {}
                    }
                    seedIdentityCache({ ...myProfile, avatar: myProfile?.avatar || avatarUrl });
                    const next = applyDisplayName({ ...conv, name: `${myName} (You)`, avatarUrl });
                    startTransition(() => setConversation(next));
                    void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), next);
                }
            } else {
                startTransition(() => {
                    setPartnerProfile(null);
                    setPartnerVerification(getVerificationState(null));
                    setConversation(applyDisplayName(conv));
                });
                void LocalEngine.cacheSet(
                    chatConversationCacheKey(conversationId),
                    applyDisplayName(conv),
                );
            }
            if (conv && conv.isEncrypted) {
                if (!ecosystemSecurity.status.isUnlocked) {
                    void promptSudo();
                } else {
                    void ChatService.getConversationKey(conv, user.$id, null, { allowCreate: true });
                }
            }
        } catch (error: unknown) {
            console.error('Failed to load conversation:', error);
        }
    }, [conversationId, user, startTransition, seedTitle, applyDisplayName]);
    const loadReactions = React.useCallback(async () => {
        try {
            const response = await tablesDB.listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS, [
                Query.equal('conversationId', conversationId),
                Query.limit(1000),
                Query.orderAsc('createdAt')]);
            const reactionRows = dedupeReactionsByUser((response.rows || []) as unknown as ChatReaction[]);
            const grouped = reactionRows.reduce((acc: Record<string, ChatReaction[]>, reaction: ChatReaction) => {
                if (!reaction?.messageId) return acc;
                acc[reaction.messageId] ||= [];
                acc[reaction.messageId].push(reaction);
                return acc;
            }, {});
            startTransition(() => setMessageReactions(grouped));
        } catch (error: unknown) {
            console.error('Failed to load reactions:', error);
        }
    }, [conversationId, startTransition]);
    const loadMessages = React.useCallback(async () => {
        if (!conversationId) return;
        console.log('[ChatWindow] loadMessages start for:', conversationId);
        try {
            const cachedMessages = await LocalEngine.cacheGet<ChatMessage[]>(
                chatMessagesCacheKey(conversationId),
            );
            if (cachedMessages?.length) {
                startTransition(() => setMessages(cachedMessages));
                setMessagesLoading(false);
                if (ecosystemSecurity.status.isUnlocked && user?.$id) {
                    void (async () => {
                        try {
                            const convForDecrypt = await ChatService.getConversationById(
                                conversationId,
                                user.$id,
                            ).catch(() => null);
                            if (!convForDecrypt) return;
                            const hydrated = (await ChatService.decryptMessageRows(
                                cachedMessages,
                                convForDecrypt,
                                user.$id,
                            )) as ChatMessage[];
                            startTransition(() => setMessages(hydrated));
                        } catch {
                            /* keep ciphertext until network */
                        }
                    })();
                }
            } else {
                setMessagesLoading(true);
            }
            startTransition(() => setMessageReactions({}));
            if (user?.$id && ecosystemSecurity.status.isUnlocked) {
                void UsersService.forceSyncProfileWithIdentity(user);
            }
            let conv: any = null;
            try {
              conv = await ChatService.getConversationById(conversationId, user?.$id);
            } catch {}
            let response: any = null;
            try {
              console.log('[ChatWindow] loadMessages: conversation fetched:', conv?.$id || 'null — still fetching messages');
              response = await ChatService.getMessages(conversationId, 50, 0, user?.$id, {
                  prefetchedConversation: conv || undefined});
            } catch (e) {
              console.warn('[ChatWindow] getMessages failed, will try thread fallback', e);
            }
            if (response) console.log('[ChatWindow] loadMessages: getMessages returned rows:', response?.rows?.length);
            if (!response || !Array.isArray(response.rows)) {
              try {
                const { getOrCreateThread, listThreadMessages } = await import('@/lib/actions/client-ops');
                let t: any = null;
                let threadId: string | null = null;
                const isSelfBookmarks = !!(conversation as any)?.isSelfBookmarks || (!!(conversation as any)?.isthreadChat && Array.isArray((conversation as any)?.collaborators) && (conversation as any).collaborators.length===1);
                const fallbackIsSelf = !isSelfBookmarks && !conv && conversationId && (() => {
                  try {
                    const mem: any[] = ((): any[] => { try { return (require('@/lib/chat/local-chat-cache') as any).peekThreadsListMemory?.() || []; } catch { return []; } })();
                    const hit = mem.find((c: any) => c.$id===conversationId || c.id===conversationId);
                    return !!hit?.isSelfBookmarks;
                  } catch { return false; }
                })();
                const useSelf = isSelfBookmarks || fallbackIsSelf;
                try {
                  const parentKind: any = useSelf ? 'user' : 'chat';
                  const parentId: any = useSelf ? (user?.$id || conversationId) : conversationId;
                  const channel: any = useSelf ? 'bookmarks' : 'general';
                  const title: any = (conversation as any)?.name || (conversation as any)?.title || (useSelf ? 'Bookmarks' : 'Huddle');
                  const ensured: any = await getOrCreateThread({ parentKind, parentId, channel, title, legacyNoteId: conversationId } as any);
                  t = ensured?.thread || null;
                  threadId = t?.id || null;
                } catch {}
                if (t && threadId) {
                  const threadMessages: any[] = await listThreadMessages(threadId, { limit: 50 }).catch(() => []) as any[];
                  const rows = (threadMessages || []).map((m: any) => ({
                    $id: m.id || m.$id,
                    id: m.id || m.$id,
                    conversationId,
                    senderId: m.userId || m.senderId,
                    content: m.content,
                    type: 'text',
                    attachments: [],
                    $createdAt: m.createdAt || m.$createdAt,
                    createdAt: m.createdAt || m.$createdAt,
                  }));
                  response = { rows, atRestRows: rows };
                  if (!conv) {
                    conv = { $id: threadId, id: threadId, settings: null, isEncrypted: !!t?.isEncrypted, isThreadFallback: true, isthreadChat: true, isSelfBookmarks: useSelf } as any;
                    console.log('[ChatWindow] loadMessages: thread fallback fetched:', conv.$id, 'rows:', rows.length);
                  }
                }
              } catch {}
            }
            if (!response || !Array.isArray(response.rows)) {
              console.warn('[ChatWindow] loadMessages: no response rows for', conversationId);
              setMessagesLoading(false);
              setLoading(false);
              return;
            }
            let displayMessages = response.rows;
            let atRest = (response as any).atRestRows || response.rows;
            if (user && conv?.settings) {
                try {
                    const settingsRaw: string = String(conv.settings);
                    const looksEncrypted = settingsRaw.length > 40 && !settingsRaw.includes(' ') && ecosystemSecurity.status.isUnlocked;
                    const decryptedSettings = looksEncrypted ? await ecosystemSecurity.decrypt(settingsRaw) : settingsRaw;
                    const settings = JSON.parse(decryptedSettings);
                    const myClearedAt = settings.clearedAt?.[user.$id];
                    if (myClearedAt) {
                        const cutoff = new Date(myClearedAt);
                        displayMessages = displayMessages.filter((m: any) => new Date(m.createdAt || m.$createdAt) > cutoff);
                        atRest = atRest.filter((m: any) => new Date(m.createdAt || m.$createdAt) > cutoff);
                        console.log('[ChatWindow] loadMessages: Filtered by clearedAt. Remaining:', displayMessages.length);
                    }
                } catch (_e: unknown) { }
            }
            const ordered = displayMessages.reverse() as unknown as ChatMessage[];
            const atRestOrdered = [...atRest].reverse();
            startTransition(() => {
                setMessages(ordered);
            });
            void LocalEngine.cacheSet(
                chatMessagesCacheKey(conversationId),
                sanitizeMessagesForRest(atRestOrdered, Boolean(conv?.isEncrypted)),
            );
            void loadReactions();
        } catch (error: unknown) {
            console.error('[ChatWindow] loadMessages failed:', error);
        } finally {
            setMessagesLoading(false);
            setLoading(false);
        }
    }, [conversationId, loadReactions, user, startTransition]);
    const openReactionPopover = React.useCallback((event: React.MouseEvent<HTMLElement>, messageId: string) => {
        setReactionPopoverAnchorEl(event.currentTarget);
        setReactionPopoverMessageId(messageId);
    }, []);
    const closeReactionPopover = React.useCallback(() => {
        setReactionPopoverAnchorEl(null);
        setReactionPopoverMessageId(null);
    }, []);
    useEffect(() => {
        if (user?.$id && conversationId) {
            const readAt = markConversationRead(conversationId, user.$id);
            setConversationReadAt(readAt);
            markConversationReadInContext(conversationId);
        }
    }, [conversationId, user?.$id, messages.length, markConversationReadInContext]);
    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            const shouldReload = status.isUnlocked && status.hasIdentity && !isUnlocked;
            setIsUnlocked(status.isUnlocked);
            if (shouldReload) {
                void loadMessages();
                void loadConversation();
            }
        });
        return () => unsubscribe();
    }, [loadConversation, loadMessages, isUnlocked]);
    useEffect(() => {
        if (conversation?.isEncrypted && !isUnlocked) {
            void promptSudo();
        }
    }, [conversation?.isEncrypted, isUnlocked, promptSudo]);
    const [ownLinkPreviewsEnabled, setOwnLinkPreviewsEnabled] = useState(true);
    useEffect(() => {
        if (!user?.$id) return;
        UsersService.getProfileById(user.$id).then((p: any) => {
            try {
                const pr = typeof p?.preferences === 'string' ? JSON.parse(p.preferences) : p?.preferences || {};
                setOwnTypingEnabled(pr.typingEnabled ?? true);
                setOwnOnlineEnabled(pr.onlineEnabled ?? true);
                setOwnLinkPreviewsEnabled(pr.linkPreviewsEnabled ?? true);
            } catch {}
        }).catch(() => {});
    }, [user?.$id]);
    useEffect(() => {
        const otherId = conversation?.type === 'direct' ? (conversation?.participants || []).find((id: string) => id !== user?.$id) : null;
        if (!otherId || conversation?.type !== 'direct') { setPartnerTypingEnabled(true); setPartnerOnlineEnabled(true); return; }
        UsersService.getProfileById(otherId).then((p: any) => {
            try { const pr = typeof p?.preferences === 'string' ? JSON.parse(p.preferences) : p?.preferences || {}; setPartnerTypingEnabled(pr.typingEnabled ?? true); setPartnerOnlineEnabled(pr.onlineEnabled ?? true); } catch {}
        }).catch(() => {});
    }, [conversation?.participants, conversation?.type, user?.$id]);
    useEffect(() => {
        if (conversation?.type !== 'direct') { _setTypingUsers([]); return; }
        if (!ownTypingEnabled || !partnerTypingEnabled) { _setTypingUsers([]); return; }
        const channel = PresenceService.getChatChannel(conversationId);
        let timeout: any = null;
        const unsub = PresenceService.subscribeToPresence(channel, (payload: any) => {
            const uid = payload?.userId || payload?.user_id;
            if (!uid || uid === user?.$id) return;
            const isTyping = !!payload?.metadata?.typing || payload?.state === 'typing';
            if (isTyping) {
                _setTypingUsers([uid]);
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => _setTypingUsers([]), 3000);
            } else {
                _setTypingUsers([]);
            }
        });
        return () => { if (timeout) clearTimeout(timeout); try { (unsub as any)?.(); } catch {} };
    }, [conversationId, conversation?.type, ownTypingEnabled, partnerTypingEnabled, user?.$id]);
    useEffect(() => {
        const otherId = conversation?.type === 'direct' ? (conversation?.participants || []).find((id: string) => id !== user?.$id) : null;
        if (conversation?.type !== 'direct' || !otherId || !ownOnlineEnabled || !partnerOnlineEnabled) { setPartnerPresence(null); return; }
        const chan = PresenceService.getResourceChannel('presence', 'users', otherId);
        const unsub = PresenceService.subscribeToPresence(chan, (payload: any) => {
            setPartnerPresence(payload?.state === 'online' ? payload : null);
        });
        void PresenceService.broadcastState(PresenceService.getResourceChannel('presence','users', user?.$id || 'anon'), { userId: user?.$id || '', state: 'online' as any });
        return () => { try { (unsub as any)?.(); } catch {} };
    }, [conversation?.participants, conversation?.type, ownOnlineEnabled, partnerOnlineEnabled, user?.$id]);
    useEffect(() => {
        if (!messageSenderIds.length) return;
        let cancelled = false;
        const hydrateSenders = (..._args: any[]) => hydrateSenders_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
        void hydrateSenders();
        return () => {
            cancelled = true;
        };
    }, [messageSenderIds, senderProfiles, startTransition]);
    useEffect(() => {
        if (!messageSenderIds.length) return () => {};
        const unsubscribe = subscribeIdentityCache((identity) => {
            if (!identity?.userId || !messageSenderIds.includes(identity.userId)) return;
            startTransition(() => {
                setSenderProfiles((prev) => ({
                    ...prev,
                    [identity.userId]: {
                        displayName: identity.displayName,
                        username: identity.username,
                        avatar: identity.avatar,
                        avatarUrl: identity.avatar && identity.avatar.startsWith('http') ? identity.avatar : prev[identity.userId]?.avatarUrl || null,
                        preferences: identity.preferences}}));
            });
        });
        return unsubscribe;
    }, [messageSenderIds, startTransition]);
    useEffect(() => {
        if (conversation?.type !== 'group' || !Array.isArray(conversation?.participants)) return;
        let cancelled = false;
        const participantIds = conversation.participants.filter((participantId: unknown): participantId is string => typeof participantId === 'string' && participantId.trim().length > 0);
        const uniqueParticipantIds: string[] = Array.from(new Set(participantIds));
        const groupParticipantIds = uniqueParticipantIds.filter((participantId) => participantId !== user?.$id);
        const missingIds = groupParticipantIds.filter((participantId) => !senderProfiles[participantId] && !getCachedIdentityById(participantId));
        if (!missingIds.length) return;
        const hydrateMembers = (..._args: any[]) => hydrateMembers_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
        void hydrateMembers();
        return () => {
            cancelled = true;
        };
        }, [conversation?.participants, conversation?.type, senderProfiles, user?.$id, startTransition]);
    useEffect(() => {
        if (!conversationId || !user?.$id) return;
        if (initialLoadRef.current !== conversationId) {
            initialLoadRef.current = conversationId;
            setMessages([]);
            setMessagesLoading(true);
            const fromList = peekChatsListMemory().find(
                (c: any) => c.$id === conversationId || c.id === conversationId,
            );
            if (fromList) {
                setConversation(applyDisplayName(fromList));
            } else if (seedTitle) {
                setConversation((prev: any) =>
                    prev || {
                        $id: conversationId,
                        id: conversationId,
                        name: seedTitle,
                        title: seedTitle,
                        type: 'direct',
                        participants: [],
                    },
                );
            }
            void loadMessages();
            void loadConversation();
        }
        let unsub: any;
        const initRealtime = (..._args: any[]) => initRealtime_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
        initRealtime();
        return () => {
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [conversationId, user, user?.$id, loadConversation, loadMessages, startTransition, seedTitle, applyDisplayName]);
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearTimeout(recordingTimerRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (_) {}
            }
        };
    }, []);
    useEffect(() => {
        if (conversation?.isEncrypted && !isUnlocked && !unlockModalOpen) {
            setUnlockModalOpen(true);
        }
    }, [conversation?.isEncrypted, isUnlocked, unlockModalOpen]);
    useEffect(() => {
        if (!conversationId || !user?.$id) return;
        let unsub: any;
        const initRealtime = (..._args: any[]) => initRealtime_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
        void initRealtime();
        return () => {
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [conversationId, user?.$id, startTransition]);
    const [clearOptionsOpen, setClearOptionsOpen] = useState(false);
    const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
    const { open: openUnified } = useUnifiedDrawer();
    const handleClearChat = (..._args: any[]) => handleClearChat_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
    const handleExport = (..._args: any[]) => handleExport_ext({ handleExport, handleNoteSelect, seedConversationFromList });
    const _handleDeleteMessage = async (messageId: string, _everyone: boolean) => {
        try {
            if (_everyone) {
                await ChatService.deleteMessage(messageId);
            } else {
                alert("Individual 'Delete for Me' is coming soon. Use 'Clear Chat' for now.");
            }
        } catch (e: unknown) {
            console.error('Delete failed:', e);
        }
    };
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    const handleMessageContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
        e.preventDefault();
        setMessageAnchorEl({ el: e.currentTarget as HTMLElement, msg });
    };
    const handleReply = (msg: ChatMessage) => {
        setReplyingTo(msg);
        setMessageAnchorEl(null);
        const input = document.querySelector('textarea');
        if (input) (input as HTMLElement).focus();
    };
    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard");
        setMessageAnchorEl(null);
    };
    const handleReact = async (emoji: string) => {
        if (!messageAnchorEl?.msg || !user) return;
        try {
            await ChatService.reactToMessage(conversationId, messageAnchorEl.msg.$id, emoji);
            toast.success('Reaction sent');
        } catch (error) {
            console.error('Reaction failed:', error);
            toast.error('Failed to react');
        } finally {
            setMessageAnchorEl(null);
        }
    };
    const handleTogglePinMessage = async () => {
        if (!messageAnchorEl?.msg) return;
        const msg = messageAnchorEl.msg;
        setMessageAnchorEl(null);
        try {
            await ChatService.updateMessage(msg.$id, { isPinned: !msg.isPinned } as any);
            toast.success(msg.isPinned ? "Unpinned" : "Pinned message");
        } catch (_err) {
            toast.error("Failed to pin message");
        }
    };
    const handleSend = (..._args: any[]) => handleSend_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
    const _handleAttachClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleAttachClose = () => {
        setAnchorEl(null);
    };
    const handleFileSelect = (type: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = type;
            fileInputRef.current.click();
        }
        handleAttachClose();
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };
    const toggleRecording = (..._args: any[]) => toggleRecording_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
    const handleNoteSelect = (..._args: any[]) => handleNoteSelect_ext({ handleExport, handleNoteSelect, seedConversationFromList });
    const handleSecretSelect = (..._args: any[]) => handleSecretSelect_ext({ handleClearChat, handleSecretSelect, handleSend, hydrateMembers, hydrateSenders, initRealtime, toggleRecording });
    return <ChatWindowView {...({ _handleAttachClick, _handleDeleteMessage, _isPending, _loading, _partnerPresence, _searchParams, _setTypingUsers, _showFirstContactWarning, a, actor, anchorEl, applyDisplayName, atRest, atRestOrdered, attachAnchorEl, attachment, audioChunksRef, avatarUrl, base, blob, cached, cachedConv, cachedMessages, cancelled, chan, channel, chatSettingsOpen, clearOptionsOpen, clientReadSegments, closeReactionPopover, conv, convForDecrypt, conversation, conversationDisplayName, conversationId, conversationReadAt, cutoff, data, decryptedSettings, displayMessages, existing, fallback, fallbackIsSelf, fallbackName, fileInputRef, fromList, groupMentionTargets, groupParticipantIds, grouped, groups, handleAttachClose, handleClearChat, handleCopy, handleExport, handleFileSelect, handleMessageContextMenu, handleNoteSelect, handleReact, handleReply, handleSecretSelect, handleSend, handleTip, handleTogglePinMessage, hasRepliedToPartner, hit, hydrateMembers, hydrateSenders, hydrated, initRealtime, initialLoadRef, input, isMobile, isProPlan, isRecording, isSelf, isSelfBookmarks, isTyping, isUnlocked, layout, loadConversation, loadMessages, loadReactions, looksEncrypted, mediaRecorderRef, messageAnchorEl, messageReactions, messageSenderIds, messages, messagesEndRef, messagesLoading, metadata, missingIds, msg, myClearedAt, myName, myProfile, name, next, noteModalOpen, onBack, onFileChange, openReactionPopover, ordered, otherId, ownLinkPreviewsEnabled, ownOnlineEnabled, ownTypingEnabled, participantIds, partnerId, partnerOnlineEnabled, partnerProfile, partnerTypingEnabled, partnerVerification, pendingObject, pr, profile, reactionPopoverAnchorEl, reactionPopoverGroups, reactionPopoverMessage, reactionPopoverMessageId, reactionPopoverRows, reactionRows, reactionsByMessageId, readAt, recordingTimerRef, replyingTo, resolved, response, rosterHit, router, rows, scrollToBottom, secretModalOpen, seedTitle, senderProfiles, sending, setAnchorEl, setAttachAnchorEl, setAttachment, setChatSettingsOpen, setClearOptionsOpen, setConversation, setConversationReadAt, setIsRecording, setIsUnlocked, setLoading, setMessageAnchorEl, setMessageReactions, setMessages, setMessagesLoading, setNoteModalOpen, setOwnLinkPreviewsEnabled, setOwnOnlineEnabled, setOwnTypingEnabled, setPartnerOnlineEnabled, setPartnerPresence, setPartnerProfile, setPartnerTypingEnabled, setPartnerVerification, setPendingObject, setReactionPopoverAnchorEl, setReactionPopoverMessageId, setReplyingTo, setSecretModalOpen, setSenderProfiles, setSending, setUnlockModalOpen, settings, shouldReload, startTransition, t, theme, threadId, timeout, toggleRecording, type, typingTimeoutRef, typingUsers, uid, unlockModalOpen, unsub, unsubscribe, url, useSelf, username })} />;
};
