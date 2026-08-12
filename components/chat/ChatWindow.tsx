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
    Phone,
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
import { useCallLauncher } from '@/context/CallLauncherContext';
import MuralPattern from './MuralPattern';
import { IdentityAvatar, IdentityName } from '../common/IdentityBadge';
import { buildNoteAttachmentMetadata } from '@/lib/sdk';
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
import { ChatMessageContent } from './ChatMessageContent';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

export const ChatWindow = ({
    conversationId,
    onBack,
    layout = 'fill',
}: {
    conversationId: string;
    onBack?: () => void;
    /** fill = in-page / object detail (respects primary sidebar). fixed = legacy fullscreen. */
    layout?: 'fill' | 'fixed';
}) => {
    const { user } = useAuth();
    const { openProUpgrade } = useProUpgrade();
    const { markConversationRead: markConversationReadInContext } = useChatNotifications();
    const { openCallLauncher } = useCallLauncher();
    const { globalPresence} = usePresence();
    // Typing/online via Appwrite presence (ephemeral) — mutual prefs from profile.preferences (privacy tab)
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
    const [conversation, setConversation] = useState<any>(() => {
        const fromList = peekChatsListMemory().find(
            (c: any) => c.$id === conversationId || c.id === conversationId,
        );
        return fromList || null;
    });
    const [_loading, setLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [attachAnchorEl, setAttachAnchorEl] = useState<null | HTMLElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const { openOverlay, closeOverlay } = useOverlay();
    const [_isPending, startTransition] = useTransition();
    const isProPlan = hasPaidKylrixPlan(user);
    const { openWalletWithIntent } = useWalletOverlay();
    const searchParams = useSearchParams();
    const startCallParam = searchParams.get('startCall');
    const callInitiatedRef = useRef(false);

    useEffect(() => {
        if (conversation && startCallParam === '1' && !callInitiatedRef.current) {
            callInitiatedRef.current = true;
            openCallLauncher({
                source: 'chat',
                conversationId,
                conversationName: conversation?.name,
                participantIds: Array.isArray(conversation?.participants) ? conversation.participants : [],
                title: 'Audio Call'});
        }
    }, [conversation, startCallParam, conversationId, openCallLauncher]);

    const partnerId = useMemo(() => {
        if (!conversation || conversation.type !== 'direct' || !user?.$id) return null;
        return conversation.participants.find((p: string) => p !== user.$id) || null;
    }, [conversation, user?.$id]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    const loadConversation = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            const cachedConv = await LocalEngine.cacheGet<any>(chatConversationCacheKey(conversationId));
            if (cachedConv?.$id || cachedConv?.id) {
                startTransition(() => setConversation(cachedConv));
            }

            if (ecosystemSecurity.status.isUnlocked) {
                void UsersService.forceSyncProfileWithIdentity(user);
            }
            let conv: any = null;
            try {
              conv = await ChatService.getConversationById(conversationId, user.$id);
              if (!conv) throw new Error('Conversation not found');
            } catch (e) {
              // Not a secure conversation — maybe a thread/discussion hangout. Fallback to thread + local roster cache.
              try {
                const rosterHit = (await import('@/lib/chat/local-chat-cache')).peekChatsListMemory?.().find((c: any) => c.$id === conversationId || c.id === conversationId)
                  || (await import('@/lib/chat/local-chat-cache')).peekThreadsListMemory?.().find((c: any) => c.$id === conversationId || c.id === conversationId)
                  || null;
                if (rosterHit) {
                  const fallbackName = rosterHit.name || rosterHit.title || rosterHit.lastMessageText || 'Thread';
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
                  const fallbackName = t.title || 'Thread';
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
                        const next = {
                            ...conv,
                            name: profile ? (profile.displayName || profile.username) : `@${otherId.slice(0, 7)}`,
                            avatarUrl
                        };
                        startTransition(() => setConversation(next));
                        void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), next);
                    } catch (_e: unknown) {
                        startTransition(() => {
                            setPartnerProfile(null);
                            setPartnerVerification(getVerificationState(null));
                            setConversation({ ...conv, name: `@${otherId.slice(0, 7)}` });
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
                    const next = { ...conv, name: `${myName} (You)`, avatarUrl };
                    startTransition(() => setConversation(next));
                    void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), next);
                }
            } else {
                startTransition(() => {
                    setPartnerProfile(null);
                    setPartnerVerification(getVerificationState(null));
                    setConversation(conv);
                });
                void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), conv);
            }

            // Pre-warm & self-heal keys automatically when opening chat — prompt unlock if sealed material
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
    }, [conversationId, user, startTransition]);

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
            // Paint ciphertext cache immediately — never block shell on decrypt / network
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
            // Fix: always fetch messages even if conv is null (permission/typing bug hid messages while preview worked). Participants both have read perms on create.
            let response: any = null;
            try {
              console.log('[ChatWindow] loadMessages: conversation fetched:', conv?.$id || 'null — still fetching messages');
              response = await ChatService.getMessages(conversationId, 50, 0, user?.$id, {
                  prefetchedConversation: conv || undefined});
            } catch (e) {
              console.warn('[ChatWindow] getMessages failed, will try thread fallback', e);
            }
            if (response) console.log('[ChatWindow] loadMessages: getMessages returned rows:', response?.rows?.length);
            // Thread fallback — canonical threads substrate (notes → threads/thread_messages, not conversations)
            // Use client-ops (server actions via Registry/JWT), NOT direct ThreadService (which needs APPWRITE_API system client)
            // Bookmarks/discussion hangouts are thread notes (isthreadChat) bridged to threads via scopeKey parentKind:parentId:channel + legacyNoteId
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

            // Filter by clearedAt if exists in settings
            let displayMessages = response.rows;
            let atRest = (response as any).atRestRows || response.rows;
            if (user && conv?.settings) {
                try {
                    // Guard: settings may be plaintext JSON or empty; decrypt only if looks encrypted and vault unlocked
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

            // Reverse once for display order (bottom is newest)
            const ordered = displayMessages.reverse() as unknown as ChatMessage[];
            const atRestOrdered = [...atRest].reverse();
            startTransition(() => {
                setMessages(ordered);
            });
            // Persist ciphertext only for encrypted chats — never decrypted plaintext at rest
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

    // Prompt vault unlock when opening sealed conversation — listing is plaintext, content is gated per WESP
    useEffect(() => {
        if (conversation?.isEncrypted && !isUnlocked) {
            void promptSudo();
        }
    }, [conversation?.isEncrypted, isUnlocked, promptSudo]);

    // Privacy prefs — typing/online (default true, mutual, direct-only, stored in profile.preferences)
    useEffect(() => {
        if (!user?.$id) return;
        UsersService.getProfileById(user.$id).then((p: any) => {
            try { const pr = typeof p?.preferences === 'string' ? JSON.parse(p.preferences) : p?.preferences || {}; setOwnTypingEnabled(pr.typingEnabled ?? true); setOwnOnlineEnabled(pr.onlineEnabled ?? true); } catch {}
        }).catch(() => {});
    }, [user?.$id]);

    useEffect(() => {
        const otherId = conversation?.type === 'direct' ? (conversation?.participants || []).find((id: string) => id !== user?.$id) : null;
        if (!otherId || conversation?.type !== 'direct') { setPartnerTypingEnabled(true); setPartnerOnlineEnabled(true); return; }
        UsersService.getProfileById(otherId).then((p: any) => {
            try { const pr = typeof p?.preferences === 'string' ? JSON.parse(p.preferences) : p?.preferences || {}; setPartnerTypingEnabled(pr.typingEnabled ?? true); setPartnerOnlineEnabled(pr.onlineEnabled ?? true); } catch {}
        }).catch(() => {});
    }, [conversation?.participants, conversation?.type, user?.$id]);

    // Typing via Appwrite presence — ephemeral, no DB writes, direct+mutual only, groups suppressed
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

    // Online via Appwrite presence — direct+mutual only, groups suppressed, no DB polling
    useEffect(() => {
        const otherId = conversation?.type === 'direct' ? (conversation?.participants || []).find((id: string) => id !== user?.$id) : null;
        if (conversation?.type !== 'direct' || !otherId || !ownOnlineEnabled || !partnerOnlineEnabled) { setPartnerPresence(null); return; }
        const chan = PresenceService.getResourceChannel('presence', 'users', otherId);
        const unsub = PresenceService.subscribeToPresence(chan, (payload: any) => {
            setPartnerPresence(payload?.state === 'online' ? payload : null);
        });
        // also broadcast own online
        void PresenceService.broadcastState(PresenceService.getResourceChannel('presence','users', user?.$id || 'anon'), { userId: user?.$id || '', state: 'online' as any });
        return () => { try { (unsub as any)?.(); } catch {} };
    }, [conversation?.participants, conversation?.type, ownOnlineEnabled, partnerOnlineEnabled, user?.$id]);

    useEffect(() => {
        if (!messageSenderIds.length) return;

        let cancelled = false;

        const hydrateSenders = async () => {
            const missingIds = messageSenderIds.filter((senderId) => {
                const cached = senderProfiles[senderId] || getCachedIdentityById(senderId);
                const hasRenderableAvatar = Boolean(
                    senderProfiles[senderId]?.avatarUrl ||
                    (cached?.avatar && cached.avatar.startsWith?.('http'))
                );

                return !cached || !hasRenderableAvatar;
            });
            if (!missingIds.length) return;

            const resolved = await Promise.all(missingIds.map(async (senderId) => {
                try {
                    const profile = await UsersService.getProfileById(senderId);
                    if (!profile) return null;

                    let avatarUrl: string | null = null;
                    if (profile?.avatar?.startsWith?.('http')) {
                        avatarUrl = profile.avatar;
                    } else if (profile?.avatar) {
                        try {
                            const url = await fetchProfilePreview(profile.avatar, 48, 48);
                            avatarUrl = url as unknown as string;
                        } catch (_e) {}
                    }

                    const normalized = seedIdentityCache({ ...profile, avatar: profile?.avatar || avatarUrl });
                    if (!normalized) return null;

                    return {
                        senderId,
                        profile: {
                            displayName: normalized.displayName,
                            username: normalized.username,
                            avatar: normalized.avatar,
                            avatarUrl,
                            preferences: normalized.preferences} as SenderProfile};
                } catch (_e) {
                    return null;
                }
            }));

            if (cancelled) return;

            startTransition(() => {
                setSenderProfiles((prev) => {
                    const next = { ...prev };
                    resolved.forEach((entry) => {
                        if (entry?.profile) {
                            next[entry.senderId] = entry.profile;
                        }
                    });
                    return next;
                });
            });
        };

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

        const hydrateMembers = async () => {
            const resolved = await Promise.all(missingIds.map(async (participantId) => {
                try {
                    const profile = await UsersService.getProfileById(participantId);
                    if (!profile) return null;

                    let avatarUrl: string | null = null;
                    if (profile?.avatar?.startsWith?.('http')) {
                        avatarUrl = profile.avatar;
                    } else if (profile?.avatar) {
                        try {
                            const url = await fetchProfilePreview(profile.avatar, 48, 48);
                            avatarUrl = url as unknown as string;
                        } catch (_e) {}
                    }

                    const normalized = seedIdentityCache({ ...profile, avatar: profile?.avatar || avatarUrl });
                    if (!normalized) return null;

                    return {
                        participantId,
                        profile: {
                            displayName: normalized.displayName,
                            username: normalized.username,
                            avatar: normalized.avatar,
                            avatarUrl,
                            preferences: normalized.preferences} as SenderProfile};
                } catch (_e) {
                    return null;
                }
            }));

            if (cancelled) return;

            startTransition(() => {
            startTransition(() => {
                setSenderProfiles((prev) => {
                    const next = { ...prev };
                    resolved.forEach((entry) => {
                        if (entry?.profile) {
                            next[entry.participantId] = entry.profile;
                        }
                    });
                    return next;
                });
            });
            });
        };

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
            if (fromList) setConversation(fromList);
            void loadMessages();
            void loadConversation();
        }
        let unsub: any;
        const initRealtime = async () => {
            unsub = await realtime.subscribe(
                [`databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`],
                async (response) => {
                    const payload = response.payload as ChatMessage;
                    if (payload.conversationId === conversationId) {
                        if (response.events.some(e => e.includes('.create')) || response.events.some(e => e.includes('.update'))) {
                            if (user && payload.senderId === user.$id && response.events.some(e => e.includes('.create'))) return;

                            const isEncrypted = ecosystemSecurity.status.isUnlocked && (
                                (payload.type === MessagesType.TEXT && payload.content && payload.content.length > 40)
                            );

                            if (isEncrypted) {
                                try {
                                    const decrypt = async (val: string) => {
                                        return await ecosystemSecurity.decrypt(val);
                                    };

                                    if (payload.type === MessagesType.TEXT && payload.content && payload.content.length > 40) {
                                        payload.content = await decrypt(payload.content);
                                    }
                                } catch (_e: unknown) { }
                            }

                            if (response.events.some(e => e.includes('.create'))) {
                                startTransition(() => {
                                    setMessages(prev => {
                                        const withoutOptimistic = prev.filter(m => {
                                            const isOptimistic = m.$id && String(m.$id).startsWith('optimistic-');
                                            if (isOptimistic) return m.content !== payload.content;
                                            return true;
                                        });
                                        if (withoutOptimistic.some(m => m.$id === payload.$id)) return withoutOptimistic;
                                        return [...withoutOptimistic, payload];
                                    });
                                });
                                setTimeout(() => scrollToBottom(), 100);
                            } else {
                                startTransition(() => {
                                    setMessages(prev => prev.map(m => m.$id === payload.$id ? payload : m));
                                });
                            }
                        } else if (response.events.some(e => e.includes('.delete'))) {
                            startTransition(() => {
                                setMessages(prev => prev.filter(m => m.$id === payload.$id));
                            });
                        }
                    }
                }
            );
        };

        initRealtime();

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [conversationId, user, user?.$id, loadConversation, loadMessages, startTransition]);

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
        const initRealtime = async () => {
            unsub = await realtime.subscribe(
                [`databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`],
                async (response) => {
                    const payload = response.payload as Partial<ChatReaction>;
                    if (payload?.conversationId !== conversationId) return;

                    if (response.events.some((event) => event.includes('.delete'))) {
                        if (!payload.messageId) return;
                        startTransition(() => {
                            setMessageReactions((prev) => {
                                const next = { ...prev };
                                const existing = next[payload.messageId || ''] || [];
                                const filtered = existing.filter((reaction) => reaction.$id !== payload.$id);
                                if (filtered.length) next[payload.messageId || ''] = filtered;
                                else delete next[payload.messageId || ''];
                                return next;
                            });
                        });
                        return;
                    }

                    if (!payload.messageId || !payload.$id) return;
                    startTransition(() => {
                        setMessageReactions((prev) => {
                            const next = { ...prev };
                            const existing = next[payload.messageId as string] || [];
                            const filtered = existing.filter((reaction) => reaction.$id !== payload.$id);
                            next[payload.messageId as string] = [...filtered, payload as ChatReaction];
                            return next;
                        });
                    });
                }
            );
        };

        void initRealtime();

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [conversationId, user?.$id, startTransition]);

    const [clearOptionsOpen, setClearOptionsOpen] = useState(false);
    const [chatSettingsOpen, setChatSettingsOpen] = useState(false);

    const { open: openUnified } = useUnifiedDrawer();

    const handleClearChat = async (mode: 'me' | 'everyone' | 'nuclear') => {
        if (!conversationId) return;
        const currentUserId = user?.$id;
        if (!currentUserId) return;
        setClearOptionsOpen(false);
        setAnchorEl(null);

        const confirmData = {
            me: {
                title: 'Clear chat for yourself?',
                description: 'This will remove the chat history from your local view only. The other participant will still see the messages.',
                confirmLabel: 'Clear for Me'
            },
            everyone: {
                title: 'Clear chat for everyone?',
                description: 'This will remove your messages and reactions for everyone in this chat. This action is permanent.',
                confirmLabel: 'Wipe Footprint'
            },
            nuclear: {
                title: 'Permanently delete conversation for everyone?',
                description: 'Critical: This will permanently delete the conversation, members, encryption keys, messages and reactions for all participants. This cascade cannot be undone.',
                confirmLabel: 'Permanently delete'
            }
        }[mode];

        openUnified('delete-confirm', {
            ...confirmData,
            resourceName: 'this conversation',
            onConfirm: async () => {
                setLoading(true);
                try {
                    if (mode === 'me') {
                        await ChatService.clearChatForMe(conversationId, currentUserId);
                        toast.success("Chat cleared for you");
                    } else if (mode === 'everyone') {
                        const res = await ChatService.wipeMyFootprint(conversationId, currentUserId);
                        toast.success(`Removed ${res.count} messages and ${res.reactionsDeleted || 0} reactions for everyone`);
                    } else if (mode === 'nuclear') {
                        const wipeRes: any = await ChatService.nuclearWipe(conversationId);
                        const newId = wipeRes?.regeneratedConversationId;
                        if (newId) {
                          toast.success("Self-chat wiped & fresh room regenerated");
                          try {
                            const { LocalEngine } = await import('@/lib/services/LocalEngine');
                            const { chatConversationCacheKey, chatMessagesCacheKey } = await import('@/lib/chat/local-chat-cache');
                            await LocalEngine.cacheSet(chatConversationCacheKey(conversationId), null as any).catch(() => null);
                            await LocalEngine.cacheSet(chatMessagesCacheKey(conversationId), []).catch(() => null);
                          } catch {}
                          router.push(`/connect/chats?c=${encodeURIComponent(newId)}`);
                        } else {
                          toast.success("Conversation permanently wiped");
                          try {
                            const { LocalEngine } = await import('@/lib/services/LocalEngine');
                            const { chatConversationCacheKey, chatMessagesCacheKey } = await import('@/lib/chat/local-chat-cache');
                            await LocalEngine.cacheSet(chatConversationCacheKey(conversationId), null as any).catch(() => null);
                            await LocalEngine.cacheSet(chatMessagesCacheKey(conversationId), []).catch(() => null);
                          } catch {}
                          router.push('/connect/chats');
                        }
                        return;
                    }
                    await loadMessages();
                } catch (error) {
                    console.error('Clear chat failed:', error);
                    toast.error("Failed to clear chat");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleExport = async () => {
        const data = messages.map(m => ({
            sender: m.senderId === user?.$id ? 'Me' : 'Partner',
            time: m.$createdAt,
            content: m.content,
            type: m.type
        }));

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_export_${conversationId}.json`;
        a.click();
        setAnchorEl(null);
    };

    const _handleDeleteMessage = async (messageId: string, _everyone: boolean) => {
        try {
            if (_everyone) {
                await ChatService.deleteMessage(messageId);
            } else {
                // Individual 'delete for me' would require a schema change (deletedBy array)
                // For now, we only support 'delete for everyone' if author.
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
        // Focus input
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

    const handleSend = async (text: string) => {
        if ((!text.trim() && !attachment) || !user || sending) return false;

        // Ensure vault is unlocked before sending in an encrypted conversation
        if (conversation?.isEncrypted && !isUnlocked) {
            setUnlockModalOpen(true);
            return false;
        }

        const file = attachment;
        const replyToId = replyingTo?.$id;
        const previousReplyingTo = replyingTo;

        setAttachment(null);
        setReplyingTo(null);
        setSending(true);

        let type: any = MessagesType.TEXT;
        const initialAttachments: string[] = [];
        if (file) {
            if (file.type.startsWith('image/')) type = MessagesType.IMAGE;
            else if (file.type.startsWith('video/')) type = MessagesType.VIDEO;
            else if (file.type.startsWith('audio/')) type = MessagesType.AUDIO;
            else type = MessagesType.FILE;
        }

        // Optimistic UI Update: Add the plaintext message to the local state immediately
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMessage: any = {
            $id: optimisticId,
            conversationId,
            senderId: user.$id,
            content: text,
            type,
            attachments: initialAttachments,
            $createdAt: new Date().toISOString(),
            status: 'sending'
        };

        startTransition(() => {
            setMessages(prev => [...prev, optimisticMessage]);
        });
        setTimeout(() => scrollToBottom(), 50);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        try {
            const isThreadHangout = !!(conversation as any)?.isThreadFallback || (conversation as any)?.type === 'thread' || !!(conversation as any)?.isthreadChat || !!(conversation as any)?.isSelfBookmarks || (()=>{ try { const mem:any[]=(require('@/lib/chat/local-chat-cache') as any).peekThreadsListMemory?.()||[]; return !!mem.find((c:any)=>c.$id===conversationId||c.id===conversationId); } catch { return false; } })() || !conversation;
            if (isThreadHangout) {
                // Thread/discussion hangout — NOT conversations/messages table.
                // Underlying substrate is notes/idea → threads/thread_messages (canonical) with legacy comments fallback.
                // Mirrors project discussion: ensure thread then post (bottom-up: thread_messages, not conversations).
                let actualAttachments = initialAttachments;
                if (file) {
                    const bucketId = StorageService.getBucketForType(type);
                    const uploaded = await StorageService.uploadFile(file, bucketId);
                    actualAttachments = [uploaded.$id];
                }
                const { getOrCreateThread, postThreadMessage } = await import('@/lib/actions/client-ops');
                let threadId = conversationId;
                try {
                    const isSelfForSend = !!(conversation as any)?.isSelfBookmarks || (()=>{ try { const mem:any[]=(require('@/lib/chat/local-chat-cache') as any).peekThreadsListMemory?.()||[]; const hit=mem.find((c:any)=>c.$id===conversationId||c.id===conversationId); return !!hit?.isSelfBookmarks; } catch { return false; } })();
                    const parentKind: any = isSelfForSend ? 'user' : 'chat';
                    const parentId: any = isSelfForSend ? user.$id : conversationId;
                    const channel: any = isSelfForSend ? 'bookmarks' : 'general';
                    const ensured: any = await getOrCreateThread({
                        parentKind,
                        parentId,
                        channel,
                        title: (conversation as any)?.name || (conversation as any)?.title || (isSelfForSend ? 'Bookmarks' : 'Huddle'),
                        legacyNoteId: conversationId,
                    } as any);
                    threadId = ensured?.thread?.id || threadId;
                } catch {}
                const sent: any = await postThreadMessage({ threadId, content: text });
                const messageForState = {
                    $id: sent.id || sent.$id,
                    id: sent.id || sent.$id,
                    conversationId,
                    senderId: user.$id,
                    content: text,
                    type,
                    attachments: actualAttachments,
                    $createdAt: sent.createdAt || sent.$createdAt || new Date().toISOString(),
                    createdAt: sent.createdAt || sent.$createdAt || new Date().toISOString(),
                    status: 'sent',
                } as unknown as ChatMessage;
                startTransition(() => {
                    setMessages(prev => prev.map(m => m.$id === optimisticId ? messageForState : m));
                });
                // also persist to thread_messages cache if needed via loadMessages refresh
                void loadMessages();
                return true;
            }

            let actualAttachments = initialAttachments;
            if (file) {
                const bucketId = StorageService.getBucketForType(type);
                const uploaded = await StorageService.uploadFile(file, bucketId);
                actualAttachments = [uploaded.$id];
            }

            const sentMessage = await ChatService.sendMessage(conversationId, user.$id, text, type, actualAttachments, replyToId);

            // Replace optimistic message with the real one (green SyncStatusDot)
            const messageForState = {
                ...sentMessage,
                content: text,
                status: 'sent',
            } as unknown as ChatMessage;
            startTransition(() => {
                setMessages(prev => prev.map(m => m.$id === optimisticId ? messageForState : m));
            });
        } catch (error: unknown) {
            console.error('Failed to send message:', error);
            // Mark optimistic message as failed
            startTransition(() => {
                setMessages(prev => prev.map(m => m.$id === optimisticId ? ({ ...m, status: 'error' } as any) : m));
            });
            setAttachment(file);
            setReplyingTo(previousReplyingTo);
            return false;
        } finally {
            setSending(false);
        }

        return true;
    };

    const handleCall = (type: 'audio' | 'video' = 'audio') => {
        openCallLauncher({
            source: 'chat',
            conversationId,
            conversationName: conversation?.name,
            participantIds: Array.isArray(conversation?.participants) ? conversation.participants : [],
            title: type === 'audio' ? 'Audio Call' : 'Video Call'});
    };

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

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (recordingTimerRef.current) {
                clearTimeout(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // Start recording
            if (!hasPaidKylrixPlan(user)) {
                openProUpgrade('Voice recording');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Heavily compress voice note on client side (16kbps bitrate & Opus format)
                let options = { audioBitsPerSecond: 16000 };
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    (options as any).mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    (options as any).mimeType = 'audio/ogg;codecs=opus';
                }
                
                const mediaRecorder = new MediaRecorder(stream, options);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    if (recordingTimerRef.current) {
                        clearTimeout(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                    
                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());

                    // Send the audio file — branch on substrate (thread thread vs secure conversation)
                    setSending(true);
                    try {
                        const uploaded = await StorageService.uploadFile(audioFile, StorageService.getBucketForType('audio'));
                        const isThreadHangoutVoice = !!(conversation as any)?.isThreadFallback || (conversation as any)?.type === 'thread' || !!(conversation as any)?.isthreadChat || !!(conversation as any)?.isSelfBookmarks;
                        if (isThreadHangoutVoice) {
                            const { getOrCreateThread, postThreadMessage } = await import('@/lib/actions/client-ops');
                            let threadId: any = conversationId;
                            try {
                                const parentKind: any = (conversation as any)?.isSelfBookmarks ? 'user' : 'chat';
                                const parentId: any = (conversation as any)?.isSelfBookmarks ? user?.$id : conversationId;
                                const channel: any = (conversation as any)?.isSelfBookmarks ? 'bookmarks' : 'general';
                                const ensured: any = await getOrCreateThread({ parentKind, parentId, channel, title: (conversation as any)?.name || 'Bookmarks', legacyNoteId: conversationId } as any);
                                threadId = ensured?.thread?.id || threadId;
                            } catch {}
                            await postThreadMessage({ threadId, content: `__voice_note__:${uploaded.$id}` } as any);
                        } else {
                            await ChatService.sendMessage(conversationId, user?.$id || '', 'Voice Message', 'audio', [uploaded.$id]);
                        }
                    } catch (error) {
                        console.error('Failed to send voice note:', error);
                    } finally {
                        setSending(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);

                // Audio length limit removed for Pro/Teams users.

            } catch (err) {
                console.error("Failed to start recording:", err);
                alert("Microphone access is required for voice notes.");
            }
        }
    };

    const handleNoteSelect = async (note: any) => {
        if (!user) return;
        setSending(true);
        try {
            const metadata = buildNoteAttachmentMetadata(note) as AttachmentMetadata;
            await ChatService.sendMessage(
                conversationId,
                user.$id,
                note.title || 'Attached Note',
                'attachment',
                [note.$id],
                undefined,
                metadata
            );
        } catch (error: unknown) {
            console.error('Failed to send note:', error);
            toast.error("Failed to attach note");
        } finally {
            setSending(false);
        }
    };

    const handleSecretSelect = async (item: any, type: 'secret' | 'totp') => {
        if (!user) return;
        setSending(true);
        try {
            if (type === 'totp') {
                const metadata: AttachmentMetadata = {
                    type: 'attachment',
                    entity: 'vault',
                    subType: 'totp',
                    referenceId: item.$id,
                    payload: {
                        label: item.issuer || item.name || 'TOTP',
                        currentCode: item.currentCode,
                        nextCode: item.nextCode, // Assuming this is passed or can be generated
                        expiry: new Date(Date.now() + 30000).toISOString()
                    }
                };
                await ChatService.sendMessage(
                    conversationId,
                    user.$id,
                    `TOTP: ${item.issuer || 'Unknown'}`,
                    'attachment',
                    [item.$id],
                    undefined,
                    metadata
                );
            } else {
                const metadata: AttachmentMetadata = {
                    type: 'attachment',
                    entity: 'vault',
                    subType: 'password',
                    referenceId: item.$id,
                    payload: {
                        label: item.name || 'Shared Password',
                        preview: '••••••••'
                    }
                };
                await ChatService.sendMessage(
                    conversationId,
                    user.$id,
                    `Secret: ${item.name || 'Unnamed'}`,
                    'attachment',
                    [item.$id],
                    undefined,
                    metadata
                );
            }
        } catch (error: unknown) {
            console.error('Failed to send secret/totp:', error);
            toast.error("Failed to attach secret");
        } finally {
            setSending(false);
        }
    };



    // Always paint mural + header + composer. Never blank the shell waiting on messages.
    return (
        <Box sx={{
            bgcolor: '#0A0908',
            position: layout === 'fill' ? 'absolute' : 'fixed',
            top: layout === 'fill' ? 0 : '88px',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: layout === 'fill' ? 1 : 1200,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'}}>

            <MuralPattern />
            <AppBar position="absolute" color="transparent" elevation={0} sx={{ 
                top: 0,
                left: 0,
                right: 0,
                borderBottom: '1px solid #1C1A18', 
                bgcolor: '#0A0908',
                zIndex: 10,
                pt: 'env(safe-area-inset-top)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'}}>
                <Toolbar sx={{ gap: 1, minHeight: '72px' }}>
                    <IconButton edge="start" onClick={() => (onBack ? onBack() : router.back())} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: '#161412' } }}>
                        <ChevronLeft size={20} strokeWidth={2} />
                    </IconButton>
                    <Box
                        onClick={() => {
                            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
                            const isGroup = conversation?.type === 'group' || conversation?.type === 'channel';
                            const uid = isGroup ? null : partnerId;
                            const node = (
                              <ProfileSidebar
                                userId={uid}
                                username={partnerProfile?.username}
                                conversationId={conversationId}
                                conversation={conversation}
                                seed={isGroup ? null : {
                                  displayName: partnerProfile?.displayName || conversation?.name,
                                  username: partnerProfile?.username,
                                  bio: partnerProfile?.bio,
                                  avatar: partnerProfile?.avatar || conversation?.avatarUrl,
                                }}
                                onClose={isDesktop ? closeSidebar : closeOverlay}
                              />
                            );
                            const key = `profile-${uid || partnerProfile?.username || conversationId}`;
                            if (isDesktop) openSidebar(node, key, { hideHeader: true });
                            else openOverlay(node);
                        }}
                        sx={{ display: 'flex', items: 'center', gap: 1.5, flex: 1, cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                    >
                        <IdentityAvatar 
                            userId={isSelf ? user?.$id : partnerId}
                            src={
                                conversation?.avatarUrl?.startsWith?.('http')
                                    ? conversation.avatarUrl
                                    : null
                            }
                            fileId={
                                conversation?.avatarUrl?.startsWith?.('http')
                                    ? null
                                    : (conversation?.avatar || conversation?.avatarUrl || null)
                            }
                            alt={conversation?.name}
                            fallback={
                                (conversation?.name || user?.name || 'Y')
                                    .replace(/\(You\)/gi, '')
                                    .replace(/^@/, '')
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase() || 'Y'
                            }
                            size={38}
                        />
                        <Box>
                            {conversation?.type === 'direct' && !isSelf ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <IdentityName
                                        verified={partnerVerification.verified}
                                        sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: '#fff', fontSize: '1rem' }}
                                    >
                                        {conversation?.name || 'Loading...'}
                                    </IdentityName>
                                    {conversation?.isEncrypted ? (
                                        <Lock size={13} strokeWidth={2.5} color="#F59E0B" aria-label="Secure chat" />
                                    ) : null}
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: isSelf ? '#6366F1' : '#fff', fontSize: '1rem' }}>
                                        {conversation?.name || 'Loading...'}
                                    </Typography>
                                    {conversation?.isEncrypted ? (
                                        <Lock size={13} strokeWidth={2.5} color="#F59E0B" aria-label="Secure chat" />
                                    ) : null}
                                </Box>
                            )}
                            {conversation?.type === 'group' && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                                    {(conversation?.participantCount || conversation?.participants?.length || 0)} members
                                </Typography>
                            )}
                            {!isSelf && conversation?.type === 'direct' && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {(() => {
                                        const otherId = conversation.participants.find((p: string) => p !== user?.$id);
                                        const otherPresence = globalPresence?.[otherId];
                                        if (!otherPresence) return 'Offline';

                                        const isOnline = otherPresence.state === 'online' && (Date.now() - new Date(otherPresence.lastSeen || 0).getTime() < 1000 * 60 * 5);

                                        if (isOnline) return (
                                            <>
                                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1' }} />
                                                Online
                                            </>
                                        );
                                        return 'Offline';
                                    })()}
                                </Typography>
                            )}
                            {isSelf && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 700, fontSize: '0.75rem' }}>
                                    Secured Cloud
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ pointerEvents: 'auto' }}>
                        {!isSelf && (
                            <IconButton onClick={() => handleCall('audio')} sx={{ color: 'text.secondary' }}>
                                <Phone size={20} strokeWidth={1.5} />
                            </IconButton>
                        )}
                        <IconButton
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
                                if (isDesktop) {
                                  const node = (
                                    <ChatSettingsPanel
                                      conversation={conversation}
                                      conversationId={conversationId}
                                      isSelf={!!isSelf}
                                      messages={messages}
                                      onClose={closeSidebar}
                                      onExport={handleExport}
                                      onClearMe={() => handleClearChat('me')}
                                      onClearEveryone={() => handleClearChat('everyone')}
                                      onNuclear={() => handleClearChat('nuclear')}
                                    />
                                  );
                                  openSidebar(node, `chat-settings-${conversationId}`, { hideHeader: true });
                                } else {
                                  // Mobile: bottom drawer z-[1401] per chrome-surfaces / openbricks opaque
                                  setChatSettingsOpen(true);
                                }
                            }}
                            sx={{ color: 'text.secondary', pointerEvents: 'auto', position: 'relative', zIndex: 2 }}
                            aria-label="Hangout settings"
                            // ensure hit area above AppBar stacking context trap
                        >
                            <MoreVertical size={20} strokeWidth={1.5} />
                        </IconButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Clear Options Drawer */}
            <Drawer
                anchor="bottom"
                open={clearOptionsOpen}
                onClose={() => setClearOptionsOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#161412',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '24px 24px 0 0',
                        p: 3,
                        pb: isMobile ? 6 : 4,
                        zIndex: 2000}
                }}
            >
                <Box sx={{ maxWidth: 500, mx: 'auto', width: '100%' }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 900, mb: 1 }}>Clear Chat</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', mb: 3 }}>
                        Choose how you want to clear the messages in this conversation.
                    </Typography>
                    
                    <Stack gap={1.5}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => handleClearChat('me')}
                            sx={{ 
                                py: 1.5, 
                                borderRadius: '14px', 
                                color: 'white', 
                                borderColor: 'rgba(255,255,255,0.1)',
                                textTransform: 'none',
                                fontWeight: 700,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                        >
                            For Me (Soft Delete)
                        </Button>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => handleClearChat('everyone')}
                            sx={{ 
                                py: 1.5, 
                                borderRadius: '14px', 
                                bgcolor: '#ff4d4d', 
                                color: 'white', 
                                textTransform: 'none',
                                fontWeight: 800,
                                '&:hover': { bgcolor: '#ff3333' }
                            }}
                        >
                            For Everyone (Messages + Reactions)
                        </Button>
                        {conversation?.type === 'direct' && (
                            <Button
                                fullWidth
                                onClick={() => handleClearChat('nuclear')}
                                sx={{ color: '#ff4d4d', textTransform: 'none', fontWeight: 800, mt: 0.5 }}
                            >
                                Permanently delete for everyone
                            </Button>
                        )}
                        <Button
                            fullWidth
                            onClick={() => setClearOptionsOpen(false)}
                            sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none', fontWeight: 600, mt: 1 }}
                        >
                            Cancel
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            {/* Hangout settings: mobile bottom drawer z-[1401] / desktop via NativeSidebarBridge */}
            {chatSettingsOpen && (
              <Drawer
                anchor="bottom"
                open={chatSettingsOpen}
                onClose={() => setChatSettingsOpen(false)}
                keepMounted={false}
                disablePortal={true}
                slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.5)' } } }}
                PaperProps={{
                  sx: {
                    bgcolor: '#0A0908',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '24px 24px 0 0',
                    maxHeight: '86dvh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1401,
                  },
                }}
              >
                <ChatSettingsPanel
                  conversation={conversation}
                  conversationId={conversationId}
                  isSelf={!!isSelf}
                  messages={messages}
                  onClose={() => setChatSettingsOpen(false)}
                  onExport={() => { handleExport(); setChatSettingsOpen(false); }}
                  onClearMe={() => { setChatSettingsOpen(false); handleClearChat('me'); }}
                  onClearEveryone={() => { setChatSettingsOpen(false); handleClearChat('everyone'); }}
                  onNuclear={() => { setChatSettingsOpen(false); handleClearChat('nuclear'); }}
                />
              </Drawer>
            )}

            {/* Messages Area */}
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2.5, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2, pb: 'calc(128px + env(safe-area-inset-bottom))', pt: 'calc(84px + env(safe-area-inset-top))', position: 'relative', zIndex: 2 }}>
                {!isUnlocked && conversation?.isEncrypted && (
                    <Box sx={{ p: 2.5, mb: 2, bgcolor: '#161412', borderRadius: '24px', border: '1px solid #1C1A18', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 800, color: '#6366F1', fontFamily: 'var(--font-clash)', fontSize: '1rem' }}>
                            End-to-End Encrypted Channel
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => setUnlockModalOpen(true)}
                            startIcon={<Key size={16} strokeWidth={2} />}
                            sx={{ 
                                borderRadius: '12px', 
                                fontWeight: 900,
                                bgcolor: '#6366F1',
                                color: '#fff',
                                textTransform: 'none',
                                px: 3,
                                '&:hover': {
                                    bgcolor: '#575CF0'}
                            }}
                        >
                            Unlock to Read
                        </Button>
                    </Box>
                )}
                {messagesLoading && messages.length === 0 ? (
                    <div className="flex flex-col gap-3 py-2 animate-pulse">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className="h-12 w-[55%] rounded-2xl bg-white/[0.04] border border-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {messages.map((msg, index) => (
                        <React.Fragment key={msg.$id}>
                            {index === clientReadSegments.firstUnreadIncomingIndex && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                    <Box sx={{ px: 2, py: 0.6, borderRadius: '999px', bgcolor: '#161412', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                                            Unread payload
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                        {(() => {
                            const isOutgoing = msg.senderId === user?.$id;
                            const senderProfile = senderProfiles[msg.senderId] || getCachedIdentityById(msg.senderId);
                            const senderVerification = getVerificationState(senderProfile?.preferences || null);
                            const senderName = isOutgoing
                                ? 'You'
                                : senderProfile?.displayName || senderProfile?.username || (conversation?.type === 'direct' ? conversation?.name || 'Partner' : `@${String(msg.senderId || '').slice(0, 7)}`);

                            return (
                                <div
                                    id={`msg-${msg.$id}`}
                                    className="chat-message-bubble w-full flex relative z-[2]"
                                    style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}
                                >
                                    <div
                                        className={`flex items-end gap-2.5 w-full max-w-[88%] sm:max-w-[80%] ${
                                            isOutgoing ? 'flex-row-reverse' : 'flex-row'
                                        }`}
                                    >
                                        <div className="shrink-0 mb-0.5">
                                            <IdentityAvatar
                                                userId={msg.senderId}
                                                fileId={senderProfile?.avatar || null}
                                                alt={senderName}
                                                fallback={senderName.slice(0, 1).toUpperCase()}
                                                size={30}
                                                borderRadius="50%"
                                            />
                                        </div>
                                        <div
                                            className={`min-w-0 flex-1 flex flex-col gap-1 ${
                                                isOutgoing ? 'items-end' : 'items-start'
                                            }`}
                                        >
                                            {!isOutgoing && (
                                                <span className="px-1 text-[11px] font-bold text-white/40 font-mono tracking-wide">
                                                    {senderName}
                                                    {senderVerification.verified ? ' ✓' : ''}
                                                </span>
                                            )}
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onContextMenu={(e: React.MouseEvent) => handleMessageContextMenu(e, msg)}
                                                className={`relative w-fit max-w-full rounded-[18px] px-3.5 py-2.5 text-left ${
                                                    isOutgoing
                                                        ? 'bg-[#161412] border border-white/[0.06] rounded-br-md'
                                                        : 'bg-[#161412] border border-white/[0.06] rounded-bl-md'
                                                }`}
                                            >
                                                {msg.isPinned ? (
                                                    <span className="inline-flex items-center gap-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">
                                                        <Pin size={10} fill="#F59E0B" color="#F59E0B" />
                                                        Pinned
                                                    </span>
                                                ) : null}
                                                {msg.replyTo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const el = document.getElementById(`msg-${msg.replyTo}`);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }}
                                                        className="mb-2 w-full text-left rounded-xl bg-[#0A0908] border border-white/[0.04] border-l-[3px] border-l-[#F59E0B] px-2.5 py-1.5"
                                                    >
                                                        <span className="block text-[11px] font-extrabold text-[#F59E0B] mb-0.5">
                                                            {messages.find(m => m.$id === msg.replyTo)?.senderId === user?.$id ? 'You' : (conversation?.name || 'Partner')}
                                                        </span>
                                                        <span className="block text-xs text-white/50 line-clamp-2 leading-[1.35] font-satoshi">
                                                            {messages.find(m => m.$id === msg.replyTo)?.content || 'Original message'}
                                                        </span>
                                                    </button>
                                                )}
                                                <div className="min-w-0 [overflow-wrap:anywhere] text-[0.9375rem] leading-[1.45] font-satoshi font-medium text-[#F5F2ED]">
                                                    <ChatMessageContent
                                                        msg={msg}
                                                        isUnlocked={isUnlocked}
                                                        conversationId={conversationId}
                                                        onDecrypted={(id, decrypted) =>
                                                            setMessages((prev) =>
                                                                prev.map((m) =>
                                                                    (m.$id || m.id) === id ? { ...m, content: decrypted } : m
                                                                )
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            {(() => {
                                                const reactionGroups = sortReactionGroups(reactionsByMessageId[msg.$id] || [], user?.$id).slice(0, 3);
                                                if (!reactionGroups.length) return null;

                                                return (
                                                    <div
                                                        className={`flex flex-wrap gap-1.5 px-1 ${
                                                            isOutgoing ? 'justify-end' : 'justify-start'
                                                        }`}
                                                    >
                                                        {reactionGroups.map((reaction) => (
                                                            <button
                                                                key={reaction.emoji}
                                                                type="button"
                                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => openReactionPopover(e, msg.$id)}
                                                                className="text-base leading-none opacity-95 hover:opacity-100"
                                                            >
                                                                {reaction.emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                            <div
                                                className={`flex items-center gap-1 px-1 ${
                                                    isOutgoing ? 'flex-row-reverse' : 'flex-row'
                                                }`}
                                            >
                                                <span className="text-[10px] font-semibold text-white/40 tabular-nums">
                                                    {formatTime(new Date(msg.$createdAt || Date.now()), { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </span>
                                                {isOutgoing && (
                                                    <span className="inline-flex items-center text-white/40">
                                                        {(msg as any).status === 'error' ? (
                                                            <span className="text-[10px] text-[#ff4d4d]">Failed</span>
                                                        ) : (
                                                            <SyncStatusDot
                                                                pending={
                                                                    String(msg.$id).startsWith('optimistic-') ||
                                                                    (msg as any).status === 'sending'
                                                                }
                                                            />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        </React.Fragment>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </Box>

            <Popover
                open={Boolean(reactionPopoverAnchorEl && reactionPopoverMessageId)}
                anchorEl={reactionPopoverAnchorEl}
                onClose={closeReactionPopover}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                PaperProps={{
                    sx: {
                        mt: 1.5,
                        minWidth: 240,
                        maxWidth: 320,
                        borderRadius: '16px',
                        bgcolor: '#1C1A18',
                        border: '1px solid #34322F',
                        backgroundImage: 'none',
                        p: 2,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)'}
                }}
            >
                <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Reactions
                    </Typography>
                    {reactionPopoverGroups.length ? (
                        reactionPopoverGroups.map((group) => (
                            <Box key={group.emoji} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography component="div" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                                    {group.emoji}
                                </Typography>
                                <Stack spacing={0.35}>
                                    {group.actors.map((actor) => (
                                        <Typography
                                            key={`${group.emoji}-${actor.userId}`}
                                            variant="body2"
                                            sx={{
                                                fontSize: '0.82rem',
                                                color: actor.isSelf ? '#F59E0B' : 'text.secondary',
                                                fontWeight: actor.isSelf ? 700 : 500}}
                                        >
                                            {actor.label}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Box>
                        ))
                    ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                            No reactions yet.
                        </Typography>
                    )}
                    {reactionPopoverMessage && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', lineHeight: 1.4 }}>
                            {String(reactionPopoverMessage.content || '').slice(0, 96)}
                        </Typography>
                    )}
                </Stack>
            </Popover>

            {/* Input Area — fixed to chat shell bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#0A0908] border-t border-white/[0.06]">
                {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#161412] border border-white/[0.06] border-l-4 border-l-[#F59E0B] px-3 py-2.5">
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] font-mono">
                                Replying to {replyingTo.senderId === user?.$id ? 'yourself' : (conversation?.name || 'Partner')}
                            </span>
                            <span className="text-sm text-white/50 font-satoshi truncate">
                                {replyingTo.content}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"
                            aria-label="Cancel reply"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                <div className="relative z-[2]">
                    <input type="file" hidden ref={fileInputRef} onChange={onFileChange} />

                    <Menu
                        anchorEl={attachAnchorEl}
                        open={Boolean(attachAnchorEl)}
                        onClose={() => setAttachAnchorEl(null)}
                        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        PaperProps={{
                            sx: {
                                mb: 1.5,
                                borderRadius: '16px',
                                bgcolor: '#1C1A18',
                                border: '1px solid #34322F',
                                backgroundImage: 'none',
                                minWidth: 200,
                                boxShadow: '0 12px 32px rgba(0,0,0,0.5)'}
                        }}
                    >
                        <MenuItem onClick={() => { handleFileSelect('*'); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <FileIcon size={18} strokeWidth={2} color="#9B9691" /> Upload File
                        </MenuItem>
                        <MenuItem onClick={() => { setNoteModalOpen(true); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <FileText size={18} strokeWidth={2} color="#9B9691" /> Attach Note
                        </MenuItem>
                        <MenuItem onClick={() => { setSecretModalOpen(true); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <Key size={18} strokeWidth={2} color="#9B9691" /> Attach Secret
                        </MenuItem>
                    </Menu>

                    <ChatDraftInput
                        key={conversationId}
                        attachment={attachment}
                        sending={sending}
                        isRecording={isRecording}
                        attachmentDisabled={!isProPlan}
                        enableMentions={conversation?.type === 'group'}
                        mentionTargets={groupMentionTargets}
                        canBroadcastTyping={conversation?.type === 'direct' && ownTypingEnabled && partnerTypingEnabled}
                        isDirect={conversation?.type === 'direct'}
                        onAttach={() => {
                            openFileDrawer({
                                onSelectFile: (file: any) => {
                                    const objectType = file.type || file.subType || (file.issuer ? 'totp' : file.secret ? 'vault' : 'file');
                                    const title = file.name || file.title || file.label || file.issuer || 'Object';
                                    const tag = `[${objectType}:${file.$id || file.id}:${title}]`;
                                    handleSend(tag);
                                }
                            });
                        }}
                        onClearAttachment={() => setAttachment(null)}
                        onUpgradeRequested={() => showUpgradeIsland('attach files/images/videos')}
                        onSend={handleSend}
                        onToggleRecording={toggleRecording}
                        typingUsers={typingUsers}
                        conversationId={conversationId}
                        typingTimeoutRef={typingTimeoutRef}
                    />
                </div>
            </div>

            <NoteSelectorModal
                open={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                onSelect={handleNoteSelect}
            />
            <SecretSelectorModal
                open={secretModalOpen}
                onClose={() => setSecretModalOpen(false)}
                onSelect={handleSecretSelect}
                isSelf={isSelf || false}
            />
            <SudoModal
                isOpen={unlockModalOpen}
                onCancel={() => setUnlockModalOpen(false)}
                onSuccess={() => {
                    setUnlockModalOpen(false);
                    setIsUnlocked(true);
                    loadMessages();
                    loadConversation();
                }}
            />

            {/* Message Context Menu */}
            <Menu
                open={Boolean(messageAnchorEl)}
                anchorEl={messageAnchorEl?.el}
                onClose={() => setMessageAnchorEl(null)}
                PaperProps={{
                    sx: {
                        borderRadius: '12px',
                        bgcolor: '#1F1D1B',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minWidth: 160
                    }
                }}
            >
                <MenuItem onClick={() => handleReply(messageAnchorEl!.msg)} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    <Reply size={16} /> Reply
                </MenuItem>
                <MenuItem onClick={() => handleCopy(messageAnchorEl!.msg.content as string)} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    <Copy size={16} /> Copy Text
                </MenuItem>
                <MenuItem onClick={handleTogglePinMessage} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    <Pin size={16} color={messageAnchorEl?.msg.isPinned ? '#F59E0B' : 'white'} /> {messageAnchorEl?.msg.isPinned ? 'Unpin message' : 'Pin message'}
                </MenuItem>
                <Box sx={{ px: 1, py: 0.75, opacity: 0.6 }}>

                    <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                        React
                    </Typography>
                </Box>
                <MenuItem onClick={() => handleReact('👍')} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    👍 Like
                </MenuItem>
                <MenuItem onClick={() => handleReact('❤️')} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    ❤️ Love
                </MenuItem>
                <MenuItem onClick={() => handleReact('😂')} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                    😂 Laugh
                </MenuItem>
                {messageAnchorEl?.msg.senderId === user?.$id && (
                    <MenuItem onClick={() => { _handleDeleteMessage(messageAnchorEl!.msg.$id, true); setMessageAnchorEl(null); }} sx={{ gap: 1.5, py: 1, fontSize: '0.85rem', fontWeight: 600, color: '#ff4d4d' }}>
                        <Trash2 size={16} /> Delete
                    </MenuItem>
                )}
            </Menu>
        </Box>
    );
};

