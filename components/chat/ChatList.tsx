'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UsersService } from '@/lib/services/users';
import { tablesDB, realtime  } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
    List,
    ListItem,
    ListItemButton,
    Avatar,
    ListItemText,
    Typography,
    Box,
    CircularProgress,
    Skeleton,
    alpha,
    IconButton,
    Badge,
    ListItemAvatar,
    Divider,
    Stack,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/GroupWorkOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import BookmarkIcon from '@mui/icons-material/BookmarkOutlined';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/LockOutlined';
import ArrowLeftIcon from '@mui/icons-material/ArrowBack';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { seedIdentityCache, getCachedIdentityById  } from '@/lib/identity-cache';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { getConversationReadAt } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import ConversationActionsSheet from './ConversationActionsSheet';

const GlobalSearchAvatar = ({ u }: { u: any }) => {
    const [fetchedAvatarUrl, setFetchedAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!u.avatar || String(u.avatar).startsWith('http')) return;

        let active = true;
        fetchProfilePreview(u.avatar, 64, 64)
            .then(url => {
                if (active) setFetchedAvatarUrl(url as unknown as string);
            })
            .catch(() => {});

        return () => {
            active = false;
        }
    }, [u.avatar]);
    const avatarUrl = u.avatar && String(u.avatar).startsWith('http') ? u.avatar : fetchedAvatarUrl;

    return (
        <Avatar
            src={avatarUrl || undefined}
            sx={{
                bgcolor: '#F59E0B',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                width: 44,
                height: 44
            }}
        >
            {!avatarUrl && (u.displayName || u.username || '?').charAt(0).toUpperCase()}
        </Avatar>
    );
};

export const ChatList = () => {
    const { user } = useAuth();
    const { unreadConversations } = useChatNotifications();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const conversationsRef = React.useRef<any[]>([]);
    const loadRequestRef = React.useRef(0);
    const handledMessageIdsRef = React.useRef<Set<string>>(new Set());
    const [livePreviewByConversation, setLivePreviewByConversation] = useState<Record<string, {
        lastMessageId: string;
        lastMessageText: string;
        lastMessageAt: string;
    }>>({});
    const [activePreviewConversationId, setActivePreviewConversationId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const isLikelyEncrypted = (val: string) => {
        if (!val) return false;
        return val.length > 40 && !val.includes(' ');
    };

    const formatPreviewFromMessage = useCallback((message: any) => {
        if (!message) return 'No messages yet';
        if (message.type === 'text' || message.type === 'attachment') {
            return message.content || `[${message.type}]`;
        }
        return `[${message.type || 'message'}]`;
    }, []);

    const handleGlobalSearch = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await UsersService.searchUsers(query);
            // Hide current user from results
            const filtered = res.rows.filter((u: any) => (u.userId || u.$id) !== user?.$id);
            setSearchResults(filtered);
        } catch (error) {
            console.error('Global search failed:', error);
        } finally {
            setSearching(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                handleGlobalSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, handleGlobalSearch]);

    const startChat = async (targetUser: any) => {
        if (!user) return;
        const targetUserId = targetUser.userId || targetUser.$id;

        if (!targetUser.publicKey) {
            toast.error(`${targetUser.displayName || targetUser.username} hasn't set up their account for secure chatting yet.`);
            return;
        }

        // Check for existing conversation locally
        const found = conversations.find((c: any) =>
            c.type === 'direct' && c.participants?.includes(targetUserId)
        );

        if (found) {
            router.push(`/chat/${found.$id}`);
            return;
        }

        // If not found, ensure Sudo is unlocked before creating
        requestSudo({
            onSuccess: async () => {
                try {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    const participants = [user.$id, targetUserId];
                    const newConv = await ChatService.createConversation(participants, 'direct');
                    router.push(`/chat/${newConv.$id}`);
                } catch (error: any) {
                    console.error('Failed to create chat:', error);
                    toast.error(`Failed to create chat: ${error?.message || 'Unknown error'}`);
                }
            }
        });
    };

    const handleConversationUpdated = useCallback((updatedConversation: any) => {
        if (!updatedConversation?.$id) return;
        startTransition(() => {
            setConversations((prev) => {
                const next = prev.map((conv) => conv.$id === updatedConversation.$id ? { ...conv, ...updatedConversation } : conv);
                next.sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.createdAt || 0).getTime());
                conversationsRef.current = next;
                return next;
            });
        });
    }, []);

    const handleConversationDeleted = useCallback((conversationId: string) => {
        ChatService.clearConversationPreviewCache(conversationId);
        startTransition(() => {
            setConversations((prev) => {
                const next = prev.filter((conv) => conv.$id !== conversationId);
                conversationsRef.current = next;
                return next;
            });
            setLivePreviewByConversation((prev) => {
                if (!prev[conversationId]) return prev;
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            setActivePreviewConversationId((current) => current === conversationId ? null : current);
            setSelectedConversation((current: any) => current?.$id === conversationId ? null : current);
        });
    }, []);

    const loadConversations = React.useCallback(async () => {
        const requestId = ++loadRequestRef.current;
        try {
            if (!ecosystemSecurity.status.isUnlocked) {
                startTransition(() => setConversations([]));
                setLoading(false);
                return;
            }

            console.log('[ChatList] Loading conversations for user:', user!.$id);
            const response = await ChatService.getConversations(user!.$id);
            let rows = [...response.rows];

            // Check if we need to prompt for unlock
            const hasEncrypted = rows.some(c => c.isEncrypted);
            if (hasEncrypted && !ecosystemSecurity.status.isUnlocked) return;

            console.log('[ChatList] Fetched rows count:', rows.length);

            // Bridge: Detect and deduplicate self-chats, then ensure one exists
            const isSelfChat = (c: any) =>
                c.type === 'direct' &&
                c.participants && (c.participants.length === 1 || c.participants.length === 2) &&
                c.participants.every((p: string) => p === user!.$id);

            const allSelfChats = rows.filter(isSelfChat);
            console.log('[ChatList] Self chats found:', allSelfChats.length);

            // Dedup: If more than one self-chat exists, keep the best one and delete the rest
            if (allSelfChats.length > 1) {
                console.log('[ChatList] Duplicate self-chats detected, deduplicating...');
                // Sort: prefer the one with most recent activity, fallback to newest created
                allSelfChats.sort((a, b) => {
                    const timeA = new Date(a.lastMessageAt || a.$createdAt || 0).getTime();
                    const timeB = new Date(b.lastMessageAt || b.$createdAt || 0).getTime();
                    return timeB - timeA;
                });

                const keeper = allSelfChats[0];
                const extras = allSelfChats.slice(1);

                console.log('[ChatList] Keeping self-chat:', keeper.$id);

                // Delete duplicates in background
                for (const dup of extras) {
                    console.log('[ChatList] Removing duplicate self-chat:', dup.$id);
                    ChatService.nuclearWipe(dup.$id)
                        .then(() => tablesDB.deleteRow(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS, dup.$id))
                        .catch(err => console.warn('[ChatList] Failed to remove duplicate self-chat', dup.$id, err));
                }

                // Remove extras from rows
                const extraIds = new Set(extras.map((e: any) => e.$id));
                rows = rows.filter(r => !extraIds.has(r.$id));
            }

            const selfChat = rows.find(isSelfChat);

            if (!selfChat) {
                console.log('[ChatList] Self chat not found, auto-initializing...');
                void (async () => {
                    try {
                        await ecosystemSecurity.ensureE2EIdentity(user!.$id);
                        const newSelfChat = await ChatService.createConversation([user!.$id], 'direct');
                        console.log('[ChatList] Self chat created:', newSelfChat.$id);
                        if (loadRequestRef.current !== requestId) return;
                        startTransition(() => {
                            setConversations((current) => {
                                if (current.some((conv) => conv.$id === newSelfChat.$id)) return current;
                                const next = [newSelfChat, ...current];
                                conversationsRef.current = next;
                                return next;
                            });
                        });
                    } catch (e: unknown) {
                        console.error('[ChatList] Failed to auto-create self chat', e);
                    }
                })();
            }

            const baseRows = rows.map((conv: any) => {
                const memoryPreview = ChatService.getConversationPreviewSnapshot(conv.$id);
                const memoryAt = memoryPreview?.lastMessageAt ? new Date(memoryPreview.lastMessageAt).getTime() : -1;
                const rowAt = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : -1;
                const useMemoryPreview = Boolean(memoryPreview && (memoryAt >= rowAt || !conv.lastMessageText));
                const previewText = useMemoryPreview ? memoryPreview?.lastMessageText : conv.lastMessageText;
                const previewAt = useMemoryPreview ? memoryPreview?.lastMessageAt : conv.lastMessageAt;
                const previewId = useMemoryPreview ? memoryPreview?.lastMessageId : conv.lastMessageId;
                const previewSenderId = useMemoryPreview ? memoryPreview?.lastMessageSenderId : conv.lastMessageSenderId;

                if (conv.type !== 'direct') {
                    return {
                        ...conv,
                        name: conv.name || 'Group Chat',
                        lastMessageText: previewText,
                        lastMessageAt: previewAt,
                        lastMessageId: previewId,
                        lastMessageSenderId: previewSenderId,
                    };
                }

                const isActuallySelf = conv.participants && (conv.participants.length === 1 || conv.participants.length === 2) && conv.participants.every((p: string) => p === user!.$id);
                if (isActuallySelf) {
                    const cachedMe = getCachedIdentityById(user!.$id);
                    const myName = cachedMe?.displayName || cachedMe?.username || user!.name || 'You';
                    return {
                        ...conv,
                        otherUserId: user!.$id,
                        name: `${myName} (You)`,
                        isSelf: true,
                        avatarUrl: cachedMe?.avatar || null,
                        lastMessageText: previewText,
                        lastMessageAt: previewAt,
                        lastMessageId: previewId,
                        lastMessageSenderId: previewSenderId,
                    };
                }

                const otherId = conv.participants?.find((p: string) => p !== user!.$id);
                const cachedOther = otherId ? getCachedIdentityById(otherId) : null;
                return {
                    ...conv,
                    otherUserId: otherId,
                    name: cachedOther?.displayName || cachedOther?.username || (otherId ? `@${otherId.slice(0, 7)}` : 'Direct Chat'),
                    avatarUrl: cachedOther?.avatar || null,
                    lastMessageText: previewText,
                    lastMessageAt: previewAt,
                    lastMessageId: previewId,
                    lastMessageSenderId: previewSenderId,
                };
            });

            const sorted = baseRows.sort((a, b) => {
                if (a.isSelf && !a.lastMessageAt) return -1;
                if (b.isSelf && !b.lastMessageAt) return 1;
                const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
                const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
                return timeB - timeA;
            });

            console.log('[ChatList] Base conversations count:', sorted.length);
            startTransition(() => {
                setConversations(sorted);
                conversationsRef.current = sorted;
            });
            setLoading(false);

            void (async () => {
                const settled = await Promise.allSettled(sorted.map(async (conv: any) => {
                    if (conv.type !== 'direct') return conv;

                    const isActuallySelf = conv.isSelf || (conv.participants && (conv.participants.length === 1 || conv.participants.length === 2) && conv.participants.every((p: string) => p === user!.$id));
                    if (isActuallySelf) {
                        const myProfile = await UsersService.getProfileById(user!.$id);
                        if (!myProfile) return conv;

                        let avatarUrl = null;
                        if (myProfile.avatar?.startsWith?.('http')) {
                            avatarUrl = myProfile.avatar;
                        } else if (myProfile.avatar) {
                            try {
                                avatarUrl = await fetchProfilePreview(myProfile.avatar, 64, 64) as unknown as string;
                            } catch (_e) {}
                        }
                        seedIdentityCache({ ...myProfile, avatar: myProfile.avatar || avatarUrl });
                        return {
                            ...conv,
                            name: `${myProfile.displayName || myProfile.username || user!.name || 'You'} (You)`,
                            avatarUrl
                        };
                    }

                    const otherId = conv.otherUserId || conv.participants?.find((p: string) => p !== user!.$id);
                    if (!otherId) return conv;

                    const profile = await UsersService.getProfileById(otherId);
                    if (!profile) return conv;

                    let avatarUrl = null;
                    if (profile.avatar?.startsWith?.('http')) {
                        avatarUrl = profile.avatar;
                    } else if (profile.avatar) {
                        try {
                            avatarUrl = await fetchProfilePreview(profile.avatar, 64, 64) as unknown as string;
                        } catch (_e) {}
                    }
                    seedIdentityCache({ ...profile, avatar: profile.avatar || avatarUrl });
                    return {
                        ...conv,
                        otherUserId: otherId,
                        name: profile.displayName || profile.username || `@${otherId.slice(0, 7)}`,
                        avatarUrl
                    };
                }));

                if (loadRequestRef.current !== requestId) return;
                const enriched = settled.map((entry, index) => entry.status === 'fulfilled' ? entry.value : sorted[index]);
                const next = enriched.sort((a, b) => {
                    if (a.isSelf && !a.lastMessageAt) return -1;
                    if (b.isSelf && !b.lastMessageAt) return 1;
                    const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
                    const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
                    return timeB - timeA;
                });
                startTransition(() => {
                    setConversations(next);
                    conversationsRef.current = next;
                });
            })();
        } catch (error: unknown) {
            console.error('Failed to load chats:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (status.isUnlocked === isUnlocked) return;
            setIsUnlocked(status.isUnlocked);
            if (status.isUnlocked) {
                loadConversations();
            } else {
                ChatService.clearConversationPreviewCache();
                startTransition(() => setConversations([]));
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [isUnlocked, loadConversations]);

    useEffect(() => {
        if (!user) return;

        loadConversations();

        const conversationChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.rows`;
        const messageChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.rows`;

        const subscription: any = realtime.subscribe([conversationChannel, messageChannel], async (response) => {
            const payload = response.payload;
            const isConversationEvent = Array.isArray(payload?.participants);
            const relatedConversationId = isConversationEvent ? payload?.$id : payload?.conversationId;

            if (!relatedConversationId) return;

            if (isConversationEvent) {
                if (response.events.some(e => e.includes('.delete'))) {
                    ChatService.clearConversationPreviewCache(relatedConversationId);
                    startTransition(() => {
                        setConversations(prev => prev.filter(c => c.$id !== relatedConversationId));
                    });
                    return;
                }
                loadConversations();
                return;
            }

            if (response.events.some(e => e.includes('.delete'))) {
                ChatService.clearConversationPreviewCache(relatedConversationId);
                startTransition(() => {
                    setConversations(prev => prev.filter(c => c.$id !== relatedConversationId));
                    conversationsRef.current = conversationsRef.current.filter(c => c.$id !== relatedConversationId);
                    setLivePreviewByConversation((prev) => {
                        if (!prev[relatedConversationId]) return prev;
                        const next = { ...prev };
                        delete next[relatedConversationId];
                        return next;
                    });
                    setActivePreviewConversationId((current) => current === relatedConversationId ? null : current);
                });
                return;
            }

            const existingIndex = conversationsRef.current.findIndex(c => c.$id === relatedConversationId);
            if (existingIndex === -1) {
                loadConversations();
                return;
            }

            if (response.events.some(e => e.includes('.create')) && payload?.$id && !handledMessageIdsRef.current.has(payload.$id)) {
                handledMessageIdsRef.current.add(payload.$id);
                const livePreviewAt = payload.$createdAt || payload.createdAt || new Date().toISOString();

                let livePreviewText = formatPreviewFromMessage(payload);
                try {
                    const latest = await ChatService.getMessages(relatedConversationId, 1, 0, user?.$id);
                    const latestMessage = latest.rows?.[0];
                    if (latestMessage) {
                        livePreviewText = formatPreviewFromMessage(latestMessage);
                    }
                } catch (error) {
                    console.warn('[ChatList] Failed to hydrate live preview:', error);
                }

                setLivePreviewByConversation((prev) => ({
                    ...prev,
                    [relatedConversationId]: {
                        lastMessageId: payload.$id,
                        lastMessageText: livePreviewText,
                        lastMessageAt: livePreviewAt,
                    },
                }));
                setActivePreviewConversationId(relatedConversationId);
                window.setTimeout(() => {
                    setActivePreviewConversationId((current) => current === relatedConversationId ? null : current);
                }, 900);

                startTransition(() => {
                    setConversations(prev => {
                        const next = [...prev];
                        const current = next[existingIndex];
                        next[existingIndex] = {
                            ...current,
                            lastMessageAt: livePreviewAt,
                            lastMessageId: payload.$id,
                            lastMessageSenderId: payload.senderId || current.lastMessageSenderId,
                            lastMessageText: livePreviewText,
                        };

                        next.sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.createdAt || 0).getTime());
                        conversationsRef.current = next;
                        return next;
                    });
                });
                return;
            }

            startTransition(() => {
                setConversations(prev => {
                    const next = [...prev];
                    const current = next[existingIndex];
                    next[existingIndex] = {
                        ...current,
                        lastMessageAt: payload.$createdAt || payload.createdAt || current.lastMessageAt,
                        lastMessageId: payload.$id || current.lastMessageId,
                        lastMessageSenderId: payload.senderId || current.lastMessageSenderId,
                        lastMessageText: formatPreviewFromMessage(payload) || current.lastMessageText,
                    };

                    next.sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.createdAt || 0).getTime());
                    conversationsRef.current = next;
                    return next;
                });
            });
        });

        return () => {
            if (typeof subscription === 'function') subscription();
            else if (subscription?.unsubscribe) subscription.unsubscribe();
        };
    }, [user, loadConversations, formatPreviewFromMessage]);

    if (loading) return (
        <Box sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1 }}>
                        <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="55%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            <Skeleton width="35%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );

    const filteredConversations = conversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const hasNoConversations = filteredConversations.length === 0;
    const showGlobalResults = searchQuery.length >= 2 && searchResults.length > 0;

    return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: '#000000', position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ p: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                    <IconButton
                        onClick={() => router.push('/')}
                        aria-label="Back to menu"
                        sx={{
                            width: 40,
                            height: 40,
                bgcolor: '#000000',
                            color: 'text.primary',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 16px rgba(245, 158, 11, 0.08)',
                            '&:hover': {
                                bgcolor: '#000000',
                                borderColor: 'rgba(255, 255, 255, 0.12)',
                                boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.08), 0 0 22px rgba(245, 158, 11, 0.12)'
                            }
                        }}
                    >
                        <ArrowLeftIcon fontSize="small" />
                    </IconButton>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 900,
                            fontFamily: 'var(--font-clash)',
                            letterSpacing: '-0.02em',
                            color: 'text.primary'
                        }}
                    >
                        Messages
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: '#000000',
                        borderRadius: '12px',
                        px: 2,
                        py: 1,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 22px rgba(245, 158, 11, 0.08)',
                        position: 'relative',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px'
                        },
                        '&:focus-within': {
                            borderColor: '#6366F1',
                            bgcolor: '#000000'
                        }
                    }}
                >
                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    <input
                        placeholder="Search conversations or people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            fontSize: '0.875rem',
                            outline: 'none',
                            width: '100%',
                            fontFamily: 'var(--font-satoshi)'
                        }}
                    />
                    {searching && <CircularProgress size={14} sx={{ color: 'primary.main' }} />}
                </Box>
            </Box>

            <Box sx={{
                overflowY: 'auto',
                flex: 1,
                px: 1
            }}>
                {showGlobalResults && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ px: 2, mb: 1, display: 'block', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Global Search
                        </Typography>
                        <List sx={{ pt: 0 }}>
                            {searchResults.map((u) => {
                                const targetId = u.userId || u.$id;
                                const hasChat = conversations.some(c => c.type === 'direct' && c.participants?.includes(targetId));
                                return (
                                    <ListItem key={u.$id} disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton
                                            onClick={() => startChat(u)}
                                            sx={{
                                                borderRadius: '12px',
                                                py: 1,
                            bgcolor: '#000000',
                                                border: '1px solid rgba(255, 255, 255, 0.07)',
                                                boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 18px rgba(245, 158, 11, 0.08)',
                                                '&:hover': {
                                                    bgcolor: '#000000',
                                                    borderColor: 'rgba(255, 255, 255, 0.1)',
                                                    boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.08), 0 0 22px rgba(245, 158, 11, 0.12)'
                                                }
                                            }}
                                        >
                                            <ListItemAvatar sx={{ minWidth: 56 }}>
                                                <GlobalSearchAvatar u={u} />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={u.displayName || u.username}
                                                secondary={`@${u.username}`}
                                                primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                                                secondaryTypographyProps={{ fontSize: '0.75rem', sx: { opacity: 0.5 } }}
                                            />
                                            {!hasChat && (
                                                <Box sx={{ 
                                                    px: 1, 
                                                    py: 0.2, 
                                                    borderRadius: '4px', 
                                                    bgcolor: alpha('#6366F1', 0.1), 
                                                    border: '1px solid rgba(99, 102, 241, 0.2)' 
                                                }}>
                                                    <Typography sx={{ fontSize: '9px', fontWeight: 900, color: '#6366F1' }}>NEW</Typography>
                                                </Box>
                                            )}
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                        <Divider sx={{ mx: 2, my: 1, opacity: 0.05 }} />
                    </Box>
                )}

                {hasNoConversations && !showGlobalResults ? (
                    <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>No conversations</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>Search for people to start a chat</Typography>
                    </Box>
                ) : (
                    <List sx={{ pt: 0 }}>
                        {filteredConversations.map((conv) => (
                            <ListItem key={conv.$id} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    component={Link}
                                    href={`/chat/${conv.$id}`}
                                        sx={{
                                        borderRadius: '12px',
                                        py: 1.5,
                                        transition: 'all 160ms ease',
                                        bgcolor: '#000000',
                                        border: '1px solid rgba(255, 255, 255, 0.07)',
                                        boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 18px rgba(245, 158, 11, 0.08)',
                                        ...(activePreviewConversationId === conv.$id ? {
                                                bgcolor: '#000000',
                                            boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.25), 0 0 30px rgba(99, 102, 241, 0.12)',
                                            transform: 'translateY(-1px)',
                                        } : {}),
                                        '&:hover': {
                                                    bgcolor: '#000000',
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.08), 0 0 22px rgba(245, 158, 11, 0.12)'
                                        }
                                    }}
                                >
                                        <Box
                                            component="span"
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setSelectedConversation(conv);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setSelectedConversation(conv);
                                            }}
                                            sx={{
                                                mr: 1.25,
                                                display: 'inline-flex',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <Avatar
                                                src={conv.avatarUrl}
                                                sx={{
                                                    bgcolor: conv.avatarUrl ? 'transparent' : '#F59E0B',
                                                    color: '#FFFFFF',
                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                    boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 16px rgba(245, 158, 11, 0.08)',
                                                    width: 44,
                                                    height: 44
                                                }}
                                            >
                                                {conv.isSelf ? <BookmarkIcon sx={{ fontSize: 20 }} /> : (conv.type === 'group' ? <GroupIcon sx={{ fontSize: 22 }} /> : (conv.name?.replace(/^@/, '').charAt(0).toUpperCase() || <PersonIcon sx={{ fontSize: 22, color: '#F59E0B' }} />))}
                                            </Avatar>
                                        </Box>
                                    <ListItemText
                                        primary={conv.name || (conv.type === 'direct' ? conv.otherUserId : 'Group Chat')}
                                        secondary={
                                            (() => {
                                                const memoryPreview = ChatService.getConversationPreviewSnapshot(conv.$id);
                                                const memoryAt = memoryPreview?.lastMessageAt ? new Date(memoryPreview.lastMessageAt).getTime() : -1;
                                                const rowAt = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : -1;
                                                const memoryText = memoryPreview && (memoryAt >= rowAt || !conv.lastMessageText)
                                                    ? memoryPreview.lastMessageText
                                                    : null;
                                                const resolvedPreview = livePreviewByConversation[conv.$id]?.lastMessageText || memoryText || conv.lastMessageText || 'No messages yet';

                                                return (conv.isEncrypted && !isUnlocked && isLikelyEncrypted(resolvedPreview)) ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <LockIcon sx={{ fontSize: 12, opacity: 0.5 }} />
                                                    <span>Encrypted message</span>
                                                </Box>
                                                ) : resolvedPreview;
                                            })()
                                        }
                                        primaryTypographyProps={{
                                            fontWeight: 700,
                                            fontSize: '0.95rem',
                                            color: conv.isSelf ? '#6366F1' : 'text.primary',
                                            fontFamily: 'var(--font-clash)'
                                        }}
                                        secondaryTypographyProps={{
                                            noWrap: true,
                                            fontSize: '0.75rem',
                                            sx: { opacity: 0.5, mt: 0.3 }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                        {conv.lastMessageAt && (
                                            <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600 }}>
                                                {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </Typography>
                                        )}
                                        {/* Show unread only when the conversation has not been locally marked read */}
                                        {conv.lastMessageAt && conv.lastMessageId && !conv.isSelf && (() => {
                                            const readAt = getConversationReadAt(user?.$id, conv.$id);
                                            const isUnread = unreadConversations.has(conv.$id) || (
                                                conv.lastMessageSenderId !== user?.$id &&
                                                new Date(conv.lastMessageAt).getTime() > readAt
                                            );
                                            return isUnread ? (
                                                <Badge 
                                                    variant="dot" 
                                                    color="primary" 
                                                    sx={{ 
                                                        '& .MuiBadge-badge': { 
                                                            bgcolor: '#6366F1',
                                                            boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)'
                                                        } 
                                                    }} 
                                                />
                                            ) : null;
                                        })()}
                                    </Box>
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </Box>

            <ConversationActionsSheet
                conversation={selectedConversation}
                open={Boolean(selectedConversation)}
                onClose={() => setSelectedConversation(null)}
                onConversationUpdated={handleConversationUpdated}
                onConversationDeleted={handleConversationDeleted}
            />

        </Box>
    );
};
