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
import { IdentityAvatar } from '../IdentityBadge';
import { seedIdentityCache, getCachedIdentityById  } from '@/lib/identity-cache';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { getConversationReadAt } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import ConversationActionsSheet from './ConversationActionsSheet';

const GlobalSearchAvatar = ({ u }: { u: any }) => {
    const userId = u.userId || u.$id;
    const profilePicId = u.avatar || u.profilePicId || null;
    
    return (
        <IdentityAvatar
            src={profilePicId}
            alt={u.displayName || u.username || 'user'}
            fallback={(u.displayName || u.username || '?').charAt(0).toUpperCase()}
            size={44}
        />
    );
};

export const ChatList = ({ externalQuery = '' }: { externalQuery?: string }) => {
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
    const loadConversationsInflightRef = React.useRef<Promise<void> | null>(null);
    const handledMessageIdsRef = React.useRef<Set<string>>(new Set());
    const [livePreviewByConversation, setLivePreviewByConversation] = useState<Record<string, {
        lastMessageId: string;
        lastMessageText: string;
        lastMessageAt: string;
    }>>({});
    const [activePreviewConversationId, setActivePreviewConversationId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    // Sync external query to local search
    useEffect(() => {
        if (externalQuery !== undefined) {
            setSearchQuery(externalQuery);
        }
    }, [externalQuery]);

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
            const rows = Array.isArray(res)
                ? res
                : Array.isArray((res as any)?.rows)
                    ? (res as any).rows
                    : [];
            // Hide current user from results
            const filtered = rows.filter((u: any) => (u.userId || u.$id) !== user?.$id);
            setSearchResults(filtered);
        } catch (error) {
            console.error('Global search failed:', error);
            setSearchResults([]);
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
            router.push(`/connect/chat/${found.$id}`);
            return;
        }

        // If not found, ensure Sudo is unlocked before creating
        requestSudo({
            onSuccess: async () => {
                try {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    const participants = [user.$id, targetUserId];
                    const newConv = await ChatService.createConversation(participants, 'direct');
                    router.push(`/connect/chat/${newConv.$id}`);
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
        const existingRun = loadConversationsInflightRef.current;
        if (existingRun) {
            await existingRun;
            return;
        }

        const run = (async () => {
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
        })();

        loadConversationsInflightRef.current = run;
        try {
            await run;
        } finally {
            if (loadConversationsInflightRef.current === run) {
                loadConversationsInflightRef.current = null;
            }
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
                    const convRow = conversationsRef.current[existingIndex];
                    const latest = await ChatService.getMessages(relatedConversationId, 1, 0, user?.$id, {
                        prefetchedConversation: convRow,
                    });
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
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: '#161412', position: 'relative', overflow: 'hidden' }}>
            {!externalQuery && (
                <Box sx={{ p: 3, pb: 2, borderBottom: '1px solid #34322F' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                        <IconButton
                            onClick={() => router.push('/')}
                            aria-label="Back to menu"
                            sx={{
                                width: 40,
                                height: 40,
                                bgcolor: '#1C1A18',
                                color: '#fff',
                                border: '1px solid #34322F',
                                '&:hover': {
                                    bgcolor: '#1F1D1B',
                                    borderColor: '#6366F1',
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
                                color: '#fff'
                            }}
                        >
                            Messages
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            bgcolor: '#0A0908',
                            borderRadius: '12px',
                            px: 2,
                            py: 1.2,
                            border: '1px solid #34322F',
                            '&:focus-within': {
                                borderColor: '#F59E0B',
                            }
                        }}
                    >
                        <SearchIcon sx={{ fontSize: 18, color: '#9B9691' }} />
                        <input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                fontSize: '0.9rem',
                                outline: 'none',
                                width: '100%',
                                fontFamily: 'var(--font-satoshi)'
                            }}
                        />
                        {searching && <CircularProgress size={14} sx={{ color: '#F59E0B' }} />}
                    </Box>
                </Box>
            )}

            <Box sx={{
                overflowY: 'auto',
                flex: 1,
                px: 2,
                py: 2
            }}>
                {showGlobalResults && (
                    <Box sx={{ mb: 4 }}>
                        <Typography sx={{ px: 1, mb: 2, display: 'block', fontWeight: 900, color: '#9B9691', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                            Global Directory
                        </Typography>
                        <List sx={{ pt: 0 }}>
                            {searchResults.map((u) => {
                                const targetId = u.userId || u.$id;
                                const hasChat = conversations.some(c => c.type === 'direct' && c.participants?.includes(targetId));
                                return (
                                    <ListItem key={u.$id} disablePadding sx={{ mb: 1 }}>
                                        <ListItemButton
                                            onClick={() => startChat(u)}
                                            sx={{
                                                borderRadius: '16px',
                                                py: 1.5,
                                                bgcolor: '#1C1A18',
                                                border: '1px solid #34322F',
                                                '&:hover': {
                                                    bgcolor: '#1F1D1B',
                                                    borderColor: '#F59E0B',
                                                }
                                            }}
                                        >
                                            <ListItemAvatar sx={{ minWidth: 60 }}>
                                                <GlobalSearchAvatar u={u} />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={u.displayName || u.username}
                                                secondary={`@${String(u.username).replace(/^@/, '')}`}
                                                primaryTypographyProps={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}
                                                secondaryTypographyProps={{ fontSize: '0.8rem', sx: { color: '#9B9691', mt: 0.2 } }}
                                            />
                                            {!hasChat && (
                                                <Box sx={{ 
                                                    px: 1.5, 
                                                    py: 0.5, 
                                                    borderRadius: '8px', 
                                                    bgcolor: '#F59E0B', 
                                                    color: '#000'
                                                }}>
                                                    <Typography sx={{ fontSize: '10px', fontWeight: 900 }}>NEW</Typography>
                                                </Box>
                                            )}
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                        <Divider sx={{ my: 3, borderColor: '#34322F' }} />
                    </Box>
                )}

                {hasNoConversations && !showGlobalResults ? (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem', mb: 1, fontFamily: 'var(--font-clash)' }}>Quiet Frequency</Typography>
                        <Typography variant="body2" sx={{ color: '#9B9691', fontWeight: 500 }}>No encrypted channels found matching your query.</Typography>
                    </Box>
                ) : (
                    <List sx={{ pt: 0 }}>
                        {filteredConversations.map((conv) => (
                            <ListItem key={conv.$id} disablePadding sx={{ mb: 1 }}>
                                <ListItemButton
                                    component={Link}
                                    href={`/connect/chat/${conv.$id}`}
                                        sx={{
                                        borderRadius: '16px',
                                        py: 2,
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        bgcolor: '#1C1A18',
                                        border: '1px solid #34322F',
                                        ...(activePreviewConversationId === conv.$id ? {
                                            borderColor: '#6366F1',
                                            transform: 'translateY(-2px)',
                                        } : {}),
                                        '&:hover': {
                                            bgcolor: '#1F1D1B',
                                            borderColor: '#34322F',
                                            transform: 'translateY(-2px)'
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
                                                mr: 2,
                                                display: 'inline-flex',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <IdentityAvatar
                                                src={conv.avatarUrl || conv.avatar || null}
                                                alt={conv.name}
                                                fallback={conv.name?.replace(/^@/, '').charAt(0).toUpperCase() || 'U'}
                                                size={48}
                                                pro={conv.isSelf}
                                            />
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
                                                    <LockIcon sx={{ fontSize: 12, color: '#9B9691' }} />
                                                    <span>Secured Payload</span>
                                                </Box>
                                                ) : resolvedPreview;
                                            })()
                                        }
                                        primaryTypographyProps={{
                                            fontWeight: 800,
                                            fontSize: '1rem',
                                            color: conv.isSelf ? '#F59E0B' : '#fff',
                                            fontFamily: 'var(--font-clash)',
                                            letterSpacing: '-0.01em'
                                        }}
                                        secondaryTypographyProps={{
                                            noWrap: true,
                                            fontSize: '0.85rem',
                                            sx: { color: '#9B9691', mt: 0.5, fontWeight: 500 }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5, ml: 1 }}>
                                        {conv.lastMessageAt && (
                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#9B9691', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
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
                                                    sx={{ 
                                                        '& .MuiBadge-badge': { 
                                                            bgcolor: '#F59E0B',
                                                            boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)',
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: '50%'
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
