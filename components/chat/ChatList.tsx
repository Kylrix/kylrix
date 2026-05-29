'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { ChatService, rememberConversationRoster } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UsersService } from '@/lib/services/users';
import { tablesDB, realtime  } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { usePresence } from '../providers/PresenceProvider';
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
    Tabs,
    Tab,
    Button,
    Drawer,
} from '@mui/material';
import ShieldCheckIcon from '@mui/icons-material/ShieldOutlined';
import { showIslandNotification } from '@/lib/island-notification';
import { createGhostNoteChat, listGhostNoteChats, deleteGhostThread } from '@/lib/actions/client-ops';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { Trash2 } from 'lucide-react';
import GroupIcon from '@mui/icons-material/GroupWorkOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import BookmarkIcon from '@mui/icons-material/BookmarkOutlined';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/LockOutlined';
import ArrowLeftIcon from '@mui/icons-material/ArrowBack';
import ProjectIcon from '@mui/icons-material/FolderSpecialOutlined';
import TaskIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import EventIcon from '@mui/icons-material/CalendarTodayOutlined';
import FormIcon from '@mui/icons-material/DescriptionOutlined';
import TagIcon from '@mui/icons-material/LocalOfferOutlined';
import NoteIcon from '@mui/icons-material/StickyNote2Outlined';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar } from '../IdentityBadge';
import { seedIdentityCache, getCachedIdentityById  } from '@/lib/identity-cache';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { getConversationReadAt } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import ConversationActionsSheet from './ConversationActionsSheet';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import LaunchIcon from '@mui/icons-material/Launch';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';

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

export const ChatList = ({ 
    externalQuery = '',
    activeTab: propActiveTab,
    onTabChange
}: { 
    externalQuery?: string;
    activeTab?: 'secure' | 'public';
    onTabChange?: (tab: 'secure' | 'public') => void;
}) => {
    const { user } = useAuth();
    const { unreadConversations } = useChatNotifications();
    const { globalPresence } = usePresence();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const { openMenu } = useContextMenu();
    const { open: openUnified } = useUnifiedDrawer();
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
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTabState] = useState<'secure' | 'public'>(() => {
        return propActiveTab || (ecosystemSecurity.status.isUnlocked ? 'secure' : 'public');
    });

    const [ghostConversations, setGhostConversations] = useState<any[]>([]);
    const [loadingGhost, setLoadingGhost] = useState(false);

    const [isInitializing, setIsInitializing] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [showCountdownDrawer, setShowCountdownDrawer] = useState(false);

    const setActiveTab = useCallback((tab: 'secure' | 'public') => {
        setActiveTabState(tab);
        if (onTabChange) onTabChange(tab);
    }, [onTabChange]);

    const handleItemClick = useCallback((event: React.MouseEvent) => {
        if (isInitializing) {
            event.preventDefault();
            event.stopPropagation();
            showIslandNotification({
                type: 'warning',
                title: 'Initializing Encryption',
                message: 'Securing connection channels...',
                app: 'connect',
                majestic: false,
                duration: 4000
            });
        }
    }, [isInitializing]);

    const handleConversationRightClick = useCallback((event: React.MouseEvent, conv: any) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu({
            x: event.clientX,
            y: event.clientY,
            appType: 'connect',
            items: [
                {
                    label: 'Open Secure Chat',
                    icon: <LaunchIcon sx={{ fontSize: 18 }} />,
                    onClick: () => router.push(`/connect/chat/${conv.$id}`)
                },
                {
                    label: 'Copy Connection Link',
                    icon: <LinkIcon sx={{ fontSize: 18 }} />,
                    onClick: () => {
                        const link = `${window.location.origin}/connect/chat/${conv.$id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Connection link copied');
                    }
                },
                {
                    label: 'Manage Discussion',
                    icon: <TuneIcon sx={{ fontSize: 18 }} />,
                    onClick: () => setSelectedConversation(conv)
                },
                {
                    label: 'Wipe Conversation',
                    icon: <Trash2 size={18} style={{ color: '#EF4444' }} />,
                    onClick: () => {
                        openUnified('delete-confirm', {
                            title: `WIPE [ ${conv.name || 'CHAT'} ]`,
                            description: 'This will permanently destroy all messages, reactions, and associated assets. This action cannot be reversed.',
                            confirmLabel: 'Destroy Conversation',
                            onConfirm: async () => {
                                try {
                                    // For normal chats, we need a slightly different wipe logic
                                    // but if it's a ghost note thread (which many of these are),
                                    // deleteGhostThread works perfectly.
                                    await deleteGhostThread(conv.$id);
                                    toast.success('Conversation wiped');
                                    // Refresh the list
                                    setConversations(prev => prev.filter(c => c.$id !== conv.$id));
                                } catch (err: any) {
                                    toast.error(`Wipe failed: ${err.message}`);
                                }
                            }
                        });
                    }
                }
            ]
        });
    }, [openMenu, router, openUnified]);

    const handleGhostConversationRightClick = useCallback((event: React.MouseEvent, conv: any) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu({
            x: event.clientX,
            y: event.clientY,
            appType: 'connect',
            items: [
                {
                    label: 'Open Discussion Thread',
                    icon: <LaunchIcon sx={{ fontSize: 18 }} />,
                    onClick: () => router.push(`/connect/chat/${conv.$id}`)
                },
                {
                    label: 'Copy Thread ID',
                    icon: <LinkIcon sx={{ fontSize: 18 }} />,
                    onClick: () => {
                        navigator.clipboard.writeText(conv.$id);
                        toast.success('Thread ID copied');
                    }
                },
                {
                    label: 'Copy Discussion Link',
                    icon: <LinkIcon sx={{ fontSize: 18 }} />,
                    onClick: () => {
                        const link = `${window.location.origin}/connect/chat/${conv.$id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Discussion link copied');
                    }
                },
                {
                    label: 'Wipe Conversation',
                    icon: <Trash2 size={18} style={{ color: '#EF4444' }} />,
                    onClick: () => {
                        openUnified('delete-confirm', {
                            title: `WIPE [ ${conv.name || 'THREAD'} ]`,
                            description: 'This will permanently destroy the ghost note, all messages, reactions, and any associated voice note files. This action cannot be reversed.',
                            confirmLabel: 'Destroy Conversation',
                            onConfirm: async () => {
                                try {
                                    await deleteGhostThread(conv.$id);
                                    toast.success('Conversation wiped');
                                    // Refresh the list
                                    setConversations(prev => prev.filter(c => c.$id !== conv.$id));
                                } catch (err: any) {
                                    toast.error(`Wipe failed: ${err.message}`);
                                }
                            }
                        });
                    }
                }
            ]
        });
    }, [openMenu, router, openUnified]);

    const handleCancelRedirect = useCallback(() => {
        setShowCountdownDrawer(false);
        setActiveTab('public');
    }, [setActiveTab]);

    // Load cached lists from localStorage on mount & check implicit intent
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const storedTab = localStorage.getItem('kylrix_connect_active_tab');
                if (storedTab === 'secure' || storedTab === 'public') {
                    localStorage.removeItem('kylrix_connect_active_tab');
                    setActiveTabState(storedTab);
                    if (onTabChange) onTabChange(storedTab);
                }

                const cachedSec = localStorage.getItem('kylrix_connect_cached_secure_v1');
                if (cachedSec) {
                    const parsed = JSON.parse(cachedSec);
                    setConversations(parsed);
                    conversationsRef.current = parsed;
                }
                const cachedThr = localStorage.getItem('kylrix_connect_cached_threads_v1');
                if (cachedThr) {
                    setGhostConversations(JSON.parse(cachedThr));
                }
            } catch (e) {
                console.warn('[ChatList] Failed to parse cached conversations:', e);
            }
        }
    }, [onTabChange]);

    // Query MasterPass status when user is loaded
    useEffect(() => {
        if (user?.$id) {
            import('@/lib/appwrite/keychain')
                .then(({ KeychainService }) => KeychainService.hasMasterpass(user.$id))
                .then(setHasMasterpass)
                .catch(() => setHasMasterpass(false));
        }
    }, [user?.$id]);

    // Secure tab setup redirection countdown trigger
    useEffect(() => {
        if (activeTab === 'secure' && hasMasterpass === false) {
            setShowCountdownDrawer(true);
        } else {
            setShowCountdownDrawer(false);
        }
    }, [activeTab, hasMasterpass]);

    // Active secure query 800ms grace timeout to show cache
    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => {
            if (loading) {
                try {
                    const cachedSec = localStorage.getItem('kylrix_connect_cached_secure_v1');
                    if (cachedSec) {
                        const parsed = JSON.parse(cachedSec);
                        if (parsed.length > 0) {
                            setConversations(parsed);
                            conversationsRef.current = parsed;
                            setIsInitializing(true);
                            setLoading(false);
                        }
                    }
                } catch (e) {
                    console.warn('[ChatList] Secure caching fallback error:', e);
                }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [loading]);

    // Active threads query 800ms grace timeout to show cache
    useEffect(() => {
        if (!loadingGhost) return;
        const timer = setTimeout(() => {
            if (loadingGhost) {
                try {
                    const cachedThr = localStorage.getItem('kylrix_connect_cached_threads_v1');
                    if (cachedThr) {
                        const parsed = JSON.parse(cachedThr);
                        if (parsed.length > 0) {
                            setGhostConversations(parsed);
                            setIsInitializing(true);
                            setLoadingGhost(false);
                        }
                    }
                } catch (e) {
                    console.warn('[ChatList] Thread caching fallback error:', e);
                }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [loadingGhost]);

    useEffect(() => {
        if (propActiveTab) {
            setActiveTabState(propActiveTab);
        }
    }, [propActiveTab]);

    useEffect(() => {
        if (isUnlocked) {
            setActiveTab('secure');
        } else {
            setActiveTab('public');
        }
    }, [isUnlocked, setActiveTab]);

    useEffect(() => {
        rememberConversationRoster(conversations);
    }, [conversations]);

    useEffect(() => () => {
        rememberConversationRoster([]);
    }, []);

    const loadGhostConversations = React.useCallback(async () => {
        if (!user) return;
        setLoadingGhost(true);
        try {
            console.log('[ChatList] Loading ghost huddle chats...');
            const results = await listGhostNoteChats();
            console.log('[ChatList] Loaded ghost huddle chats count:', results.length);
            
            const mapped = await Promise.all(results.map(async (note: any) => {
                let metadataObj: any = {};
                try {
                    metadataObj = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : (note.metadata || {});
                } catch (e) {
                    metadataObj = {};
                }

                const linkedResourceType = metadataObj.linkedResourceType || null;
                const linkedResourceId = metadataObj.linkedResourceId || null;
                const linkedResourceName = metadataObj.linkedResourceName || null;

                const isChat = !!(note.isChat || metadataObj.isChat || linkedResourceType === 'chat');
                const cleanLinkedResourceType = isChat ? null : (linkedResourceType || null);

                const participants = note.collaborators || metadataObj.participants || [];
                const otherId = participants.find((p: string) => p !== user.$id);
                
                let otherName = note.title || 'Huddle';
                let avatarUrl = null;
                
                if (cleanLinkedResourceType) {
                    otherName = note.title || linkedResourceName || `${cleanLinkedResourceType.charAt(0).toUpperCase() + cleanLinkedResourceType.slice(1)} Huddle`;
                } else if (otherId) {
                    const cachedOther = getCachedIdentityById(otherId);
                    if (cachedOther) {
                        otherName = cachedOther.displayName || cachedOther.username || `@${otherId.slice(0, 7)}`;
                        avatarUrl = cachedOther.avatar || null;
                    } else {
                        try {
                            const profile = await UsersService.getProfileById(otherId);
                            if (profile) {
                                if (profile.avatar?.startsWith?.('http')) {
                                    avatarUrl = profile.avatar;
                                } else if (profile.avatar) {
                                    try {
                                        avatarUrl = await fetchProfilePreview(profile.avatar, 64, 64) as unknown as string;
                                    } catch (_e) {}
                                }
                                seedIdentityCache({ ...profile, avatar: profile.avatar || avatarUrl });
                                otherName = profile.displayName || profile.username || `@${otherId.slice(0, 7)}`;
                            }
                        } catch (err) {
                            console.warn('[ChatList] Failed to resolve huddle other identity:', err);
                        }
                    }
                }

                return {
                    ...note,
                    otherUserId: otherId,
                    name: otherName,
                    avatarUrl,
                    isGhostChat: true,
                    linkedResourceType: cleanLinkedResourceType,
                    linkedResourceId,
                    linkedResourceName,
                    lastMessageText: note.content || 'Huddle discussion initialized',
                    lastMessageAt: note.updatedAt || note.$createdAt,
                };
            }));

            mapped.sort((a: any, b: any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
            
            if (typeof window !== 'undefined') {
                localStorage.setItem('kylrix_connect_cached_threads_v1', JSON.stringify(mapped));
            }
            startTransition(() => {
                setGhostConversations(mapped);
            });
            setIsInitializing(false);
        } catch (error) {
            console.error('Failed to load ghost huddles:', error);
        } finally {
            setLoadingGhost(false);
        }
    }, [user, startTransition]);

    useEffect(() => {
        if (activeTab === 'public') {
            loadGhostConversations();
        }
    }, [activeTab, loadGhostConversations]);

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
            const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
            const res = await searchGlobalUsers(query);
            const rows = Array.isArray(res)
                ? res
                : Array.isArray((res as any)?.rows)
                    ? (res as any).rows
                    : [];
            
            // Format results robustly so both direct row properties and mapped properties are set
            const mapped = rows.map((u: any) => ({
                ...u,
                $id: u.$id || u.id,
                userId: u.userId || u.id,
                displayName: u.displayName || u.title || '',
                username: u.username || u.subtitle?.replace(/^@/, '') || '',
                avatar: u.avatar || null
            }));

            // Hide current user from results
            const filtered = mapped.filter((u: any) => (u.userId || u.$id) !== user?.$id);
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

        // If E2EE is locked, OR the target user has no publicKey, OR we are in the Threads tab, start a huddle thread
        if (!isUnlocked || !targetUser.publicKey || activeTab === 'public') {
            try {
                toast.loading('Initializing huddle...', { id: 'ghost-init' });
                const existingGhosts = await listGhostNoteChats();
                const foundGhost = existingGhosts.find((c: any) => {
                    let metadataObj: any = {};
                    try {
                        metadataObj = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {});
                    } catch {}
                    const participants = c.collaborators || metadataObj.participants || [];
                    return participants.includes(targetUserId);
                });

                if (foundGhost) {
                    toast.dismiss('ghost-init');
                    router.push(`/connect/chat/${foundGhost.$id}`);
                    return;
                }

                const title = targetUser.displayName || targetUser.username || 'Huddle';
                const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
                toast.success('Huddle thread ready!', { id: 'ghost-init' });
                router.push(`/connect/chat/${newGhost.$id}`);
            } catch (error: any) {
                console.error('Failed to create huddle:', error);
                toast.error(`Failed: ${error?.message || 'Unknown error'}`, { id: 'ghost-init' });
            }
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
    }, [startTransition]);

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
    }, [startTransition]);

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
            if (typeof window !== 'undefined') {
                localStorage.setItem('kylrix_connect_cached_secure_v1', JSON.stringify(sorted));
            }
            startTransition(() => {
                setConversations(sorted);
                conversationsRef.current = sorted;
            });
            setIsInitializing(false);
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
                if (typeof window !== 'undefined') {
                    localStorage.setItem('kylrix_connect_cached_secure_v1', JSON.stringify(next));
                }
                startTransition(() => {
                    setConversations(next);
                    conversationsRef.current = next;
                });
                setIsInitializing(false);
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
    }, [user, startTransition]);

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
    }, [isUnlocked, loadConversations, startTransition]);

    useEffect(() => {
        if (!user) return;

        loadConversations();
        if (activeTab === 'public') {
            loadGhostConversations();
        }

        const conversationChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.documents`;
        const messageChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`;
        const noteChannel = `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.documents`;

        const subscription: any = realtime.subscribe([conversationChannel, messageChannel, noteChannel], async (response) => {
            if (response.channels.some(ch => ch.includes(APPWRITE_CONFIG.TABLES.NOTE.NOTES))) {
                loadGhostConversations();
                return;
            }
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
    }, [user, activeTab, loadConversations, loadGhostConversations, formatPreviewFromMessage, startTransition]);

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

    const filteredGhostConversations = ghostConversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showGlobalResults = searchQuery.length >= 2 && searchResults.length > 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Elegant Pill Tab Switcher */}
            <Box sx={{ 
                bgcolor: '#161412',
                borderRadius: '16px', 
                p: 0.5,
                width: 'fit-content',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                mb: 4
            }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(_, v) => setActiveTab(v)}
                    aria-label="chat type tabs"
                    sx={{
                        minHeight: 40,
                        '& .MuiTabs-indicator': {
                            display: 'none',
                        },
                        '& .MuiTab-root': {
                            minHeight: 40,
                            borderRadius: '12px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.5)',
                            px: 3,
                            transition: 'all 0.2s ease',
                            '&.Mui-selected': {
                                color: 'white',
                                bgcolor: 'rgba(255, 255, 255, 0.08)',
                            },
                            '&:hover': {
                                color: 'white',
                                bgcolor: 'rgba(255, 255, 255, 0.04)',
                            }
                        }
                    }}
                >
                    <Tab value="secure" label="Secure Chat (E2EE)" />
                    <Tab value="public" label="Threads" />
                </Tabs>
            </Box>

            <Box sx={{ flex: 1 }}>
                {showGlobalResults && (
                    <Box sx={{ mb: 4 }}>
                        <Typography sx={{ px: 1, mb: 2, display: 'block', fontWeight: 900, color: '#9B9691', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                            Global Directory
                        </Typography>
                        <List sx={{ pt: 0 }}>
                            {searchResults.map((u) => {
                                const targetId = u.userId || u.$id;
                                const hasChat = activeTab === 'secure' 
                                    ? conversations.some(c => c.type === 'direct' && c.participants?.includes(targetId))
                                    : ghostConversations.some(c => {
                                        let metaObj: any = {};
                                        try { metaObj = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {}); } catch {}
                                        const participants = c.collaborators || metaObj.participants || [];
                                        return participants.includes(targetId);
                                    });
                                return (
                                    <ListItem key={u.$id} disablePadding sx={{ mb: 1 }}>
                                        <ListItemButton
                                            onClick={() => startChat(u)}
                                            sx={{
                                                borderRadius: '16px',
                                                py: 1.5,
                                                bgcolor: '#161412',
                                                border: '1px solid #1C1A18',
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

                {activeTab === 'secure' ? (
                    !isUnlocked ? (
                        <Box sx={{ minHeight: '50vh', display: 'grid', placeItems: 'center', px: 3, py: 4 }}>
                            <Stack spacing={3} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center' }}>
                                <Box sx={{ p: 2, borderRadius: '24px', bgcolor: '#161412', color: '#F59E0B', border: '1px solid #1C1A18', mb: 1 }}>
                                    <ShieldCheckIcon sx={{ fontSize: 48 }} />
                                </Box>
                                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>Vault Secured</Typography>
                                <Typography sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6, fontSize: '0.9rem' }}>
                                    Unlock your decentralized node to initialize secure communication channels and identity resolution.
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    onClick={() => requestSudo({ onSuccess: () => setIsUnlocked(true) })}
                                    sx={{ 
                                        borderRadius: '16px', 
                                        px: 4, 
                                        py: 1.8, 
                                        fontWeight: 900,
                                        bgcolor: '#F59E0B',
                                        color: '#000',
                                        textTransform: 'none',
                                        fontSize: '0.95rem',
                                        boxShadow: '0 12px 24px rgba(245, 158, 11, 0.15)',
                                        '&:hover': { bgcolor: '#eab308', transform: 'translateY(-2px)' },
                                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                >
                                    Unlock Node
                                </Button>
                            </Stack>
                        </Box>
                    ) : filteredConversations.length === 0 && !showGlobalResults ? (
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
                                        onClick={handleItemClick}
                                        onContextMenu={(e) => handleConversationRightClick(e, conv)}
                                    sx={{
                                            borderRadius: '24px',
                                            py: 2.5,
                                            mb: 1.5,
                                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                            bgcolor: '#161412',
                                            border: '1px solid #1C1A18',
                                            boxShadow: `0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px ${alpha('#252321', 0.9)}`,
                                            ...(activePreviewConversationId === conv.$id ? {
                                                borderColor: '#F59E0B',
                                                transform: 'translateY(-2px)',
                                                boxShadow: `0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px ${alpha('#252321', 1.0)}`,
                                            } : {}),
                                            '&:hover': {
                                                bgcolor: '#1C1A18',
                                                borderColor: alpha('#F59E0B', 0.2),
                                                transform: 'translateY(-2px)',
                                                boxShadow: `0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px ${alpha('#252321', 1.0)}`,
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
                                                    if (isInitializing) {
                                                        showIslandNotification({
                                                            type: 'warning',
                                                            title: 'Initializing Encryption',
                                                            message: 'Securing connection channels...',
                                                            app: 'connect',
                                                            majestic: false,
                                                            duration: 4000
                                                        });
                                                        return;
                                                    }
                                                    setSelectedConversation(conv);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    if (isInitializing) {
                                                        showIslandNotification({
                                                            type: 'warning',
                                                            title: 'Initializing Encryption',
                                                            message: 'Securing connection channels...',
                                                            app: 'connect',
                                                            majestic: false,
                                                            duration: 4000
                                                        });
                                                        return;
                                                    }
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
                                                    status={conv.type === 'direct' && conv.otherUserId ? globalPresence?.[conv.otherUserId]?.state : undefined}
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
                    )
                ) : (
                    loadingGhost && filteredGhostConversations.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                            <Stack spacing={1.5}>
                                {[1, 2, 3].map((i) => (
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
                    ) : filteredGhostConversations.length === 0 && !showGlobalResults ? (
                        <Box sx={{ p: 6, textAlign: 'center' }}>
                            <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem', mb: 1, fontFamily: 'var(--font-clash)' }}>Quiet Airwaves</Typography>
                            <Typography variant="body2" sx={{ color: '#9B9691', fontWeight: 500 }}>No huddle threads active matching your query.</Typography>
                        </Box>
                    ) : (
                        <List sx={{ pt: 0 }}>
                            {filteredGhostConversations.map((conv) => (
                                <ListItem key={conv.$id} disablePadding sx={{ mb: 1 }}>
                                    <ListItemButton
                                        component={Link}
                                        href={`/connect/chat/${conv.$id}`}
                                        onClick={handleItemClick}
                                        onContextMenu={(e) => handleGhostConversationRightClick(e, conv)}
                                        sx={{
                                            borderRadius: '24px',
                                            py: 2.5,
                                            mb: 1.5,
                                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                            bgcolor: '#161412',
                                            border: '1px solid #1C1A18',
                                            boxShadow: `0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px ${alpha('#252321', 0.9)}`,
                                            '&:hover': {
                                                bgcolor: '#1C1A18',
                                                borderColor: alpha('#F59E0B', 0.2),
                                                transform: 'translateY(-2px)',
                                                boxShadow: `0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px ${alpha('#252321', 1.0)}`,
                                            }
                                        }}
                                    >
                                        <Box sx={{ mr: 2, display: 'inline-flex' }}>
                                            {conv.linkedResourceType ? (
                                                <Box sx={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: '16px',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    bgcolor: alpha(
                                                        conv.linkedResourceType === 'project' ? '#6366F1' :
                                                        conv.linkedResourceType === 'task' ? '#10B981' :
                                                        conv.linkedResourceType === 'event' ? '#EC4899' :
                                                        conv.linkedResourceType === 'form' ? '#8B5CF6' :
                                                        conv.linkedResourceType === 'tag' ? '#EF4444' : '#F59E0B',
                                                        0.1
                                                    ),
                                                    color: 
                                                        conv.linkedResourceType === 'project' ? '#818CF8' :
                                                        conv.linkedResourceType === 'task' ? '#34D399' :
                                                        conv.linkedResourceType === 'event' ? '#F472B6' :
                                                        conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                        conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                    border: '1px solid',
                                                    borderColor: alpha(
                                                        conv.linkedResourceType === 'project' ? '#818CF8' :
                                                        conv.linkedResourceType === 'task' ? '#34D399' :
                                                        conv.linkedResourceType === 'event' ? '#F472B6' :
                                                        conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                        conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                        0.15
                                                    )
                                                }}>
                                                    {conv.linkedResourceType === 'project' && <ProjectIcon sx={{ fontSize: 24 }} />}
                                                    {conv.linkedResourceType === 'task' && <TaskIcon sx={{ fontSize: 24 }} />}
                                                    {conv.linkedResourceType === 'event' && <EventIcon sx={{ fontSize: 24 }} />}
                                                    {conv.linkedResourceType === 'form' && <FormIcon sx={{ fontSize: 24 }} />}
                                                    {conv.linkedResourceType === 'tag' && <TagIcon sx={{ fontSize: 24 }} />}
                                                    {!['project', 'task', 'event', 'form', 'tag'].includes(conv.linkedResourceType) && <NoteIcon sx={{ fontSize: 24 }} />}
                                                </Box>
                                            ) : (
                                                <IdentityAvatar
                                                    src={conv.avatarUrl}
                                                    alt={conv.name}
                                                    fallback={conv.name?.replace(/^@/, '').charAt(0).toUpperCase() || 'H'}
                                                    size={48}
                                                    status={conv.otherUserId ? globalPresence?.[conv.otherUserId]?.state : undefined}
                                                />
                                            )}
                                        </Box>
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Typography sx={{
                                                        fontWeight: 800,
                                                        fontSize: '1rem',
                                                        color: '#fff',
                                                        fontFamily: 'var(--font-clash)',
                                                        letterSpacing: '-0.01em'
                                                    }}>
                                                        {conv.name}
                                                    </Typography>
                                                    {conv.linkedResourceType && (
                                                        <Box sx={{
                                                            px: 1,
                                                            py: 0.25,
                                                            borderRadius: '6px',
                                                            bgcolor: alpha(
                                                                conv.linkedResourceType === 'project' ? '#6366F1' :
                                                                conv.linkedResourceType === 'task' ? '#10B981' :
                                                                conv.linkedResourceType === 'event' ? '#EC4899' :
                                                                conv.linkedResourceType === 'form' ? '#8B5CF6' :
                                                                conv.linkedResourceType === 'tag' ? '#EF4444' : '#F59E0B',
                                                                0.1
                                                            ),
                                                            border: '1px solid',
                                                            borderColor: alpha(
                                                                conv.linkedResourceType === 'project' ? '#818CF8' :
                                                                conv.linkedResourceType === 'task' ? '#34D399' :
                                                                conv.linkedResourceType === 'event' ? '#F472B6' :
                                                                conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                                conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                                0.2
                                                            )
                                                        }}>
                                                            <Typography sx={{
                                                                fontSize: '9px',
                                                                fontWeight: 900,
                                                                fontFamily: 'var(--font-mono)',
                                                                color: 
                                                                    conv.linkedResourceType === 'project' ? '#818CF8' :
                                                                    conv.linkedResourceType === 'task' ? '#34D399' :
                                                                    conv.linkedResourceType === 'event' ? '#F472B6' :
                                                                    conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                                    conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em'
                                                            }}>
                                                                {conv.linkedResourceType}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Stack>
                                            }
                                            secondary={conv.lastMessageText}
                                            primaryTypographyProps={{ component: 'div' }}
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
                                        </Box>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )
                )}
            </Box>

            <ConversationActionsSheet
                conversation={selectedConversation}
                open={Boolean(selectedConversation)}
                onClose={() => setSelectedConversation(null)}
                onConversationUpdated={handleConversationUpdated}
                onConversationDeleted={handleConversationDeleted}
            />

            {showCountdownDrawer && (
                <SetupCountdownDrawer 
                    onCancel={handleCancelRedirect}
                    callbackUrl="/connect/chats"
                />
            )}

        </Box>
    );
};

const SetupCountdownDrawer = ({ 
    onCancel, 
    callbackUrl 
}: { 
    onCancel: () => void; 
    callbackUrl: string; 
}) => {
    const router = useRouter();
    const [secondsLeft, setSecondsLeft] = useState(5);
    const [isCancelled, setIsCancelled] = useState(false);

    useEffect(() => {
        if (isCancelled || secondsLeft <= 0) {
            if (secondsLeft === 0 && !isCancelled) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('kylrix_connect_active_tab', 'secure');
                }
                router.replace(`/vault/masterpass?callbackUrl=${encodeURIComponent(callbackUrl)}`);
            }
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsLeft, isCancelled, router, callbackUrl]);

    return (
        <Drawer
            anchor="bottom"
            open={true}
            onClose={() => {
                setIsCancelled(true);
                onCancel();
            }}
            PaperProps={{
                sx: {
                    bgcolor: '#161412',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px 24px 0 0',
                    maxWidth: 600,
                    mx: 'auto',
                    width: '100%',
                }
            }}
            ModalProps={{
                keepMounted: false,
                disablePortal: true
            }}
        >
            <Box sx={{ p: 4, textAlign: 'center', color: '#fff' }}>
                <Stack spacing={3} alignItems="center">
                    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                        <ShieldCheckIcon sx={{ fontSize: 36 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                        Secure Chat Requires Setup
                    </Typography>
                    <Typography sx={{ color: '#9B9691', fontSize: '0.9rem', maxWidth: 400, lineHeight: 1.5 }}>
                        End-to-End Encryption requires setting up an Ecosystem MasterPass to secure your local cryptographic keys.
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                        Navigating to setup in {secondsLeft}...
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setIsCancelled(true);
                            onCancel();
                        }}
                        sx={{
                            borderRadius: '12px',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            textTransform: 'none',
                            px: 4,
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        }}
                    >
                        Cancel Redirect
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
};
