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
import { useSection } from '@/context/SectionContext';
import { showIslandNotification } from '@/lib/island-notification';
import { createGhostNoteChat, listGhostNoteChats, deleteGhostThread } from '@/lib/actions/client-ops';
import { isValidX25519PublicKey, formatSecureChatStartError } from '@/lib/crypto/public-key';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { 
    Trash2, 
    ShieldCheck, 
    Users, 
    User, 
    Bookmark, 
    Search, 
    Lock, 
    ArrowLeft, 
    Folder, 
    CheckSquare, 
    Calendar, 
    ClipboardList, 
    Tag, 
    StickyNote, 
    ExternalLink, 
    Link as LinkIcon, 
    Sliders 
} from 'lucide-react';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar } from '../IdentityBadge';
import { seedIdentityCache, getCachedIdentityById, resolveIdentityById  } from '@/lib/identity-cache';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { getConversationReadAt } from '@/lib/chat-read-state';
import { useChatNotifications } from '../providers/ChatNotificationProvider';
import ConversationActionsSheet from './ConversationActionsSheet';
import { useContextMenu } from '@/components/ui/ContextMenuContext';

const alpha = (hexColor: string, opacity: number) => {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

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

const SECURE_CACHE_KEY = 'kylrix_connect_cached_secure_v1';
const THREADS_CACHE_KEY = 'kylrix_connect_cached_threads_v1';

function readJsonCache<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : null;
    } catch {
        return null;
    }
}

function readSecureCache(): any[] {
    return readJsonCache<any[]>(SECURE_CACHE_KEY) || [];
}

function readThreadsCache(): any[] {
    return readJsonCache<any[]>(THREADS_CACHE_KEY) || [];
}

export const ChatList = ({ 
    externalQuery = '',
    activeTab: propActiveTab,
    onTabChange,
    hideTabs = false,
    skipSecureLoad = false,
    skipThreadsLoad = false,
}: { 
    externalQuery?: string;
    activeTab?: 'secure' | 'public';
    onTabChange?: (tab: 'secure' | 'public') => void;
    hideTabs?: boolean;
    /** Desktop threads panel — skip encrypted conversation fetch + subscriptions. */
    skipSecureLoad?: boolean;
    /** Desktop secure panel — skip ghost thread fetch. */
    skipThreadsLoad?: boolean;
}) => {
    const { user } = useAuth();
    const { unreadConversations } = useChatNotifications();
    const { globalPresence } = usePresence();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const { openMenu } = useContextMenu();
    const { open: openUnified } = useUnifiedDrawer();
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        setIsDesktop(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);
    const { setActiveDetail } = useSection();
    const initialSecureCache = readSecureCache();
    const initialThreadsCache = readThreadsCache();
    const [conversations, setConversations] = useState<any[]>(() => initialSecureCache);
    const [loading, setLoading] = useState(() => !skipSecureLoad && initialSecureCache.length === 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const isUnlockedRef = React.useRef(isUnlocked);
    isUnlockedRef.current = isUnlocked;
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const conversationsRef = React.useRef<any[]>(initialSecureCache);
    const loadRequestRef = React.useRef(0);
    const loadConversationsInflightRef = React.useRef<Promise<void> | null>(null);
    const reloadConversationsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledMessageIdsRef = React.useRef<Set<string>>(new Set());
    const [livePreviewByConversation, setLivePreviewByConversation] = useState<Record<string, {
        lastMessageId: string;
        lastMessageText: string;
        lastMessageAt: string;
    }>>({});
    const [activePreviewConversationId, setActivePreviewConversationId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [activeTabState, setActiveTabState] = useState<'secure' | 'public'>(() => {
        return propActiveTab || (ecosystemSecurity.status.isUnlocked ? 'secure' : 'public');
    });
    const activeTab = propActiveTab || activeTabState;

    const [ghostConversations, setGhostConversations] = useState<any[]>(() => initialThreadsCache);
    const [loadingGhost, setLoadingGhost] = useState(() => !skipThreadsLoad && initialThreadsCache.length === 0);

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
                    icon: <ExternalLink size={18} />,
                    onClick: () => router.push(`/connect/chat/${conv.$id}`)
                },
                {
                    label: 'Copy Connection Link',
                    icon: <LinkIcon size={18} />,
                    onClick: () => {
                        const link = `${window.location.origin}/connect/chat/${conv.$id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Connection link copied');
                    }
                },
                {
                    label: 'Manage Discussion',
                    icon: <Sliders size={18} />,
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
                    icon: <ExternalLink size={18} />,
                    onClick: () => router.push(`/connect/chat/${conv.$id}`)
                },
                {
                    label: 'Copy Thread ID',
                    icon: <LinkIcon size={18} />,
                    onClick: () => {
                        navigator.clipboard.writeText(conv.$id);
                        toast.success('Thread ID copied');
                    }
                },
                {
                    label: 'Copy Discussion Link',
                    icon: <LinkIcon size={18} />,
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

    // Restore tab intent from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (propActiveTab) return;
        try {
            const storedTab = localStorage.getItem('kylrix_connect_active_tab');
            if (storedTab === 'secure' || storedTab === 'public') {
                localStorage.removeItem('kylrix_connect_active_tab');
                setActiveTabState(storedTab);
                if (onTabChange) onTabChange(storedTab);
            }
        } catch (e) {
            console.warn('[ChatList] Failed to restore active tab:', e);
        }
    }, [onTabChange, propActiveTab]);

    // Query MasterPass status when user is loaded
    useEffect(() => {
        if (user?.$id) {
            import('@/lib/appwrite/keychain')
                .then(({ KeychainService }) => KeychainService.hasMasterpass(user.$id))
                .then(setHasMasterpass)
                .catch(() => setHasMasterpass(false));
        }
    }, [user?.$id]);

    // Secure tab setup redirection countdown trigger (mobile tabbed view only)
    useEffect(() => {
        if (!hideTabs && activeTab === 'secure' && hasMasterpass === false) {
            setShowCountdownDrawer(true);
        } else {
            setShowCountdownDrawer(false);
        }
    }, [activeTab, hasMasterpass, hideTabs]);

    // Active secure query 800ms grace timeout to show cache
    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => {
            if (loading) {
                try {
                    const cachedSec = localStorage.getItem(SECURE_CACHE_KEY);
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
                    const cachedThr = localStorage.getItem(THREADS_CACHE_KEY);
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
        if (hideTabs || propActiveTab) return;
        if (isUnlocked) {
            setActiveTab('secure');
        } else {
            setActiveTab('public');
        }
    }, [isUnlocked, setActiveTab, hideTabs, propActiveTab]);

    useEffect(() => {
        rememberConversationRoster(conversations);
    }, [conversations]);

    useEffect(() => () => {
        rememberConversationRoster([]);
    }, []);

    const loadGhostConversations = React.useCallback(async (options?: { silent?: boolean }) => {
        if (!user) return;
        const hasCachedRows = ghostConversations.length > 0;
        if (!options?.silent && !hasCachedRows) {
            setLoadingGhost(true);
        }
        try {
            const results = await listGhostNoteChats();

            const mapped = results.map((note: any) => {
                let metadataObj: any = {};
                try {
                    metadataObj = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : (note.metadata || {});
                } catch {
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
                let avatarUrl: string | null = null;

                if (cleanLinkedResourceType) {
                    otherName = note.title || linkedResourceName || `${cleanLinkedResourceType.charAt(0).toUpperCase() + cleanLinkedResourceType.slice(1)} Huddle`;
                } else if (otherId) {
                    const cachedOther = getCachedIdentityById(otherId);
                    if (cachedOther) {
                        otherName = cachedOther.displayName || cachedOther.username || `@${otherId.slice(0, 7)}`;
                        avatarUrl = cachedOther.avatar?.startsWith?.('http') ? cachedOther.avatar : null;
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
            });

            mapped.sort((a: any, b: any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

            if (typeof window !== 'undefined') {
                localStorage.setItem(THREADS_CACHE_KEY, JSON.stringify(mapped));
            }
            startTransition(() => {
                setGhostConversations(mapped);
            });
            setIsInitializing(false);

            void (async () => {
                const enriched = await Promise.all(mapped.map(async (entry: any) => {
                    const otherId = entry.otherUserId;
                    if (!otherId || entry.linkedResourceType) return entry;

                    const identity = await resolveIdentityById(otherId, () => UsersService.getProfileById(otherId));
                    if (!identity) return entry;

                    let avatarUrl = entry.avatarUrl;
                    if (!avatarUrl && identity.avatar?.startsWith?.('http')) {
                        avatarUrl = identity.avatar;
                    } else if (!avatarUrl && identity.avatar) {
                        try {
                            avatarUrl = await fetchProfilePreview(identity.avatar, 64, 64) as unknown as string;
                        } catch {
                            avatarUrl = null;
                        }
                    }

                    seedIdentityCache({ ...identity, avatar: identity.avatar || avatarUrl });
                    return {
                        ...entry,
                        name: identity.displayName || identity.username || entry.name,
                        avatarUrl,
                    };
                }));

                enriched.sort((a: any, b: any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
                if (typeof window !== 'undefined') {
                    localStorage.setItem(THREADS_CACHE_KEY, JSON.stringify(enriched));
                }
                startTransition(() => {
                    setGhostConversations(enriched);
                });
            })();
        } catch (error) {
            console.error('Failed to load ghost huddles:', error);
        } finally {
            setLoadingGhost(false);
        }
    }, [user, startTransition, ghostConversations.length]);

    useEffect(() => {
        if (skipThreadsLoad || activeTab !== 'public') return;
        loadGhostConversations();
    }, [activeTab, loadGhostConversations, skipThreadsLoad]);

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

        let recipientPublicKey =
            typeof targetUser.publicKey === 'string' ? targetUser.publicKey : null;

        if (activeTab === 'secure') {
            try {
                const profile = await UsersService.getProfileById(targetUserId);
                recipientPublicKey = profile?.publicKey || recipientPublicKey;
            } catch (error) {
                console.warn('[ChatList] Failed to refresh recipient profile:', error);
            }
        }

        const recipientReadyForSecureChat = isValidX25519PublicKey(recipientPublicKey);

        // If vault is locked, recipient isn't secure-ready, or we're on Threads, use a thread.
        if (!isUnlocked || !recipientReadyForSecureChat || activeTab === 'public') {
            try {
                if (activeTab === 'secure' && isUnlocked && !recipientReadyForSecureChat) {
                    toast(
                        recipientPublicKey
                            ? "This person hasn't finished secure chat setup yet. Starting a thread instead."
                            : "This person hasn't set up secure chat yet. Starting a thread instead.",
                        { id: 'ghost-init' }
                    );
                } else {
                    toast.loading('Initializing thread...', { id: 'ghost-init' });
                }
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
                    if (isDesktop) {
                        setActiveDetail({ type: 'chat', id: foundGhost.$id, data: foundGhost });
                    } else {
                        router.push(`/connect/chat/${foundGhost.$id}`);
                    }
                    return;
                }

                const title = targetUser.displayName || targetUser.username || 'Huddle';
                const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
                toast.success('Huddle thread ready!', { id: 'ghost-init' });
                if (isDesktop) {
                    setActiveDetail({ type: 'chat', id: newGhost.$id, data: newGhost });
                } else {
                    router.push(`/connect/chat/${newGhost.$id}`);
                }
            } catch (error: any) {
                console.error('Failed to create thread:', error);
                toast.error(formatSecureChatStartError(error, activeTab === 'public' ? 'thread' : 'secure'), { id: 'ghost-init' });
            }
            return;
        }

        // Check for existing conversation locally
        const found = conversations.find((c: any) =>
            c.type === 'direct' && c.participants?.includes(targetUserId)
        );

        if (found) {
            if (isDesktop) {
                setActiveDetail({ type: 'chat', id: found.$id, data: found });
            } else {
                router.push(`/connect/chat/${found.$id}`);
            }
            return;
        }

        // If not found, ensure Sudo is unlocked before creating
        requestSudo({
            onSuccess: async () => {
                try {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    const participants = [user.$id, targetUserId];
                    const newConv = await ChatService.createConversation(participants, 'direct');
                    if (isDesktop) {
                        setActiveDetail({ type: 'chat', id: newConv.$id, data: newConv });
                    } else {
                        router.push(`/connect/chat/${newConv.$id}`);
                    }
                } catch (error: any) {
                    console.error('Failed to create chat:', error);
                    toast.error(formatSecureChatStartError(error, 'secure'));
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

    const loadConversations = React.useCallback(async (options?: { forceRefresh?: boolean; silent?: boolean }) => {
        if (skipSecureLoad) return;

        const existingRun = loadConversationsInflightRef.current;
        if (existingRun) {
            await existingRun;
            return;
        }

        const run = (async () => {
        const requestId = ++loadRequestRef.current;
        try {
            if (!ecosystemSecurity.status.isUnlocked) {
                setLoading(false);
                return;
            }

            const hasCachedRows = conversationsRef.current.length > 0;
            if (!options?.silent && !hasCachedRows) {
                setLoading(true);
            }

            const response = await ChatService.getConversations(user!.$id, {
                forceRefresh: options?.forceRefresh,
            });
            let rows = [...response.rows];

            const hasEncrypted = rows.some(c => c.isEncrypted);
            if (hasEncrypted && !ecosystemSecurity.status.isUnlocked) return;

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
                localStorage.setItem(SECURE_CACHE_KEY, JSON.stringify(sorted));
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
                    localStorage.setItem(SECURE_CACHE_KEY, JSON.stringify(next));
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
    }, [user, startTransition, skipSecureLoad]);

    const scheduleConversationsReload = React.useCallback((options?: { forceRefresh?: boolean }) => {
        if (skipSecureLoad) return;
        if (reloadConversationsTimerRef.current) {
            clearTimeout(reloadConversationsTimerRef.current);
        }
        reloadConversationsTimerRef.current = setTimeout(() => {
            void loadConversations({ silent: true, forceRefresh: options?.forceRefresh });
        }, 450);
    }, [loadConversations, skipSecureLoad]);

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            const wasUnlocked = isUnlockedRef.current;
            setIsUnlocked(status.isUnlocked);
            if (status.isUnlocked && !wasUnlocked) {
                void loadConversations({ forceRefresh: true });
            } else if (!status.isUnlocked) {
                ChatService.clearConversationPreviewCache();
                ChatService.invalidateConversationsListCache(user?.$id);
                startTransition(() => setConversations([]));
                conversationsRef.current = [];
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [loadConversations, user?.$id, startTransition]);

    useEffect(() => {
        if (!user) return;

        if (!skipSecureLoad) {
            void loadConversations({ silent: conversationsRef.current.length > 0 });
        }
        if (!skipThreadsLoad && activeTab === 'public') {
            void loadGhostConversations({ silent: ghostConversations.length > 0 });
        }

        const conversationChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.documents`;
        const messageChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`;
        const noteChannel = `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.documents`;

        const channels = skipSecureLoad
            ? [noteChannel]
            : skipThreadsLoad
                ? [conversationChannel, messageChannel]
                : [conversationChannel, messageChannel, noteChannel];

        const subscription: any = realtime.subscribe(channels, async (response) => {
            if (response.channels.some(ch => ch.includes(APPWRITE_CONFIG.TABLES.NOTE.NOTES))) {
                if (!skipThreadsLoad) {
                    void loadGhostConversations({ silent: true });
                }
                return;
            }
            if (skipSecureLoad) return;
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
                scheduleConversationsReload();
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
                scheduleConversationsReload({ forceRefresh: true });
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
            if (reloadConversationsTimerRef.current) {
                clearTimeout(reloadConversationsTimerRef.current);
            }
            if (typeof subscription === 'function') subscription();
            else if (subscription?.unsubscribe) subscription.unsubscribe();
        };
    }, [user, activeTab, loadConversations, loadGhostConversations, formatPreviewFromMessage, startTransition, skipSecureLoad, skipThreadsLoad, scheduleConversationsReload, ghostConversations.length]);

    if (loading && activeTab === 'secure' && !skipSecureLoad) return (
        <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-2 animate-pulse">
                    <div className="w-11 h-11 bg-white/5 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-1/3" />
                        <div className="h-3 bg-white/5 rounded w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );

    const filteredConversations = conversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGhostConversations = ghostConversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showGlobalResults = searchQuery.length >= 2 && searchResults.length > 0;

    return (
        <div className="flex flex-col relative w-full">
            {/* Elegant Pill Tab Switcher */}
            {!hideTabs && (
                <div className="bg-[#161412] rounded-2xl p-1 w-fit border border-white/5 mb-8 flex gap-1">
                    <button
                        onClick={() => setActiveTab('secure')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                            activeTab === 'secure'
                                ? 'bg-white/8 text-white'
                                : 'text-white/50 hover:text-white hover:bg-white/4'
                        }`}
                    >
                        Secure Chat
                    </button>
                    <button
                        onClick={() => setActiveTab('public')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                            activeTab === 'public'
                                ? 'bg-white/8 text-white'
                                : 'text-white/50 hover:text-white hover:bg-white/4'
                        }`}
                    >
                        Threads
                    </button>
                </div>
            )}

            <div className="flex-1">
                {showGlobalResults && (
                    <div className="mb-8">
                        <span className="px-2 mb-4 block font-black text-[#9B9691] uppercase tracking-widest text-[10px] font-mono">
                            Global Directory
                        </span>
                        <div className="space-y-2">
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
                                    <div key={u.$id} className="w-full">
                                        <button
                                            onClick={() => startChat(u)}
                                            className="w-full flex items-center gap-4 p-3 rounded-2xl bg-[#161412] border border-[#1C1A18] hover:bg-[#1F1D1B] hover:border-[#F59E0B] transition-all text-left"
                                        >
                                            <div className="flex-shrink-0">
                                                <GlobalSearchAvatar u={u} />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                <span className="font-bold text-base text-white truncate">
                                                    {u.displayName || u.username}
                                                </span>
                                                <span className="text-xs text-[#9B9691] truncate">
                                                    {`@${String(u.username).replace(/^@/, '')}`}
                                                </span>
                                            </div>
                                            {!hasChat && (
                                                <div className="px-3 py-1 rounded bg-[#F59E0B] text-black">
                                                    <span className="text-[10px] font-black tracking-wider">NEW</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="my-6 border-t border-[#34322F]" />
                    </div>
                )}

                {activeTab === 'secure' ? (
                    !isUnlocked ? (
                        <div className="min-h-[50vh] grid place-items-center px-6 py-8">
                            <div className="flex flex-col items-center gap-6 max-w-sm text-center">
                                <div className="p-4 rounded-3xl bg-[#161412] text-[#F59E0B] border border-[#1C1A18] mb-1">
                                    <ShieldCheck size={48} />
                                </div>
                                <h5 className="text-xl font-black font-clash text-white">Vault Secured</h5>
                                <p className="text-[#9B9691] font-medium leading-relaxed text-sm">
                                    Unlock your decentralized node to initialize secure communication channels and identity resolution.
                                </p>
                                <button 
                                    onClick={() => requestSudo({
                                        onSuccess: () => {
                                            setIsUnlocked(true);
                                            void loadConversations({ forceRefresh: true });
                                        },
                                    })}
                                    className="px-8 py-3.5 rounded-2xl font-black bg-[#F59E0B] text-black text-sm shadow-[0_12px_24px_rgba(245,158,11,0.15)] hover:bg-[#eab308] hover:-translate-y-0.5 transition-all duration-300 ease-out"
                                >
                                    Unlock Node
                                </button>
                            </div>
                        </div>
                    ) : filteredConversations.length === 0 && !showGlobalResults && !loading ? (
                        <div className="p-12 text-center">
                            <span className="font-black text-white text-lg mb-1 font-clash block">Quiet Frequency</span>
                            <span className="text-sm text-[#9B9691] font-medium block">No encrypted channels found matching your query.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredConversations.map((conv) => (
                                <div key={conv.$id} className="w-full">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e: React.MouseEvent) => {
                                            if (isDesktop) {
                                                e.preventDefault();
                                                setActiveDetail({ type: 'chat', id: conv.$id, data: conv });
                                                return;
                                            }
                                            handleItemClick(e);
                                            if (!isInitializing) {
                                                router.push(`/connect/chat/${conv.$id}`);
                                            }
                                        }}
                                        onContextMenu={(e) => handleConversationRightClick(e, conv)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                if (isDesktop) {
                                                    setActiveDetail({ type: 'chat', id: conv.$id, data: conv });
                                                } else if (!isInitializing) {
                                                    router.push(`/connect/chat/${conv.$id}`);
                                                }
                                            }
                                        }}
                                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-3xl bg-[#161412] border border-[#1C1A18] hover:bg-[#1C1A18] hover:border-[#F59E0B]/20 hover:-translate-y-0.5 transition-all duration-300 ease-out text-left cursor-pointer ${
                                            activePreviewConversationId === conv.$id ? 'border-[#F59E0B] -translate-y-0.5 shadow-[0_8px_10px_-8px_rgba(0,0,0,1)]' : 'shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9)]'
                                        }`}
                                    >
                                        <div
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
                                            className="flex-shrink-0 mr-1"
                                        >
                                            <IdentityAvatar
                                                src={conv.avatarUrl || conv.avatar || null}
                                                alt={conv.name}
                                                fallback={conv.name?.replace(/^@/, '').charAt(0).toUpperCase() || 'U'}
                                                size={48}
                                                pro={conv.isSelf}
                                                status={conv.type === 'direct' && conv.otherUserId ? globalPresence?.[conv.otherUserId]?.state : undefined}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <span className={`font-black text-base font-clash tracking-tight truncate ${conv.isSelf ? 'text-[#F59E0B]' : 'text-white'}`}>
                                                {conv.name || (conv.type === 'direct' ? conv.otherUserId : 'Group Chat')}
                                            </span>
                                            <span className="text-[#9B9691] font-medium text-sm truncate flex items-center gap-1.5">
                                                {(() => {
                                                    const memoryPreview = ChatService.getConversationPreviewSnapshot(conv.$id);
                                                    const memoryAt = memoryPreview?.lastMessageAt ? new Date(memoryPreview.lastMessageAt).getTime() : -1;
                                                    const rowAt = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : -1;
                                                    const memoryText = memoryPreview && (memoryAt >= rowAt || !conv.lastMessageText)
                                                        ? memoryPreview.lastMessageText
                                                        : null;
                                                    const resolvedPreview = livePreviewByConversation[conv.$id]?.lastMessageText || memoryText || conv.lastMessageText || 'No messages yet';

                                                    return (conv.isEncrypted && !isUnlocked && isLikelyEncrypted(resolvedPreview)) ? (
                                                        <span className="flex items-center gap-1">
                                                            <Lock size={12} className="text-[#9B9691]" />
                                                            <span>Secured Payload</span>
                                                        </span>
                                                    ) : (
                                                        <span>{resolvedPreview}</span>
                                                    );
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2">
                                            {conv.lastMessageAt && (
                                                <span className="text-[11px] text-[#9B9691] font-black font-mono">
                                                    {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                            {conv.lastMessageAt && conv.lastMessageId && !conv.isSelf && (() => {
                                                const readAt = getConversationReadAt(user?.$id, conv.$id);
                                                const isUnread = unreadConversations.has(conv.$id) || (
                                                    conv.lastMessageSenderId !== user?.$id &&
                                                    new Date(conv.lastMessageAt).getTime() > readAt
                                                );
                                                return isUnread ? (
                                                    <span className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    loadingGhost && filteredGhostConversations.length === 0 ? (
                        <div className="p-4 space-y-3 animate-pulse">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-2">
                                    <div className="w-11 h-11 bg-white/5 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-white/10 rounded w-1/3" />
                                        <div className="h-3 bg-white/5 rounded w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredGhostConversations.length === 0 && !showGlobalResults ? (
                        <div className="p-12 text-center">
                            <span className="font-black text-white text-lg mb-1 font-clash block">Quiet Airwaves</span>
                            <span className="text-sm text-[#9B9691] font-medium block">No huddle threads active matching your query.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGhostConversations.map((conv) => (
                                <div key={conv.$id} className="w-full">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e: React.MouseEvent) => {
                                            if (isDesktop) {
                                                e.preventDefault();
                                                setActiveDetail({ type: 'chat', id: conv.$id, data: conv });
                                                return;
                                            }
                                            handleItemClick(e);
                                            if (!isInitializing) {
                                                router.push(`/connect/chat/${conv.$id}`);
                                            }
                                        }}
                                        onContextMenu={(e) => handleGhostConversationRightClick(e, conv)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                if (isDesktop) {
                                                    setActiveDetail({ type: 'chat', id: conv.$id, data: conv });
                                                } else if (!isInitializing) {
                                                    router.push(`/connect/chat/${conv.$id}`);
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-3xl bg-[#161412] border border-[#1C1A18] hover:bg-[#1C1A18] hover:border-[#F59E0B]/20 hover:-translate-y-0.5 transition-all duration-300 ease-out text-left cursor-pointer shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9)]"
                                    >
                                        <div className="flex-shrink-0">
                                            {conv.linkedResourceType ? (
                                                <div 
                                                    className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                                                    style={{
                                                        backgroundColor: alpha(
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
                                                        borderColor: alpha(
                                                            conv.linkedResourceType === 'project' ? '#818CF8' :
                                                            conv.linkedResourceType === 'task' ? '#34D399' :
                                                            conv.linkedResourceType === 'event' ? '#F472B6' :
                                                            conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                            conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                            0.15
                                                        )
                                                    }}
                                                >
                                                    {conv.linkedResourceType === 'project' && <Folder size={20} />}
                                                    {conv.linkedResourceType === 'task' && <CheckSquare size={20} />}
                                                    {conv.linkedResourceType === 'event' && <Calendar size={20} />}
                                                    {conv.linkedResourceType === 'form' && <ClipboardList size={20} />}
                                                    {conv.linkedResourceType === 'tag' && <Tag size={20} />}
                                                    {!['project', 'task', 'event', 'form', 'tag'].includes(conv.linkedResourceType) && <StickyNote size={20} />}
                                                </div>
                                            ) : (
                                                <IdentityAvatar
                                                    src={conv.avatarUrl}
                                                    alt={conv.name}
                                                    fallback={conv.name?.replace(/^@/, '').charAt(0).toUpperCase() || 'H'}
                                                    size={48}
                                                    status={conv.otherUserId ? globalPresence?.[conv.otherUserId]?.state : undefined}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-base font-clash tracking-tight text-white truncate">
                                                    {conv.name}
                                                </span>
                                                {conv.linkedResourceType && (
                                                    <div 
                                                        className="px-2 py-0.5 rounded border flex-shrink-0"
                                                        style={{
                                                            backgroundColor: alpha(
                                                                conv.linkedResourceType === 'project' ? '#6366F1' :
                                                                conv.linkedResourceType === 'task' ? '#10B981' :
                                                                conv.linkedResourceType === 'event' ? '#EC4899' :
                                                                conv.linkedResourceType === 'form' ? '#8B5CF6' :
                                                                conv.linkedResourceType === 'tag' ? '#EF4444' : '#F59E0B',
                                                                0.1
                                                            ),
                                                            borderColor: alpha(
                                                                conv.linkedResourceType === 'project' ? '#818CF8' :
                                                                conv.linkedResourceType === 'task' ? '#34D399' :
                                                                conv.linkedResourceType === 'event' ? '#F472B6' :
                                                                conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                                conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                                0.2
                                                            )
                                                        }}
                                                    >
                                                        <span 
                                                            className="text-[9px] font-black font-mono uppercase tracking-wider"
                                                            style={{
                                                                color: 
                                                                    conv.linkedResourceType === 'project' ? '#818CF8' :
                                                                    conv.linkedResourceType === 'task' ? '#34D399' :
                                                                    conv.linkedResourceType === 'event' ? '#F472B6' :
                                                                    conv.linkedResourceType === 'form' ? '#A78BFA' :
                                                                    conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24',
                                                            }}
                                                        >
                                                            {conv.linkedResourceType}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[#9B9691] font-medium text-sm truncate">
                                                {conv.lastMessageText}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2">
                                            {conv.lastMessageAt && (
                                                <span className="text-[11px] text-[#9B9691] font-black font-mono">
                                                    {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

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
        </div>
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
    const { requestSudo } = useSudo();
    const [secondsLeft, setSecondsLeft] = useState(5);
    const [isCancelled, setIsCancelled] = useState(false);

    useEffect(() => {
        if (isCancelled || secondsLeft <= 0) {
            if (secondsLeft === 0 && !isCancelled) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('kylrix_connect_active_tab', 'secure');
                }
                requestSudo({
                    intent: 'initialize',
                    onSuccess: () => {
                        router.replace(callbackUrl);
                    }
                });
            }
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsLeft, isCancelled, router, callbackUrl]);

    return (
        <div className="fixed inset-0 z-[1550] flex items-end justify-center pointer-events-none">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 transition-opacity duration-300 pointer-events-auto"
                style={{ top: '88px' }}
                onClick={() => {
                    setIsCancelled(true);
                    onCancel();
                }}
            />
            {/* Content panel */}
            <div className="relative w-full max-w-[600px] bg-[#161412] border-t border-white/8 rounded-t-3xl p-6 text-center text-white shadow-2xl transition-transform duration-300 transform translate-y-0 z-10 pointer-events-auto">
                {/* Drag handle line */}
                <div className="mx-auto w-12 h-1 bg-white/10 rounded-full mb-6 animate-pulse" />
                
                <div className="flex flex-col items-center gap-6">
                    <div className="p-4 rounded-full bg-[#F59E0B]/10 text-[#F59E0B]">
                        <ShieldCheck size={36} />
                    </div>
                    <h6 className="text-lg font-black font-clash">
                        Secure Chat Requires Setup
                    </h6>
                    <p className="text-[#9B9691] text-sm max-w-sm leading-relaxed">
                        End-to-End Encryption requires setting up an Ecosystem MasterPass to secure your local cryptographic keys.
                    </p>
                    <span className="text-xl font-black text-[#F59E0B] font-mono">
                        Navigating to setup in {secondsLeft}...
                    </span>
                    <button
                        onClick={() => {
                            setIsCancelled(true);
                            onCancel();
                        }}
                        className="px-8 py-3 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 hover:border-white/20 transition-all duration-200"
                    >
                        Cancel Redirect
                    </button>
                </div>
            </div>
        </div>
    );
};
