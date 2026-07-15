'use client';

import type { Models } from 'appwrite';
import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { PresenceService } from '@/lib/services/presence';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
    Box,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    AppBar,
    Toolbar,
    Menu,
    MenuItem,
    Popover,
    Divider,
    Drawer,
    Avatar,
    Stack,
    useTheme,
    useMediaQuery,
    alpha
} from '@/lib/openbricks/primitives';
import {
    Send,
    Phone,
    Video,
    ChevronLeft,
    PlusCircle,
    Mic,
    Square,
    File as FileIcon,
    Check,
    CheckCheck,
    MoreVertical,
    Shield,
    Bookmark,
    Users,
    User,
    Trash2,
    FileText,
    Key,
    Clock,
    Lock,
    ExternalLink,
    RefreshCw,
    CheckSquare,
    X,
    Reply,
    Copy,
    AtSign,
    Coins,
    Zap,
    Pin,
} from 'lucide-react';
import { NoteSelectorModal } from './NoteSelectorModal';
import { SecretSelectorModal } from './SecretSelectorModal';
import { VoiceMessage } from './VoiceMessage';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import SudoModal from '../overlays/SudoModal';
import { usePresence } from '../providers/PresenceProvider';
import type { AttachmentMetadata } from '@/types/p2p';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { toast } from 'react-hot-toast';

import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { buildSafetyWarning, getVerificationState } from '@/lib/verification';
import { FormattedText } from '../common/FormattedText';
import { markConversationRead } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import { useCallLauncher } from '@/context/CallLauncherContext';
import MuralPattern from './MuralPattern';
import { IdentityAvatar, IdentityName } from '../common/IdentityBadge';
import { buildNoteAttachmentMetadata } from '@/lib/sdk';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { showUpgradeIsland } from '@/lib/upgrade-island';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

type ChatMessage = Models.Row & Record<string, any>;
type ChatReaction = Models.Row & {
    conversationId: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt?: string;
    updatedAt?: string;
    $updatedAt?: string;
};
type SenderProfile = {
    displayName?: string | null;
    username?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    preferences?: any | null;
};

const MessagesType = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    FILE: 'file',
    CALL_SIGNAL: 'call_signal',
    SYSTEM: 'system',
} as const;

const getMessageTimestamp = (msg: ChatMessage) => new Date(msg.$createdAt || msg.createdAt || Date.now()).getTime();

const getClientReadSegments = (
    messages: ChatMessage[],
    currentUserId?: string | null,
    isDirectChat = false,
    conversationReadAt = 0
) => {
    if (!currentUserId || !isDirectChat) {
        return {
            outgoingReadAt: 0,
            firstUnreadIncomingIndex: -1,
        };
    }

    let outgoingReadAt = 0;

    for (const msg of messages) {
        if (msg.senderId === currentUserId) continue;
        outgoingReadAt = Math.max(outgoingReadAt, getMessageTimestamp(msg));
    }

    const firstUnreadIncomingIndex = messages.findIndex((msg) =>
        msg.senderId !== currentUserId && getMessageTimestamp(msg) > conversationReadAt
    );

    return {
        outgoingReadAt,
        firstUnreadIncomingIndex,
    };
};

const groupMessageReactions = (reactions: ChatReaction[], currentUserId?: string | null) => {
    const groups = new Map<string, { emoji: string; count: number; reactedBySelf: boolean }>();

    reactions.forEach((reaction) => {
        const emoji = reaction?.emoji;
        if (!emoji) return;

        const existing = groups.get(emoji);
        if (existing) {
            existing.count += 1;
            existing.reactedBySelf = existing.reactedBySelf || reaction.userId === currentUserId;
            return;
        }

        groups.set(emoji, {
            emoji,
            count: 1,
            reactedBySelf: reaction.userId === currentUserId,
        });
    });

    return Array.from(groups.values());
};

const dedupeReactionsByUser = (reactions: ChatReaction[]) => {
    const latestByUser = new Map<string, ChatReaction>();

    reactions.forEach((reaction) => {
        if (!reaction?.userId || !reaction?.messageId) return;
        const key = `${reaction.messageId}:${reaction.userId}`;
        const existing = latestByUser.get(key);
        const nextTime = new Date(reaction.updatedAt || reaction.$updatedAt || reaction.createdAt || reaction.$createdAt || 0).getTime();
        const existingTime = existing
            ? new Date(existing.updatedAt || existing.$updatedAt || existing.createdAt || existing.$createdAt || 0).getTime()
            : -1;

        if (!existing || nextTime >= existingTime) {
            latestByUser.set(key, reaction);
        }
    });

    return Array.from(latestByUser.values());
};

const sortReactionGroups = (reactions: ChatReaction[], currentUserId?: string | null) =>
    groupMessageReactions(reactions, currentUserId).sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.emoji.localeCompare(right.emoji);
    });

const getReactionActorLabel = (
    userId: string,
    senderProfiles: Record<string, SenderProfile>
) => {
    const cached = senderProfiles[userId] || getCachedIdentityById(userId);
    return cached?.displayName || cached?.username || `@${userId.slice(0, 7)}`;
};

const ChatDraftInput = React.memo(function ChatDraftInput({
    attachment,
    sending,
    isRecording,
    attachmentDisabled = false,
    enableMentions,
    mentionTargets,
    onAttach,
    onUpgradeRequested,
    onSend,
    onToggleRecording,
    typingUsers,
    conversationId,
    typingTimeoutRef,
}: {
    attachment: File | null;
    sending: boolean;
    isRecording: boolean;
    enableMentions?: boolean;
    mentionTargets?: Array<{ id: string; label: string; token: string }>;
    onAttach: (event: React.MouseEvent<HTMLElement>) => void;
    attachmentDisabled?: boolean;
    onUpgradeRequested: () => void;
    onSend: (text: string) => Promise<boolean>;
    onToggleRecording: () => void;
    typingUsers: string[];
    conversationId: string;
    typingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}) {
    const [draft, setDraft] = useState('');
    const [mentionAnchorEl, setMentionAnchorEl] = useState<null | HTMLElement>(null);
    const textRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    const submitDraft = React.useCallback(async () => {
        const didSend = await onSend(draft);
        if (didSend) setDraft('');
    }, [draft, onSend]);

    const insertMention = React.useCallback((token: string) => {
        const input = textRef.current;
        if (!input) {
            setDraft((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token} `);
            return;
        }

        const start = input.selectionStart ?? draft.length;
        const end = input.selectionEnd ?? draft.length;
        const before = draft.slice(0, start);
        const after = draft.slice(end);
        const prefix = before && !before.endsWith(' ') ? ' ' : '';
        const nextDraft = `${before}${prefix}${token} ${after}`;
        setDraft(nextDraft);

        requestAnimationFrame(() => {
            const cursor = before.length + prefix.length + token.length + 1;
            input.focus();
            input.setSelectionRange(cursor, cursor);
        });
    }, [draft]);

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <IconButton
                    size="small"
                    onClick={attachmentDisabled ? onUpgradeRequested : onAttach}
                    aria-disabled={attachmentDisabled}
                    sx={{
                        color: attachmentDisabled ? 'rgba(255,255,255,0.32)' : '#9B9691',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: attachmentDisabled ? '#1C1A18' : '#F59E0B',
                            color: attachmentDisabled ? '#9B9691' : '#fff',
                            cursor: attachmentDisabled ? 'not-allowed' : 'pointer',
                        },
                    }}
                >
                    <PlusCircle size={20} strokeWidth={2} />
                </IconButton>

                <IconButton
                    onClick={onToggleRecording}
                    sx={{
                        color: isRecording ? '#ff4d4d' : '#9B9691',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: '#F59E0B',
                            color: '#fff',
                        },
                    }}
                >
                    {isRecording ? <Square size={18} fill="#ff4d4d" /> : <Mic size={20} strokeWidth={2} />}
                </IconButton>

                <Box sx={{ flex: 1, position: 'relative' }}>
                    {typingUsers.length > 0 && (
                        <Box sx={{ position: 'absolute', top: -20, left: 16 }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#9B9691', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {typingUsers.length === 1 ? 'someone' : `${typingUsers.length} people`} is typing...
                            </Typography>
                        </Box>
                    )}
                    <TextField

                        fullWidth
                        multiline
                        maxRows={4}
                        placeholder="Encrypted payload..."
                        value={draft}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDraft(e.target.value);
                            
                            // Broadcast typing status
                            if (conversationId) {
                                PresenceService.broadcastState(
                                    PresenceService.getChatChannel(conversationId),
                                    { state: 'online', activity: 'typing' }
                                );

                                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                typingTimeoutRef.current = setTimeout(() => {
                                    PresenceService.broadcastState(
                                        PresenceService.getChatChannel(conversationId),
                                        { state: 'online', activity: 'viewing' }
                                    );
                                }, 3000);
                            }
                        }}
                        onKeyDown={async (e: React.KeyboardEvent) => {
                            if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                const val = draft.trim();
                                if (!val) {
                                    toast.error('Type a message first to secure it.');
                                    return;
                                }
                                setDraft('Securing message payload...');
                                try {
                                    const { AppwriteService } = await import('@/lib/appwrite');
                                    const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
                                    
                                    const ghostSecret = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-send`;
                                    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days standard
                                    
                                    const titleEnc = await encryptGhostData('Secure Note');
                                    const contentEnc = await encryptGhostData(val, titleEnc.key);
                                    
                                    const note = await AppwriteService.createSendGhostObject({
                                        title: titleEnc.encrypted,
                                        content: contentEnc.encrypted,
                                        format: 'markdown',
                                        ghostSecret,
                                        expiresAt,
                                        isEncrypted: true,
                                        sendObject: { kind: 'note' }
                                    });
                                    
                                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                    const url = `${origin}/send/${note.$id}/${titleEnc.key}`;
                                    
                                    // Cache in localStorage stash
                                    try {
                                        const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
                                        const newSpark = {
                                            id: note.$id,
                                            kind: 'note',
                                            title: 'Secure Note',
                                            url,
                                            expiresAt,
                                        };
                                        localStorage.setItem('kylrix_send_sparks', JSON.stringify([newSpark, ...existing]));
                                    } catch (err) {
                                        console.warn('Failed to cache spark:', err);
                                    }
                                    
                                    setDraft(url);
                                    toast.success('Message secured as Zero-Knowledge Ghost Note!');
                                } catch (err) {
                                    console.error('Failed to secure message:', err);
                                    setDraft(val);
                                    toast.error('Failed to secure message.');
                                }
                                return;
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitDraft();
                            }
                        }}
                        inputRef={textRef}
                        variant="standard"
                        InputProps={{
                            disableUnderline: true,
                            sx: {
                                px: 2,
                                py: 1.5,
                                bgcolor: '#161412',
                                borderRadius: '18px',
                                border: '1px solid #1C1A18',
                                color: '#fff',
                                fontWeight: 600,
                                fontFamily: 'var(--font-satoshi)',
                                fontSize: '0.95rem',
                                '&:focus-within': {
                                    borderColor: '#6366F1',
                                    bgcolor: '#1C1A18',
                                }
                            }
                        }}
                    />
                    {attachment && (
                        <Box sx={{ position: 'absolute', top: -36, left: 0, right: 0, px: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Box sx={{ px: 1.2, py: 0.5, borderRadius: '8px', bgcolor: '#6366F1', color: '#fff', display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem', fontWeight: 800 }}>
                                <FileIcon size={12} strokeWidth={2.5} />
                                {attachment.name.slice(0, 16)}...
                            </Box>
                        </Box>
                    )}
                </Box>

                <IconButton
                    disabled={!draft.trim() && !attachment && !isRecording}
                    onClick={submitDraft}
                    sx={{
                        color: (draft.trim() || attachment) ? '#6366F1' : 'rgba(255,255,255,0.1)',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: (draft.trim() || attachment) ? '#161412' : 'transparent',
                        border: '1px solid',
                        borderColor: (draft.trim() || attachment) ? '#1C1A18' : 'transparent',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: '#6366F1',
                        },
                        '&.ob-disabled': {
                            color: 'rgba(255,255,255,0.05)',
                        }
                    }}
                >
                    {sending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} strokeWidth={2.5} />}
                </IconButton>
            </Box>
        </>
    );
});

export const ChatWindow = ({ conversationId, onBack }: { conversationId: string; onBack?: () => void }) => {
    const { user } = useAuth();
    const { openProUpgrade } = useProUpgrade();
    const { markConversationRead: markConversationReadInContext } = useChatNotifications();
    const { openCallLauncher } = useCallLauncher();
    const { globalPresence, setMyState } = usePresence();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversation, setConversation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [attachAnchorEl, setAttachAnchorEl] = useState<null | HTMLElement>(null);
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [secretModalOpen, setSecretModalOpen] = useState(false);
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
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
    const [isPending, startTransition] = useTransition();
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
                title: 'Audio Call',
            });
        }
    }, [conversation, startCallParam, conversationId, openCallLauncher]);

    const partnerId = useMemo(() => {
        if (!conversation || conversation.type !== 'direct' || !user?.$id) return null;
        return conversation.participants.find((p: string) => p !== user.$id) || null;
    }, [conversation, user?.$id]);

    const handleTip = () => {
        if (!partnerId) return;
        setAnchorEl(null);
        openWalletWithIntent({
            mode: 'send',
            toUser: {
                id: partnerId,
                username: conversation?.name?.replace(/^@/, '') || 'User',
                displayName: conversation?.name || 'User',
            },
        });
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
                    token: username ? `@${username}` : `@${participantId.slice(0, 7)}`,
                };
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
                isSelf: reaction.userId === user?.$id,
            };

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
    const showFirstContactWarning = Boolean(
        conversation?.type === 'direct' &&
        !isSelf &&
        partnerProfile &&
        !partnerVerification.verified &&
        !hasRepliedToPartner
    );

    const loadConversation = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            if (ecosystemSecurity.status.isUnlocked) {
                await UsersService.forceSyncProfileWithIdentity(user);
            }
            const conv = await ChatService.getConversationById(conversationId, user.$id);
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
                        startTransition(() => {
                            setConversation({
                                ...conv,
                                name: profile ? (profile.displayName || profile.username) : `@${otherId.slice(0, 7)}`,
                                avatarUrl
                            });
                        });
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
                    startTransition(() => {
                        setConversation({ ...conv, name: `${myName} (You)`, avatarUrl });
                    });
                }
            } else {
                startTransition(() => {
                    setPartnerProfile(null);
                    setPartnerVerification(getVerificationState(null));
                    setConversation(conv);
                });
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
        setLoading(true);
        console.log('[ChatWindow] loadMessages start for:', conversationId);
        try {
            startTransition(() => setMessageReactions({}));
            if (user?.$id && ecosystemSecurity.status.isUnlocked) {
                await UsersService.forceSyncProfileWithIdentity(user);
            }
            const conv = await ChatService.getConversationById(conversationId, user?.$id);
            console.log('[ChatWindow] loadMessages: conversation fetched:', conv?.$id);

            const response = await ChatService.getMessages(conversationId, 50, 0, user?.$id, {
                prefetchedConversation: conv,
            });
            console.log('[ChatWindow] loadMessages: getMessages returned rows:', response.rows?.length);

            // Filter by clearedAt if exists in settings
            let displayMessages = response.rows;
            if (user && conv.settings) {
                try {
                    const decryptedSettings = await ecosystemSecurity.decrypt(conv.settings);
                    const settings = JSON.parse(decryptedSettings);
                    const myClearedAt = settings.clearedAt?.[user.$id];
                    if (myClearedAt) {
                        displayMessages = displayMessages.filter((m: any) => new Date(m.createdAt || m.$createdAt) > new Date(myClearedAt));
                        console.log('[ChatWindow] loadMessages: Filtered by clearedAt. Remaining:', displayMessages.length);
                    }
                } catch (_e: unknown) { }
            }

            // Reverse once for display order (bottom is newest)
            startTransition(() => {
                setMessages(displayMessages.reverse() as unknown as ChatMessage[]);
            });
            void loadReactions();
        } catch (error: unknown) {
            console.error('[ChatWindow] loadMessages failed:', error);
        } finally {
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
                            preferences: normalized.preferences,
                        } as SenderProfile,
                    };
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
                        preferences: identity.preferences,
                    },
                }));
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
                            preferences: normalized.preferences,
                        } as SenderProfile,
                    };
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
            loadMessages();
            loadConversation();
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
                title: 'NUCLEAR WIPE: Purge Chat?',
                description: 'CRITICAL: This will delete the entire direct chat, including members, keys, and the conversation itself for BOTH parties. All context will be lost.',
                confirmLabel: 'Nuclear Purge'
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
                        await ChatService.nuclearWipe(conversationId);
                        toast.success("Conversation fully purged");
                        router.push('/connect/chats');
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
        } catch (err) {
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
            let actualAttachments = initialAttachments;
            if (file) {
                const bucketId = StorageService.getBucketForType(type);
                const uploaded = await StorageService.uploadFile(file, bucketId);
                actualAttachments = [uploaded.$id];
            }

            const sentMessage = await ChatService.sendMessage(conversationId, user.$id, text, type, actualAttachments, replyToId);

            // Replace optimistic message with the real one to maintain state (readBy, etc)
            const messageForState = { ...sentMessage, content: text } as unknown as ChatMessage;
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
            title: type === 'audio' ? 'Audio Call' : 'Video Call',
        });
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

                    // Send the audio file
                    setSending(true);
                    try {
                        const uploaded = await StorageService.uploadFile(audioFile, StorageService.getBucketForType('audio'));
                        await ChatService.sendMessage(conversationId, user?.$id || '', 'Voice Message', 'audio', [uploaded.$id]);
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

    const AttachmentCard = ({ metadata }: { metadata: AttachmentMetadata }) => {
        const [showTOTP, setShowTOTP] = useState(false);
        const [isExpired, setIsExpired] = useState(false);
        const [timeLeft, setTimeLeft] = useState(30);
        const [isRevealingSecret, setIsRevealingSecret] = useState(false);
        const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

        const [currentCode, setCurrentCode] = useState(metadata.payload.currentCode || '000 000');

        useEffect(() => {
            if (metadata.subType === 'totp' && metadata.payload.expiry) {
                const timer = setInterval(() => {
                    const diff = Math.max(0, Math.floor((new Date(metadata.payload.expiry!).getTime() - Date.now()) / 1000));
                    setTimeLeft(diff);
                    if (diff <= 0) {
                        setIsExpired(true);
                        setCurrentCode(metadata.payload.nextCode || 'EXPIRED');
                        clearInterval(timer);
                    }
                }, 1000);
                return () => clearInterval(timer);
            }
        }, [metadata]);

        const getEntityIcon = () => {
            switch (metadata.entity) {
                case 'vault': return <Shield size={18} color="#F59E0B" />;
                case 'note': return <FileText size={18} color="#6366F1" />;
                case 'flow': return <CheckSquare size={18} color="#10B981" />;
                default: return <PlusCircle size={18} />;
            }
        };

        const getEntityColor = () => {
            switch (metadata.entity) {
                case 'vault': return '#F59E0B';
                case 'note': return '#6366F1';
                case 'flow': return '#10B981';
                default: return '#94A3B8';
            }
        };

        const handleCardAction = () => {
            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
            switch (metadata.entity) {
                case 'note':
                    window.open(`https://note.${domain}/n/${metadata.referenceId}`, '_blank');
                    break;
                case 'vault':
                    window.open(`https://vault.${domain}/vault?id=${metadata.referenceId}`, '_blank');
                    break;
                case 'flow':
                    window.open(`https://flow.${domain}/${metadata.subType === 'task' ? 'tasks' : 'forms'}/${metadata.referenceId}`, '_blank');
                    break;
            }
        };

        const handleSecretMouseDown = () => {
            if (metadata.subType !== 'password') return;
            revealTimerRef.current = setTimeout(() => {
                setIsRevealingSecret(true);
            }, 500);
        };

        const handleSecretMouseUp = () => {
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
            setIsRevealingSecret(false);
        };

        return (
            <Box sx={{
                mt: 1,
                minWidth: 260,
                maxWidth: 320,
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#161412',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '16px',
                    padding: '1px',
                    background: metadata.entity === 'vault'
                        ? 'rgba(245, 158, 11, 0.18)'
                        : 'rgba(99, 102, 241, 0.18)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    pointerEvents: 'none'
                }
            }}>
                <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {getEntityIcon()}
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, color: 'text.primary', fontFamily: 'var(--font-clash)' }}>
                            {metadata.entity} • {metadata.subType}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ 
                            px: 0.8, 
                            py: 0.2, 
                            borderRadius: '4px', 
                            bgcolor: `${alpha(getEntityColor(), 0.1)}`, 
                            border: `1px solid ${alpha(getEntityColor(), 0.2)}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}>
                            <Lock size={10} color={getEntityColor()} />
                            <Typography sx={{ fontSize: '8px', fontWeight: 900, color: getEntityColor(), textTransform: 'uppercase' }}>Verified</Typography>
                        </Box>
                        <IconButton size="small" onClick={handleCardAction} sx={{ opacity: 0.5, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <ExternalLink size={14} />
                        </IconButton>
                    </Stack>
                </Box>

                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.primary', fontFamily: 'var(--font-satoshi)' }}>{metadata.payload.label}</Typography>
                    
                    {metadata.entity === 'flow' ? (
                        <Box sx={{ mt: 1 }}>
                             <Box sx={{ 
                                p: 1.5, 
                                bgcolor: 'rgba(16, 185, 129, 0.05)', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(16, 185, 129, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5
                            }}>
                                <Box sx={{ 
                                    width: 24, 
                                    height: 24, 
                                    borderRadius: '6px', 
                                    border: '2px solid #10B981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#10B981'
                                }}>
                                     {metadata.subType === 'task' && metadata.payload.isCompleted && <Check size={16} strokeWidth={3} />}
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {metadata.subType === 'task' ? 'Task Assignment' : 'Dynamic Form'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }}>
                                        {metadata.subType === 'task' ? (metadata.payload.isCompleted ? 'Completed' : 'Pending') : 'Input Required'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Button 
                                fullWidth 
                                size="small" 
                                onClick={handleCardAction}
                                sx={{ 
                                    mt: 1, 
                                    borderRadius: '8px', 
                                    textTransform: 'none', 
                                    fontWeight: 700,
                                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10B981',
                                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' }
                                }}
                            >
                                {metadata.subType === 'task' ? 'View Task' : 'Open Form'}
                            </Button>
                        </Box>
                    ) : metadata.subType === 'totp' ? (
                        <Box sx={{ mt: 1 }}>
                            <Box sx={{ 
                                bgcolor: 'rgba(0,0,0,0.4)', 
                                borderRadius: '12px', 
                                p: 2, 
                                textAlign: 'center',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <Typography variant="h5" sx={{ 
                                    fontFamily: 'var(--font-mono)', 
                                    letterSpacing: 4, 
                                    fontWeight: 900,
                                    color: isExpired ? '#ff4d4d' : '#F59E0B',
                                    filter: showTOTP ? 'none' : 'blur(8px)',
                                    transition: 'filter 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    textShadow: isExpired ? 'none' : '0 0 12px rgba(245, 158, 11, 0.3)'
                                }}>
                                    {currentCode}
                                </Typography>
                                {!showTOTP && !isExpired && (
                                    <Button 
                                        size="small" 
                                        onClick={() => setShowTOTP(true)}
                                        sx={{ 
                                            position: 'absolute', 
                                            top: '50%', 
                                            left: '50%', 
                                            transform: 'translate(-50%, -50%)', 
                                            fontWeight: 900, 
                                            color: '#F59E0B',
                                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                                            px: 2,
                                            borderRadius: '8px',
                                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' }
                                        }}
                                    >
                                        Reveal Code
                                    </Button>
                                )}
                                {isExpired && (
                                    <Typography variant="caption" sx={{ color: '#ff4d4d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5, fontWeight: 700 }}>
                                        <RefreshCw size={10} className="animate-spin" /> PULSE ROTATED
                                    </Typography>
                                )}
                            </Box>
                            {!isExpired && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, px: 0.5 }}>
                                    <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' }}>
                                        <Box sx={{ 
                                            width: `${(timeLeft / 30) * 100}%`, 
                                            height: '100%', 
                                            bgcolor: timeLeft < 10 ? '#ff4d4d' : '#F59E0B',
                                            transition: 'width 1s linear, background-color 0.3s ease',
                                            boxShadow: timeLeft < 10 ? '0 0 8px #ff4d4d' : 'none'
                                        }} />
                                    </Box>
                                    <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', opacity: 0.5, fontWeight: 700 }}>{timeLeft}s</Typography>
                                </Box>
                            )}
                        </Box>
                    ) : metadata.subType === 'password' ? (
                        <Box 
                            onMouseDown={handleSecretMouseDown}
                            onMouseUp={handleSecretMouseUp}
                            onMouseLeave={handleSecretMouseUp}
                            onTouchStart={handleSecretMouseDown}
                            onTouchEnd={handleSecretMouseUp}
                            sx={{ 
                                mt: 1,
                                bgcolor: 'rgba(0,0,0,0.3)', 
                                borderRadius: '12px', 
                                p: 1.5, 
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                position: 'relative',
                                transition: 'all 0.2s ease',
                                '&:active': { transform: 'scale(0.98)', bgcolor: 'rgba(0,0,0,0.5)' }
                            }}
                        >
                             <Typography variant="body2" sx={{ 
                                fontFamily: 'var(--font-mono)', 
                                letterSpacing: isRevealingSecret ? 1 : 4, 
                                opacity: isRevealingSecret ? 1 : 0.4,
                                color: isRevealingSecret ? 'text.primary' : 'text.secondary',
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                            }}>
                                {isRevealingSecret ? (metadata.payload.preview || 'SECRET_KEY') : '••••••••'}
                            </Typography>
                            {!isRevealingSecret && (
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5, opacity: 0.3, fontSize: '9px', fontWeight: 800 }}>
                                    HOLD TO REVEAL
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ 
                            mt: 1, 
                            p: 1.5, 
                            bgcolor: 'rgba(255,255,255,0.02)', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.05)' 
                        }}>
                            <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.85rem', lineHeight: 1.5, fontFamily: 'var(--font-satoshi)' }}>
                                {metadata.payload.preview || 'No preview available'}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        );
    };

    const renderMessageContent = (msg: ChatMessage) => {
        if ((msg as any).metadata?.type === 'attachment') {
            return <AttachmentCard metadata={(msg as any).metadata as unknown as AttachmentMetadata} />;
        }
        // Handle gibberish display when vault is locked
        const isLikelyEncrypted = (val: string) => {
            if (!val) return false;
            // Check if it's base64 with IV (standard WESP format) or just long gibberish
            return val.length > 40 && !val.includes(' ');
        };

        let displayedContent = msg.content as string;
        const isEncrypted = isLikelyEncrypted(displayedContent);

        if (msg.type === MessagesType.TEXT && isEncrypted) {
            if (!isUnlocked) {
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: 0.8 }}>
                        <Lock size={14} strokeWidth={2.5} />
                        <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                            Encrypted message
                        </Typography>
                    </Box>
                );
            } else {
                // Dynamically decrypt using memory cache to prevent render loop execution bottlenecks
                const cacheKey = `decrypted_msg_${msg.$id || msg.id}`;
                const cachedDecrypted = (window as any)[cacheKey];
                if (cachedDecrypted) {
                    displayedContent = cachedDecrypted;
                } else {
                    // Start async decryption task and trigger render state updates dynamically
                    ecosystemSecurity.decrypt(displayedContent)
                        .then((decrypted) => {
                            (window as any)[cacheKey] = decrypted;
                            setMessages((prev) => prev.map((m) => {
                                if ((m.$id || m.id) === (msg.$id || msg.id)) {
                                    return { ...m, content: decrypted };
                                }
                                return m;
                            }));
                        })
                        .catch(() => {});
                }
            }
        }

        const fileId = msg.attachments && msg.attachments[0];
        if (!fileId) return <FormattedText text={displayedContent} />;

        const bucketId = StorageService.getBucketForType(msg.type);
        const viewUrl = StorageService.getFileView(fileId, bucketId);
        const previewUrl = StorageService.getFilePreview(fileId, bucketId, 300, 300);

        switch (msg.type) {
            case 'image':
                return (
                    <Box>
                        <Box
                            sx={{
                                width: 300,
                                height: 300,
                                position: 'relative',
                                borderRadius: 2,
                                overflow: 'hidden',
                                cursor: 'pointer'
                            }}
                            onClick={() => window.open(viewUrl, '_blank')}
                        >
                            <Image
                                src={previewUrl}
                                alt="attachment"
                                fill
                                style={{ objectFit: 'cover' }}
                            />
                        </Box>
                        {msg.content && <Typography variant="body2" sx={{ mt: 1 }}>{msg.content}</Typography>}
                    </Box>
                );
            case 'video':
                return (
                    <Box>
                        <video
                            src={viewUrl}
                            controls
                            style={{ maxWidth: '100%', borderRadius: 8 }}
                        />
                        {msg.content && <Typography variant="body2" sx={{ mt: 1 }}>{msg.content}</Typography>}
                    </Box>
                );
            case 'audio':
                return (
                    <VoiceMessage url={viewUrl} />
                );

            default:
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#161514', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <FileIcon size={18} strokeWidth={1.5} />
                        <Typography
                            variant="body2"
                            component="a"
                            href={StorageService.getFileDownload(fileId, bucketId)}
                            target="_blank"
                            sx={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Download File
                        </Typography>
                    </Box>
                );
        }
    };

    if (loading) return (
        <Box sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <></>
                    <Box sx={{ flex: 1 }}>
                        <></>
                        <></>
                    </Box>
                </Box>
                {[1, 2, 3, 4].map((i) => (
                    <></>
                ))}
            </Stack>
        </Box>
    );

    return (
        <Box sx={{
            bgcolor: '#0A0908',
            position: 'fixed',
            top: '88px', // Start below GlobalShell topbar
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>

            <MuralPattern />
            <AppBar position="absolute" color="transparent" elevation={0} sx={{ 
                top: 0,
                left: 0,
                right: 0,
                borderBottom: '1px solid #1C1A18', 
                bgcolor: '#0A0908',
                zIndex: 10,
                pt: 'env(safe-area-inset-top)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
                <Toolbar sx={{ gap: 1, minHeight: '72px' }}>
                    <IconButton edge="start" onClick={() => router.back()} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: '#161412' } }}>
                        <ChevronLeft size={20} strokeWidth={2} />
                    </IconButton>
                    <Box
                        onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                        <IdentityAvatar 
                            fileId={conversation?.avatarUrl || conversation?.avatar || null}
                            alt={conversation?.name}
                            fallback={isSelf ? 'B' : (conversation?.name?.replace(/^@/, '').charAt(0).toUpperCase() || 'U')}
                            size={38}
                            pro={isSelf}
                        />
                        <Box>
                            {conversation?.type === 'direct' && !isSelf ? (
                                <IdentityName
                                    verified={partnerVerification.verified}
                                    sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: '#fff', fontSize: '1rem' }}
                                >
                                    {conversation?.name || 'Loading...'}
                                </IdentityName>
                            ) : (
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: isSelf ? '#6366F1' : '#fff', fontSize: '1rem' }}>
                                    {conversation?.name || 'Loading...'}
                                </Typography>
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
                    <Stack direction="row" spacing={0.5}>
                        {!isSelf && (
                            <IconButton onClick={() => handleCall('audio')} sx={{ color: 'text.secondary' }}>
                                <Phone size={20} strokeWidth={1.5} />
                            </IconButton>
                        )}
                        <IconButton onClick={(e: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget)} sx={{ color: 'text.secondary' }}>
                            <MoreVertical size={20} strokeWidth={1.5} />
                        </IconButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: '16px',
                        bgcolor: '#1F1D1B',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundImage: 'none',
                        minWidth: 220
                    }
                }}
            >
                {conversation?.type === 'direct' && !isSelf && (
                    <MenuItem onClick={handleTip} sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.85rem', color: '#F59E0B' }}>
                        <Coins size={18} strokeWidth={2} style={{ opacity: 0.9 }} /> Tip {conversation?.name || 'User'}
                    </MenuItem>
                )}

                <MenuItem onClick={handleExport} sx={{ gap: 1.5, py: 1.2, fontWeight: 600, fontSize: '0.85rem' }}>
                    <FileIcon size={18} strokeWidth={1.5} style={{ opacity: 0.7 }} /> Export Chat (.json)
                </MenuItem>

                <Divider sx={{ my: 1, opacity: 0.1 }} />

                <MenuItem onClick={() => setClearOptionsOpen(true)} sx={{ gap: 1.5, py: 1.2, fontWeight: 600, fontSize: '0.85rem' }}>
                    <Trash2 size={18} strokeWidth={1.5} style={{ opacity: 0.7 }} /> Clear All Chat
                </MenuItem>

                {conversation?.type === 'direct' && (
                    <MenuItem onClick={() => handleClearChat('nuclear')} sx={{ gap: 1.5, py: 1.2, fontWeight: 600, fontSize: '0.85rem', color: '#ff4d4d' }}>
                        <Zap size={18} strokeWidth={1.5} style={{ opacity: 0.9 }} /> Nuclear Wipe
                    </MenuItem>
                )}
            </Menu>

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
                        zIndex: 2000,
                    }
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
                                Nuclear Wipe
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

            {/* Messages Area */}
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, pb: 'calc(100px + env(safe-area-inset-bottom))', pt: 'calc(80px + env(safe-area-inset-top))', position: 'relative', zIndex: 2 }}>
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
                                    bgcolor: '#575CF0',
                                }
                            }}
                        >
                            Unlock to Read
                        </Button>
                    </Box>
                )}
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <></>
                            <Box sx={{ flex: 1 }}>
                                <></>
                                <></>
                            </Box>
                        </Stack>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <></>
                        ))}
                    </Box>
                ) : (
                    <>
                        {showFirstContactWarning && (
                            <Box sx={{ p: 2, mb: 2, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(245, 158, 11, 0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#fff', fontWeight: 600 }}>
                                    {buildSafetyWarning(conversation?.name || 'this contact')}
                                </Typography>
                            </Box>
                        )}

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
                                <Box
                                    id={`msg-${msg.$id}`}
                                    className="chat-message-bubble"
                                    sx={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
                                        position: 'relative',
                                        zIndex: 2
                                    }}
                                >
                                    <Stack
                                        direction={isOutgoing ? 'row-reverse' : 'row'}
                                        spacing={1}
                                        alignItems="flex-end"
                                        sx={{ width: '100%', maxWidth: '80%' }}
                                    >
                                        <IdentityAvatar
                                            fileId={senderProfile?.avatar || null}
                                            alt={senderName}
                                            fallback={senderName.slice(0, 1).toUpperCase()}
                                            size={30}
                                            borderRadius="50%"
                                        />
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, flex: '0 1 auto', alignItems: isOutgoing ? 'flex-end' : 'flex-start' }}>
                                            {!isOutgoing && (
                                                <IdentityName
                                                    verified={senderVerification.verified}
                                                    sx={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        color: '#9B9691', // Muted Gray metadata
                                                        pl: 0.5,
                                                        mb: 0.25,
                                                        fontFamily: 'var(--font-mono)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em'
                                                    }}
                                                >
                                                    {senderName}
                                                </IdentityName>
                                            )}
                                            <Paper
                                                onContextMenu={(e: React.MouseEvent) => handleMessageContextMenu(e, msg)}
                                                sx={{
                                                    p: 1.5,
                                                    px: 2.25,
                                                    width: 'fit-content',
                                                    maxWidth: '100%',
                                                    alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                                                    borderRadius: isOutgoing ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                                                    bgcolor: isOutgoing ? '#161412' : '#161412', // Standardized Opaque Deep Ash
                                                    backgroundImage: 'none',
                                                    border: '1px solid #23211F',
                                                    borderRight: isOutgoing ? '3px solid #6366F1' : '1px solid #23211F',
                                                    borderLeft: !isOutgoing ? '3px solid #34322F' : '1px solid #23211F',
                                                    color: isOutgoing ? '#FFFFFF' : '#F5F2ED',
                                                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.8)',
                                                    position: 'relative',
                                                    zIndex: 2,
                                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                                    '&:hover': {
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 6px 16px -4px rgba(0,0,0,0.9)',
                                                    }
                                                }}
                                            >
                                                {msg.isPinned && (
                                                    <Box sx={{ 
                                                        position: 'absolute', 
                                                        top: -8, 
                                                        right: isOutgoing ? 'auto' : -8, 
                                                        left: isOutgoing ? -8 : 'auto', 
                                                        bgcolor: '#161412', 
                                                        borderRadius: '50%', 
                                                        p: 0.5, 
                                                        border: '1px solid #F59E0B', 
                                                        boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)', 
                                                        zIndex: 10,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <Pin size={10} fill="#F59E0B" color="#F59E0B" style={{ transform: 'rotate(45deg)' }} />
                                                    </Box>
                                                )}
                                                {msg.replyTo && (
                                                    <Box
                                                        onClick={() => {
                                                            const el = document.getElementById(`msg-${msg.replyTo}`);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }}
                                                        sx={{
                                                            mb: 1,
                                                            p: 1,
                                                            bgcolor: '#161514',
                                                            borderRadius: '8px',
                                                            borderLeft: '3px solid',
                                                            borderColor: 'primary.main',
                                                            cursor: 'pointer',
                                                            opacity: 0.8,
                                                            boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
                                                            '&:hover': { opacity: 1, bgcolor: '#161514' }
                                                        }}
                                                    >
                                                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'block', mb: 0.5 }}>
                                                            {messages.find(m => m.$id === msg.replyTo)?.senderId === user?.$id ? 'You' : (conversation?.name || 'Partner')}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            fontSize: '0.75rem',
                                                            lineHeight: 1.2
                                                        }}>
                                                            {messages.find(m => m.$id === msg.replyTo)?.content || 'Original message'}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {renderMessageContent(msg)}
                                            </Paper>
                                            {(() => {
                                                const reactionGroups = sortReactionGroups(reactionsByMessageId[msg.$id] || [], user?.$id).slice(0, 3);
                                                if (!reactionGroups.length) return null;

                                                return (
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 0.75,
                                                            alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                                                            maxWidth: '100%',
                                                            mt: 0.5,
                                                            px: 0.5,
                                                        }}
                                                    >
                                                        {reactionGroups.map((reaction) => (
                                                            <Box
                                                                key={reaction.emoji}
                                                                component="button"
                                                                type="button"
                                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => openReactionPopover(e, msg.$id)}
                                                                sx={{
                                                                    p: 0,
                                                                    m: 0,
                                                                    border: 0,
                                                                    background: 'transparent',
                                                                    color: 'inherit',
                                                                    cursor: 'pointer',
                                                                    fontSize: '1rem',
                                                                    lineHeight: 1,
                                                                    opacity: reaction.reactedBySelf ? 1 : 0.95,
                                                                    '&:hover': {
                                                                        opacity: 1,
                                                                        transform: 'translateY(-1px)',
                                                                    },
                                                                }}
                                                            >
                                                                {reaction.emoji}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                );
                                            })()}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: isOutgoing ? 'flex-end' : 'flex-start', px: 0.5, position: 'relative', zIndex: 2 }}>
                                                <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 1, color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
                                                    {formatTime(new Date(msg.$createdAt || Date.now()), { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </Typography>
                                                {isOutgoing && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        {String(msg.$id).startsWith('optimistic-') || (msg as any).status === 'sending' ? (
                                                            <Box sx={{ opacity: 1, display: 'flex', color: 'rgba(255,255,255,0.72)' }}><Clock size={11} strokeWidth={2.5} /></Box>
                                                        ) : (msg as any).status === 'error' ? (
                                                            <Typography variant="caption" sx={{ color: '#ff4d4d', fontSize: '10px', opacity: 1 }}>Failed</Typography>
                                                        ) : (
                                                            getMessageTimestamp(msg) <= clientReadSegments.outgoingReadAt ? (
                                                                <CheckCheck size={13} color="var(--color-primary)" strokeWidth={2.5} style={{ opacity: 1 }} />
                                                            ) : (
                                                                <Check size={13} strokeWidth={2.5} style={{ opacity: 1, color: 'rgba(255,255,255,0.72)' }} />
                                                            )
                                                        )}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Stack>
                                </Box>
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
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    }
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
                                                fontWeight: actor.isSelf ? 700 : 500,
                                            }}
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

            {/* Input Area (Bottom Drawer style) */}
            <Box sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                px: { xs: 1.5, md: 2 },
                pb: 'max(1rem, env(safe-area-inset-bottom))', 
                pt: 1.5,
                bgcolor: '#161412', 
                borderTop: '1px solid #1C1A18',
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
                zIndex: 20 
            }}>
                {replyingTo && (
                    <Box sx={{ 
                        mb: 1.5, 
                        p: 1.5, 
                        bgcolor: '#0A0908', 
                        borderLeft: '4px solid #F59E0B',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #1C1A18',
                    }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, color: '#F59E0B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
                                Replying to {replyingTo.senderId === user?.$id ? 'yourself' : (conversation?.name || 'Partner')}
                            </Typography>
                            <Typography variant="body2" noWrap sx={{ color: '#9B9691', fontSize: '0.85rem', fontWeight: 500 }}>
                                {replyingTo.content}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setReplyingTo(null)} sx={{ ml: 1, color: '#9B9691' }}>
                            <X size={16} />
                        </IconButton>
                    </Box>
                )}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.75,
                    position: 'relative',
                    zIndex: 2,
                }}>
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
                                boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                            }
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
                        onAttach={(e) => setAttachAnchorEl(e.currentTarget)}
                        onUpgradeRequested={() => showUpgradeIsland('attach files/images/videos')}
                        onSend={handleSend}
                        onToggleRecording={toggleRecording}
                        typingUsers={typingUsers}
                        conversationId={conversationId}
                        typingTimeoutRef={typingTimeoutRef}
                        />
                        </Box>

            </Box>

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
