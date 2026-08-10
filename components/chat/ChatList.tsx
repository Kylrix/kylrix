'use client';

import React, { useEffect, useState, useCallback, useTransition, useRef, useMemo } from 'react';
import { ChatService, rememberConversationRoster } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { tablesDB, realtime  } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { usePresence } from '../providers/PresenceProvider';
import { showIslandNotification } from '@/lib/island-notification';
import { createGhostNoteChat, listGhostNoteChats, deleteGhostThread } from '@/lib/actions/client-ops';
import { formatSecureChatStartError } from '@/lib/crypto/public-key';
import {
    discoverRecipientSecureReady,
    resolveChatChannelKind,
    canonicalDirectParticipants,
    directParticipantsEqual,
    extractGhostParticipantIds,
} from '@/lib/chat/recipient-secure-ready';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { openCommObjectDetail } from '@/components/objects/CommObjectDetail';
import { 
    ShieldCheck, 
    Lock, 
    Pin,
    RefreshCw,
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
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { useResourcePins } from '@/context/ResourcePinContext';
import { ChatSettingsPanel } from '@/components/chat/ChatSettingsPanel';
import {
    peekChatsListMemory,
    peekThreadsListMemory,
    readChatsListLocal,
    readThreadsListLocal,
    writeChatsListLocal,
    writeThreadsListLocal,
} from '@/lib/chat/local-chat-cache';
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

/** One-shot migrate legacy localStorage → LocalEngine, then drop localStorage. */
function migrateLegacyChatListCache() {
    if (typeof window === 'undefined') return;
    try {
        const secure = localStorage.getItem(SECURE_CACHE_KEY);
        if (secure) {
            const parsed = JSON.parse(secure);
            if (Array.isArray(parsed) && parsed.length) {
                writeChatsListLocal(parsed);
            }
            localStorage.removeItem(SECURE_CACHE_KEY);
        }
        const threads = localStorage.getItem(THREADS_CACHE_KEY);
        if (threads) {
            const parsed = JSON.parse(threads);
            if (Array.isArray(parsed) && parsed.length) {
                writeThreadsListLocal(parsed);
            }
            localStorage.removeItem(THREADS_CACHE_KEY);
        }
    } catch {
        /* ignore */
    }
}

export const ChatList = ({ 
    externalQuery = '',
    activeTab: propActiveTab,
    onTabChange,
    hideTabs = false,
    skipSecureLoad = false,
    skipThreadsLoad = false,
    onOpenConversation,
}: { 
    externalQuery?: string;
    activeTab?: 'secure' | 'public';
    onTabChange?: (tab: 'secure' | 'public') => void;
    hideTabs?: boolean;
    /** Desktop threads panel — skip encrypted conversation fetch + subscriptions. */
    skipSecureLoad?: boolean;
    /** Desktop secure panel — skip ghost thread fetch. */
    skipThreadsLoad?: boolean;
    /** Prefer in-page selection over route navigation. */
    onOpenConversation?: (conversationId: string, kind?: 'chat' | 'thread') => void;
}) => {
    const { user } = useAuth();
    const { unreadConversations } = useChatNotifications();
    const { globalPresence } = usePresence();
    const { requestSudo } = useSudo();
    const { openOverlay, closeOverlay } = useOverlay();
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const { isPinned: isResourcePinned, togglePin: _togglePin, pinSets } = useResourcePins();
    const initialChats = peekChatsListMemory();
    const initialThreads = peekThreadsListMemory();
    const [conversations, setConversations] = useState<any[]>(() => initialChats);
    const [loading, setLoading] = useState(() => !skipSecureLoad && initialChats.length === 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [_searching, setSearching] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const isUnlockedRef = React.useRef(isUnlocked);
    useEffect(() => {
        isUnlockedRef.current = isUnlocked;
    }, [isUnlocked]);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const conversationsRef = React.useRef<any[]>(initialChats);
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
    const [_isPending, startTransition] = useTransition();
    const [activeTabState, setActiveTabState] = useState<'secure' | 'public'>(() => {
        return propActiveTab || 'secure';
    });
    const activeTab = propActiveTab || activeTabState;

    const [ghostConversations, setGhostConversations] = useState<any[]>(() => initialThreads);
    const [loadingGhost, setLoadingGhost] = useState(() => !skipThreadsLoad && initialThreads.length === 0);

    const [isInitializing, setIsInitializing] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [showCountdownDrawer, setShowCountdownDrawer] = useState(false);

    const setActiveTab = useCallback((tab: 'secure' | 'public') => {
        setActiveTabState(tab);
        if (onTabChange) onTabChange(tab);
    }, [onTabChange]);

    const openConversation = useCallback(
        (conversationId: string, kind: 'chat' | 'thread' = 'chat') => {
            if (onOpenConversation) {
                onOpenConversation(conversationId, kind);
                return;
            }
            // No dedicated chat page — open fullscreen / sidebar detail in place
            openCommObjectDetail({
                conversationId,
                kind,
                openSidebar,
                openOverlay,
                closeSidebar,
                closeOverlay,
            });
        },
        [onOpenConversation, openSidebar, openOverlay, closeSidebar, closeOverlay],
    );

    const openAvatarPeek = useCallback((conv: any) => {
        if (conv?.type === 'group') {
            setSelectedConversation(conv);
            return;
        }
        const otherId =
            Array.isArray(conv?.participants) && user?.$id
                ? conv.participants.find((p: string) => p !== user.$id)
                : null;
        const profile = {
            userId: otherId || conv?.otherUserId || (conv?.isSelf ? user?.$id : undefined),
            username: conv?.username || conv?.otherUsername,
            conversationId: conv?.$id,
            seed: {
                displayName: conv?.name,
                username: conv?.username || conv?.otherUsername,
                avatar: conv?.avatarUrl || conv?.avatar,
            },
        };
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
        const node = (
          <ProfileSidebar
            userId={profile.userId}
            username={profile.username}
            conversationId={profile.conversationId}
            seed={profile.seed}
            onClose={isDesktop ? closeSidebar : closeOverlay}
          />
        );
        const key = `profile-${profile.userId || profile.username || conv?.$id}`;
        if (isDesktop) openSidebar(node, key, { hideHeader: true });
        else openOverlay(node);
    }, [user?.$id, openSidebar, openOverlay, closeSidebar, closeOverlay]);

    const sortConversations = useCallback((rows: any[]) => {
        const pinned = pinSets.conversation;
        return [...rows].sort((a, b) => {
            const ap = pinned.has(a.$id) ? 1 : 0;
            const bp = pinned.has(b.$id) ? 1 : 0;
            if (ap !== bp) return bp - ap;
            if (a.isSelf && !a.lastMessageAt) return -1;
            if (b.isSelf && !b.lastMessageAt) return 1;
            const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
            const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
            return timeB - timeA;
        });
    }, [pinSets.conversation]);

    const [chatSettingsConv, setChatSettingsConv] = useState<any | null>(null);

    // Unified hangout settings entry — desktop right sidebar / mobile bottom drawer z-[1401]
    const openChatSettings = useCallback((conv: any) => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        const isSelf = conv?.isSelf || (Array.isArray(conv?.participants) && conv.participants.length === 1 && conv.participants[0] === user?.$id);
        const isSecure = conv?._kind === 'secure' || !!conv?.isEncrypted || String(conv?.$id || '').length > 20 && !conv?.linkedResourceType;
        const handleExport = async () => {
            try {
                if (isSecure) {
                  const msgs = await ChatService.getMessages(conv.$id, 100, 0, user?.$id, { prefetchedConversation: conv }).then(r => r.rows || []).catch(() => []);
                  const data = msgs.map((m: any) => ({ sender: m.senderId === user?.$id ? 'Me' : 'Partner', time: m.$createdAt || m.createdAt, content: m.content, type: m.type }));
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `chat_export_${conv.$id}.json`; a.click();
                  URL.revokeObjectURL(url);
                } else {
                  const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `thread_export_${conv.$id}.json`; a.click();
                  URL.revokeObjectURL(url);
                }
                toast.success('Export downloaded');
            } catch { toast.error('Export failed'); }
        };
        const handleClearMe = async () => {
          try {
            if (isSecure) await ChatService.clearChatForMe(conv.$id, user!.$id);
            else await deleteGhostThread(conv.$id);
            toast.success('Chat cleared');
            if (!isSecure) setConversations(prev => prev.filter(x => x.$id !== conv.$id));
          } catch (e: any) { toast.error(e?.message || 'Failed'); }
        };
        const handleClearEveryone = async () => {
          try {
            if (isSecure) { const r: any = await ChatService.wipeMyFootprint(conv.$id, user!.$id); toast.success(`Removed ${r.count || 0} messages`); }
            else { await deleteGhostThread(conv.$id); toast.success('Thread cleared'); setConversations(prev => prev.filter(x => x.$id !== conv.$id)); }
          } catch (e: any) { toast.error(e?.message || 'Failed'); }
        };
        const handleNuclear = async () => {
            try {
              if (isSecure) {
                const res: any = await ChatService.nuclearWipe(conv.$id);
                const newId = res?.regeneratedConversationId || res?.newConversationId;
                if (newId) toast.success('Wiped — fresh hangout regenerated');
                else toast.success('Conversation deleted');
              } else {
                await deleteGhostThread(conv.$id);
                toast.success('Thread wiped');
              }
              setConversations(prev => prev.filter(c => c.$id !== conv.$id));
            } catch (e: any) { toast.error(e?.message || 'Wipe failed'); }
        };
        if (isDesktop) {
          const node = (
            <ChatSettingsPanel
              conversation={conv}
              conversationId={conv.$id}
              isSelf={!!isSelf}
              messages={[]}
              onClose={closeSidebar}
              onExport={handleExport}
              onClearMe={handleClearMe}
              onClearEveryone={handleClearEveryone}
              onNuclear={handleNuclear}
            />
          );
          openSidebar(node, `chat-settings-${conv.$id}`, { hideHeader: true });
        } else {
          // Mobile: local bottom drawer — guarantees visible even when Overlay bridge is dormant
          setChatSettingsConv(conv);
        }
    }, [user?.$id, openSidebar, closeSidebar]);

    // Long-press (mobile) → same hangout settings context as three-dots / right-click
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFiredRef = useRef(false);
    const startLongPress = useCallback((conv: any) => {
        longPressFiredRef.current = false;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
            longPressFiredRef.current = true;
            if (typeof navigator !== 'undefined' && (navigator as any).vibrate) { try { (navigator as any).vibrate(28); } catch {} }
            openChatSettings(conv);
        }, 520);
    }, [openChatSettings]);
    const cancelLongPress = useCallback(() => {
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    }, []);

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
        // Chrome-surfaces: right-click on chat item → same settings drawer/right-sidebar as three dots
        openChatSettings(conv);
    }, [openChatSettings]);

    const handleGhostConversationRightClick = useCallback((event: React.MouseEvent, conv: any) => {
        event.preventDefault();
        openChatSettings(conv);
    }, [openChatSettings]);

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

    // Instant paint: memory → LocalEngine. Never wait on network for first frame. Local-first: paint cached instantly, hide skeletons.
    useEffect(() => {
        migrateLegacyChatListCache();
        let cancelled = false;
        // Memory already painted via initial state (peek); clear skeletons instantly if we have it
        if (!skipSecureLoad && conversationsRef.current.length > 0) setLoading(false);
        if (!skipThreadsLoad && ghostConversations.length > 0) setLoadingGhost(false);
        void (async () => {
            if (!skipSecureLoad && conversationsRef.current.length === 0) {
                const cached = await readChatsListLocal();
                if (!cancelled) {
                    if (cached.length) {
                        startTransition(() => {
                            setConversations(cached);
                            conversationsRef.current = cached;
                        });
                    }
                    setLoading(false);
                }
            } else if (!skipSecureLoad) {
                setLoading(false);
            }
            if (!skipThreadsLoad && ghostConversations.length === 0) {
                const cachedThr = await readThreadsListLocal();
                if (!cancelled) {
                    if (cachedThr.length) {
                        startTransition(() => {
                            setGhostConversations(cachedThr);
                        });
                    }
                    setLoadingGhost(false);
                }
            } else if (!skipThreadsLoad) {
                setLoadingGhost(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount hydrate only
    }, [skipSecureLoad, skipThreadsLoad, startTransition]);

    useEffect(() => {
        if (propActiveTab) {
            setActiveTabState(propActiveTab);
        }
    }, [propActiveTab]);

    // Secure list is plaintext metadata — never auto-switch to public when locked

    useEffect(() => {
        rememberConversationRoster(conversations);
    }, [conversations]);

    useEffect(() => () => {
        rememberConversationRoster([]);
    }, []);

    const ghostConversationsRef = React.useRef<any[]>(initialThreads);
    useEffect(() => {
        ghostConversationsRef.current = ghostConversations;
    }, [ghostConversations]);

    const loadGhostConversations = React.useCallback(async (options?: { silent?: boolean }) => {
        // Local-first: always paint local even when user not yet resolved (guest keyspace)
        if (ghostConversationsRef.current.length === 0) {
            const local = peekThreadsListMemory();
            if (local.length) {
                ghostConversationsRef.current = local;
                startTransition(() => setGhostConversations(local));
            } else {
                const disk = await readThreadsListLocal();
                if (disk.length) {
                    ghostConversationsRef.current = disk;
                    startTransition(() => setGhostConversations(disk));
                }
            }
        }

        const hasCachedRows = ghostConversationsRef.current.length > 0;
        setLoadingGhost(false);
        if (!options?.silent && !hasCachedRows) {
            // Soft empty-state spinner only when truly nothing local
            setLoadingGhost(true);
        }
        if (!user) {
            setLoadingGhost(false);
            return;
        }
        try {
            const results = await Promise.race([
                listGhostNoteChats(),
                new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('ghost fetch timeout')), 4000)),
            ]).catch((e) => {
                console.warn('[ChatList] ghost fetch timed out or failed:', (e as any)?.message);
                return null;
            }) as any;
            if (!results) {
                setLoadingGhost(false);
                return;
            }

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
                    lastMessageAt: note.updatedAt || note.$createdAt};
            });

            mapped.sort((a: any, b: any) => {
                const ap = pinSets.conversation.has(a.$id) ? 1 : 0;
                const bp = pinSets.conversation.has(b.$id) ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
            });

            writeThreadsListLocal(mapped);
            startTransition(() => {
                setGhostConversations(mapped);
            });
            setIsInitializing(false);
            setLoadingGhost(false);

            void (async () => {
                const missing = mapped.filter(
                    (entry: any) => entry.otherUserId && !entry.linkedResourceType && (!entry.avatarUrl || String(entry.name || '').startsWith('@')),
                );
                if (!missing.length) return;

                const enrichedBits = await Promise.all(
                    missing.slice(0, 24).map(async (entry: any) => {
                        const identity = await resolveIdentityById(entry.otherUserId, () =>
                            UsersService.getProfileById(entry.otherUserId),
                        );
                        if (!identity) return null;
                        let avatarUrl = entry.avatarUrl;
                        if (!avatarUrl && identity.avatar?.startsWith?.('http')) {
                            avatarUrl = identity.avatar;
                        } else if (!avatarUrl && identity.avatar) {
                            try {
                                avatarUrl = (await fetchProfilePreview(identity.avatar, 64, 64)) as unknown as string;
                            } catch {
                                avatarUrl = null;
                            }
                        }
                        seedIdentityCache({ ...identity, avatar: identity.avatar || avatarUrl });
                        return {
                            id: entry.$id,
                            patch: {
                                name: identity.displayName || identity.username || entry.name,
                                avatarUrl,
                            },
                        };
                    }),
                );

                const patches = new Map<string, any>();
                for (const bit of enrichedBits) {
                    if (bit?.id) patches.set(bit.id, bit.patch);
                }
                if (!patches.size) return;

                startTransition(() => {
                    setGhostConversations((prev) => {
                        const next = [...prev]
                            .map((c) => (patches.has(c.$id) ? { ...c, ...patches.get(c.$id) } : c))
                            .sort((a: any, b: any) => {
                                const ap = pinSets.conversation.has(a.$id) ? 1 : 0;
                                const bp = pinSets.conversation.has(b.$id) ? 1 : 0;
                                if (ap !== bp) return bp - ap;
                                return (
                                    new Date(b.lastMessageAt || 0).getTime() -
                                    new Date(a.lastMessageAt || 0).getTime()
                                );
                            });
                        writeThreadsListLocal(next);
                        return next;
                    });
                });
            })();
        } catch (error) {
            console.error('Failed to load ghost huddles:', error);
        } finally {
            setLoadingGhost(false);
        }
    }, [user, startTransition, pinSets.conversation]);

    // Keep pinned chats at the top when pin set changes
    useEffect(() => {
        setConversations((prev) => (prev.length ? sortConversations(prev) : prev));
        setGhostConversations((prev) => {
            if (!prev.length) return prev;
            return [...prev].sort((a, b) => {
                const ap = pinSets.conversation.has(a.$id) ? 1 : 0;
                const bp = pinSets.conversation.has(b.$id) ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
            });
        });
    }, [pinSets.conversation, sortConversations]);

    // Sync external query to local search
    useEffect(() => {
        if (externalQuery !== undefined) {
            setSearchQuery(externalQuery);
        }
    }, [externalQuery]);

    const isLikelyEncrypted = useCallback((val: string) => {
        if (!val || typeof val !== 'string') return false;
        const trimmed = val.trim();
        return (
            trimmed.startsWith('{"iv"') ||
            trimmed.startsWith('{"data"') ||
            trimmed.startsWith('{"ct"') ||
            trimmed.startsWith('[DECRYPTION_') ||
            (trimmed.length >= 24 && !trimmed.includes(' '))
        );
    }, []);

    const formatPreviewFromMessage = useCallback((message: any) => {
        if (!message) return 'No messages yet';
        const rawContent = message.content || `[${message.type || 'message'}]`;
        if (isLikelyEncrypted(rawContent)) {
            return '🔒 Encrypted message';
        }
        if (message.type === 'text' || message.type === 'attachment') {
            return rawContent;
        }
        return `[${message.type || 'message'}]`;
    }, [isLikelyEncrypted]);

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
        const targetUserId = targetUser.userId || targetUser.$id || targetUser.id;

        toast.loading('Checking secure setup…', { id: 'ghost-init' });

        // Always live-fetch BOTH profiles — search cards omit publicKey and single-side checks caused false threads.
        const [selfDiscovery, discovery] = await Promise.all([
            discoverRecipientSecureReady(user.$id),
            discoverRecipientSecureReady(
                targetUserId,
                typeof targetUser.publicKey === 'string' ? targetUser.publicKey : null,
            ),
        ]);

        const channel = resolveChatChannelKind({
            recipientReady: discovery.ready,
            selfReady: selfDiscovery.ready,
            explicitThread: activeTab === 'public',
        });

        if (channel === 'thread') {
            try {
                if (activeTab !== 'public' && (!discovery.ready || !selfDiscovery.ready)) {
                    toast(
                        "This person hasn't set up secure chat yet. Starting a standard chat instead.",
                        { id: 'ghost-init' },
                    );
                } else {
                    toast.loading('Opening chat…', { id: 'ghost-init' });
                }

                const existingGhosts = await listGhostNoteChats();
                const targetSet = canonicalDirectParticipants([user.$id, targetUserId]);
                const foundGhost = existingGhosts.find((c: any) => {
                    const participants = extractGhostParticipantIds(c);
                    return directParticipantsEqual(participants, targetSet);
                });

                if (foundGhost) {
                    toast.dismiss('ghost-init');
                    openConversation(foundGhost.$id, 'thread');
                    return;
                }

                const title =
                    discovery.profile?.displayName ||
                    targetUser.displayName ||
                    targetUser.username ||
                    'Chat';
                const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
                toast.success('Chat ready', { id: 'ghost-init' });
                openConversation(newGhost.$id, 'thread');
            } catch (error: any) {
                console.error('Failed to create thread:', error);
                toast.error(formatSecureChatStartError(error, 'thread'), { id: 'ghost-init' });
            }
            return;
        }

        // Secure default — BOTH ready. Hardened presence (exact participant set) before creating.
        const openSecure = async () => {
            try {
                await ecosystemSecurity.ensureE2EIdentity(user.$id);
                const targetSet = canonicalDirectParticipants([user.$id, targetUserId]);
                const foundLocal = conversations.find((c: any) => {
                    if (c.type !== 'direct' || !Array.isArray(c.participants)) return false;
                    return directParticipantsEqual(
                        canonicalDirectParticipants(c.participants),
                        targetSet,
                    );
                });
                if (foundLocal) {
                    toast.dismiss('ghost-init');
                    openConversation(foundLocal.$id, 'chat');
                    return;
                }
                try {
                    const existing = await ChatService.getConversations(user.$id);
                    const remote = existing.rows.find((c: any) => {
                        if (c.type !== 'direct' || !Array.isArray(c.participants)) return false;
                        return directParticipantsEqual(
                            canonicalDirectParticipants(c.participants),
                            targetSet,
                        );
                    });
                    if (remote) {
                        toast.dismiss('ghost-init');
                        openConversation(remote.$id, 'chat');
                        return;
                    }
                } catch {
                    /* create new */
                }

                const newConv = await ChatService.createConversation(
                    [user.$id, targetUserId],
                    'direct',
                );
                toast.success('Secure chat ready', { id: 'ghost-init' });
                openConversation(newConv.$id, 'chat');
            } catch (error: any) {
                console.error('Failed to create chat:', error);
                toast.error(formatSecureChatStartError(error, 'secure'), { id: 'ghost-init' });
            }
        };

        if (!isUnlocked) {
            toast.dismiss('ghost-init');
            requestSudo({
                onSuccess: () => {
                    void openSecure();
                },
            });
            return;
        }

        await openSecure();
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
            // List metadata is plaintext (participants, names) — show even when vault locked.
            // Only per-message E2EE body remains gated elsewhere. Local-first per architecture.local-first.
            // Always prefer local paint before any network
            if (conversationsRef.current.length === 0) {
                const local = peekChatsListMemory();
                if (local.length) {
                    conversationsRef.current = local;
                    startTransition(() => setConversations(local));
                } else {
                    const disk = await readChatsListLocal();
                    if (disk.length && loadRequestRef.current === requestId) {
                        conversationsRef.current = disk;
                        startTransition(() => setConversations(disk));
                    }
                }
            }

            // Never block the tab on network — local copy is the list SoT for paint
            setLoading(false);
            if (!user?.$id) {
                setLoading(false);
                return;
            }

            const response = await Promise.race([
                ChatService.getConversations(user.$id, {
                    forceRefresh: options?.forceRefresh,
                }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('conversations fetch timeout')), 4000)),
            ]).catch((e) => {
                console.warn('[ChatList] conversations fetch timed out or failed:', (e as any)?.message);
                return null;
            }) as any;
            if (!response) {
                setLoading(false);
                return;
            }
            let rows = [...response.rows];
            const listAuthoritative = (response as { authoritative?: boolean }).authoritative !== false;

            // Non-authoritative empty is not-yet-synced, not true empty — never overwrite local with empty. Self-chat guarantees ≥1 row.
            if (!listAuthoritative && rows.length === 0) {
                setLoading(false);
                return;
            }

            // Chats list rows are plaintext metadata — never block list on hasEncrypted/locked

            // Bridge: Detect and deduplicate self-chats, then ensure one exists
            const isSelfChat = (c: any) => ChatService.isSelfChatConversation(c, user!.$id);

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

            // Only auto-create when a dedicated probe succeeds and confirms absence.
            // A failed / non-authoritative list must never be treated as "does not exist".
            if (!selfChat && listAuthoritative) {
                console.log('[ChatList] No personal chat in list — verifying with dedicated probe…');
                void (async () => {
                    try {
                        const result = await ChatService.ensureSelfConversation(user!.$id);
                        if (result.skippedReason === 'probe_failed') {
                            console.warn('[ChatList] Personal chat probe failed; skipping auto-create');
                            return;
                        }
                        if (!result.conversation || loadRequestRef.current !== requestId) return;
                        console.log(
                            result.created
                                ? '[ChatList] Personal chat created:'
                                : '[ChatList] Personal chat recovered:',
                            result.conversation.$id,
                        );
                        startTransition(() => {
                            setConversations((current) => {
                                if (current.some((conv) => conv.$id === result.conversation!.$id)) {
                                    return current;
                                }
                                const next = [result.conversation!, ...current];
                                conversationsRef.current = next;
                                void writeChatsListLocal(next);
                                return next;
                            });
                        });
                    } catch (e: unknown) {
                        console.error('[ChatList] Failed to ensure personal chat', e);
                    }
                })();
            } else if (!selfChat && !listAuthoritative) {
                console.warn('[ChatList] Conversation list not authoritative; skipping personal chat auto-create');
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
                        lastMessageSenderId: previewSenderId};
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
                        lastMessageSenderId: previewSenderId};
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
                    lastMessageSenderId: previewSenderId};
            });

            const prevById = new Map(
                conversationsRef.current.map((c) => [c.$id, c] as const),
            );
            const mergedRows = baseRows.map((row) => {
                const prev = prevById.get(row.$id);
                if (!prev) return row;
                return {
                    ...row,
                    name: row.name && !String(row.name).startsWith('@') ? row.name : (prev.name || row.name),
                    avatarUrl: row.avatarUrl || prev.avatarUrl || null,
                    isSelf: row.isSelf || prev.isSelf,
                    otherUserId: row.otherUserId || prev.otherUserId,
                    lastMessageText: row.lastMessageText || prev.lastMessageText,
                };
            });

            // Empty is mathematically impossible (self-chat minimum). Never tell LocalEngine it is empty.
            if (mergedRows.length === 0) {
                console.warn('[ChatList] Remote returned 0 rows — preserving local copy (self-chat minimum)');
                setLoading(false);
                setIsInitializing(false);
                // Always ensure self-chat placeholder exists — local engine loads it even when vault locked.
                // Opening will prompt vault unlock if needed per UX spec.
                void (async () => {
                    try {
                        const res = await ChatService.ensureSelfConversation(user!.$id);
                        const conv = res.conversation || {
                            $id: `self-${user!.$id}`,
                            $createdAt: new Date().toISOString(),
                            lastMessageAt: new Date().toISOString(),
                            type: 'direct',
                            participants: [user!.$id],
                            isSelf: true,
                            name: 'You',
                            _placeholder: true,
                        };
                        const local = await readChatsListLocal();
                        // Prefer disk if it already has self, otherwise inject placeholder
                        const hasLocal = local.some((c: any) => c.$id === conv.$id || c.isSelf);
                        const next = hasLocal ? local : [conv, ...local];
                        const sortedEnsure = sortConversations(next as any);
                        // Persist placeholder to LocalEngine so next paint is instant
                        writeChatsListLocal(sortedEnsure as any);
                        startTransition(() => {
                            setConversations(sortedEnsure as any);
                            conversationsRef.current = sortedEnsure as any;
                        });
                    } catch {}
                })();
                // If we already have local, paint it immediately without waiting for placeholder
                if (conversationsRef.current.length === 0) {
                    void (async () => {
                        const disk = await readChatsListLocal();
                        if (disk.length) {
                            const sortedDisk = sortConversations(disk as any);
                            startTransition(() => {
                                setConversations(sortedDisk as any);
                                conversationsRef.current = sortedDisk as any;
                            });
                        }
                    })();
                }
                return;
            }

            const sorted = sortConversations(mergedRows);

            console.log('[ChatList] Base conversations count:', sorted.length);
            writeChatsListLocal(sorted);
            startTransition(() => {
                setConversations(sorted);
                conversationsRef.current = sorted;
            });
            setIsInitializing(false);
            setLoading(false);

            // Background identity enrich — never block list paint; only fill missing rows
            void (async () => {
                const missing = sorted.filter((conv: any) => {
                    if (conv.type !== 'direct') return false;
                    if (conv.isSelf) return !conv.avatarUrl;
                    return !conv.avatarUrl || String(conv.name || '').startsWith('@');
                });
                if (!missing.length) return;

                const settled = await Promise.allSettled(missing.slice(0, 24).map(async (conv: any) => {
                    const isActuallySelf = conv.isSelf || (conv.participants && (conv.participants.length === 1 || conv.participants.length === 2) && conv.participants.every((p: string) => p === user!.$id));
                    if (isActuallySelf) {
                        const myProfile = await UsersService.getProfileById(user!.$id);
                        if (!myProfile) return null;
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
                            id: conv.$id,
                            patch: {
                                name: `${myProfile.displayName || myProfile.username || user!.name || 'You'} (You)`,
                                avatarUrl,
                                isSelf: true,
                            },
                        };
                    }

                    const otherId = conv.otherUserId || conv.participants?.find((p: string) => p !== user!.$id);
                    if (!otherId) return null;
                    const profile = await UsersService.getProfileById(otherId);
                    if (!profile) return null;
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
                        id: conv.$id,
                        patch: {
                            otherUserId: otherId,
                            name: profile.displayName || profile.username || `@${otherId.slice(0, 7)}`,
                            avatarUrl,
                        },
                    };
                }));

                if (loadRequestRef.current !== requestId) return;
                const patches = new Map<string, any>();
                for (const entry of settled) {
                    if (entry.status === 'fulfilled' && entry.value?.id) {
                        patches.set(entry.value.id, entry.value.patch);
                    }
                }
                if (!patches.size) return;

                startTransition(() => {
                    setConversations((prev) => {
                        const next = sortConversations(
                            prev.map((c) => (patches.has(c.$id) ? { ...c, ...patches.get(c.$id) } : c)),
                        );
                        conversationsRef.current = next;
                        writeChatsListLocal(next);
                        return next;
                    });
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
    }, [user, startTransition, skipSecureLoad, sortConversations]);

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
                // Paint local copy immediately, then refresh in background
                void (async () => {
                    const cached = await readChatsListLocal();
                    if (cached.length) {
                        startTransition(() => {
                            setConversations(cached);
                            conversationsRef.current = cached;
                            setLoading(false);
                        });
                    }
                    void loadConversations({ silent: true, forceRefresh: true });
                })();
            } else if (!status.isUnlocked) {
                // Keep list visible when locked — chats metadata is plaintext; only E2EE body is gated.
                // Do NOT tell LocalEngine it is empty; empty is mathematically impossible (self-chat minimum).
                ChatService.clearConversationPreviewCache();
                // Invalidate memory cache so next unlock fetches fresh, but keep disk/local UI intact
                ChatService.invalidateConversationsListCache(user?.$id);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [loadConversations, user?.$id, startTransition]);

    // Secure list + realtime — once per user mount. Do NOT re-run on tab switch.
    useEffect(() => {
        if (!user) return;

        if (!skipSecureLoad) {
            void loadConversations({ silent: conversationsRef.current.length > 0 });
        }

        const conversationChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.documents`;
        const messageChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`;

        if (skipSecureLoad) {
            return;
        }

        const subscription: any = realtime.subscribe(
            [conversationChannel, messageChannel],
            async (response) => {
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
                        prefetchedConversation: convRow});
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
                        lastMessageAt: livePreviewAt}}));
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
                            lastMessageText: livePreviewText};

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
                        lastMessageText: formatPreviewFromMessage(payload) || current.lastMessageText};

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
    }, [user, loadConversations, formatPreviewFromMessage, startTransition, skipSecureLoad, scheduleConversationsReload]);

    // Threads: load once when tab opens; keep local copy visible; refresh silently
    useEffect(() => {
        if (!user || skipThreadsLoad || activeTab !== 'public') return;
        void loadGhostConversations({ silent: ghostConversations.length > 0 || peekThreadsListMemory().length > 0 });

        const noteChannel = `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.documents`;
        const subscription: any = realtime.subscribe([noteChannel], () => {
            void loadGhostConversations({ silent: true });
        });
        return () => {
            if (typeof subscription === 'function') subscription();
            else if (subscription?.unsubscribe) subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: tab enter, not every ghost length change
    }, [user, activeTab, skipThreadsLoad, loadGhostConversations]);

    const filteredConversationsAll = conversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredGhostConversationsAll = ghostConversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const CHAT_PAGE_SIZE = 20;
    const [chatPage, setChatPage] = useState(1);
    const [ghostPage, setGhostPage] = useState(1);
    const chatSentinelRef = useRef<HTMLDivElement | null>(null);
    const ghostSentinelRef = useRef<HTMLDivElement | null>(null);
    const filteredConversations = useMemo(() => filteredConversationsAll.slice(0, chatPage * CHAT_PAGE_SIZE), [filteredConversationsAll, chatPage]);
    const filteredGhostConversations = useMemo(() => filteredGhostConversationsAll.slice(0, ghostPage * CHAT_PAGE_SIZE), [filteredGhostConversationsAll, ghostPage]);
    const hasMoreChats = filteredConversations.length < filteredConversationsAll.length;
    const hasMoreGhosts = filteredGhostConversations.length < filteredGhostConversationsAll.length;
    // Unified feed: secret chats + threads together, sorted by recency, pinned first. Secret shows lock on avatar.
    const unifiedItems = useMemo(() => {
        const secureMapped = filteredConversations.map((c: any) => ({ ...c, _kind: 'secure' as const, _sortAt: c.lastMessageAt || c.createdAt }));
        const threadMapped = filteredGhostConversations.map((c: any) => ({ ...c, _kind: 'thread' as const, _sortAt: c.lastMessageAt || c.$createdAt || c.createdAt }));
        const combined = [...secureMapped, ...threadMapped];
        const pinned = pinSets.conversation;
        return combined.sort((a: any, b: any) => {
            const ap = pinned.has(a.$id) ? 1 : 0;
            const bp = pinned.has(b.$id) ? 1 : 0;
            if (ap !== bp) return bp - ap;
            return new Date(b._sortAt || 0).getTime() - new Date(a._sortAt || 0).getTime();
        });
    }, [filteredConversations, filteredGhostConversations, pinSets.conversation]);
    useEffect(() => { setChatPage(1); setGhostPage(1); }, [searchQuery, conversations.length, ghostConversations.length]);
    useEffect(() => {
      if (!chatSentinelRef.current || !hasMoreChats) return;
      const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setChatPage((p) => p + 1); }, { rootMargin: '400px' });
      obs.observe(chatSentinelRef.current);
      return () => obs.disconnect();
    }, [hasMoreChats, filteredConversationsAll.length]);
    useEffect(() => {
      if (!ghostSentinelRef.current || !hasMoreGhosts) return;
      const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setGhostPage((p) => p + 1); }, { rootMargin: '400px' });
      obs.observe(ghostSentinelRef.current);
      return () => obs.disconnect();
    }, [hasMoreGhosts, filteredGhostConversationsAll.length]);

    // Soft skeletons only when there is zero local copy — never hide a painted list (unified)
    if (loading && conversations.length === 0 && ghostConversations.length === 0 && !skipSecureLoad && !skipThreadsLoad) return (
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

    const showGlobalResults = searchQuery.length >= 2 && searchResults.length > 0;

    const unifiedHasMore = hasMoreChats || hasMoreGhosts;

    return (
        <div className="flex flex-col relative w-full">
            {/* Unified — no separate tabs; secret chats show lock on avatar */}

            <div className="flex-1">
                {showGlobalResults && (
                    <div className="mb-8">
                        <span className="px-2 mb-4 block font-black text-[#9B9691] uppercase tracking-widest text-[10px] font-mono">
                            Global Directory
                        </span>
                        <div className="space-y-2">
                            {searchResults.map((u) => {
                                const targetId = u.userId || u.$id;
                                const hasChat = conversations.some(c => c.type === 'direct' && c.participants?.includes(targetId)) || ghostConversations.some(c => {
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

                <div className="flex items-center justify-end px-1 pb-2">
                    <button
                        type="button"
                        onClick={() => {
                            // Live refresh via permission-safe relay: force network, bypass local cache, keep realtime subscription alive
                            ChatService.invalidateConversationsListCache(user?.$id);
                            void loadConversations({ forceRefresh: true });
                            void loadGhostConversations({ forceRefresh: true } as any);
                            toast.success('Chat refreshed');
                        }}
                        disabled={loading || loadingGhost}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#161412] px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Refresh chat"
                        title="Refresh chat live"
                    >
                        <RefreshCw size={12} className={loading || loadingGhost ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {(loading || loadingGhost) && unifiedItems.length === 0 && !showGlobalResults ? (
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
                    ) : unifiedItems.length === 0 && !showGlobalResults ? (
                        <div className="p-12 text-center">
                            <span className="font-black text-white text-lg mb-1 font-clash block">No conversations yet</span>
                            <span className="text-sm text-[#9B9691] font-medium block">Start a hangout to see it here.</span>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {unifiedItems.map((conv: any) => {
                                const isSecure = conv._kind === 'secure';
                                const handler = isSecure ? (e: any) => handleConversationRightClick(e, conv) : (e: any) => handleGhostConversationRightClick(e, conv);
                                const openKind = isSecure ? 'chat' as const : 'thread' as const;
                                return (
                                <div key={conv.$id} className="w-full">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e: React.MouseEvent) => {
                                            if (longPressFiredRef.current) { longPressFiredRef.current = false; e.preventDefault(); return; }
                                            handleItemClick(e);
                                            if (!isInitializing) {
                                                openConversation(conv.$id, openKind);
                                            }
                                        }}
                                        onContextMenu={handler}
                                        onTouchStart={() => startLongPress(conv)}
                                        onTouchEnd={cancelLongPress}
                                        onTouchMove={cancelLongPress}
                                        onTouchCancel={cancelLongPress}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                if (!isInitializing) {
                                                    openConversation(conv.$id, openKind);
                                                }
                                            }
                                        }}
                                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-[20px] bg-[#161412] border border-[#34322F] hover:bg-[#1C1A18] hover:border-[#3C3A38] transition-colors text-left cursor-pointer ${activePreviewConversationId === conv.$id ? 'border-[#F59E0B]/50' : ''}`}
                                    >
                                        <div className="flex-shrink-0 mr-1 relative">
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
                                                    openAvatarPeek(conv);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    openAvatarPeek(conv);
                                                }}
                                                className="relative"
                                            >
                                                {isSecure ? (
                                                    <IdentityAvatar
                                                        userId={conv.isSelf ? user?.$id : conv.otherUserId}
                                                        src={conv.avatarUrl || conv.avatar || null}
                                                        alt={conv.name}
                                                        fallback={conv.name?.replace(/\(You\)/gi, '').replace(/^@/, '').trim().charAt(0).toUpperCase() || 'U'}
                                                        size={48}
                                                        status={conv.type === 'direct' && conv.otherUserId ? globalPresence?.[conv.otherUserId]?.state : undefined}
                                                    />
                                                ) : conv.linkedResourceType ? (
                                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#0A0908] border border-white/[0.06]">
                                                        <span className="font-clash font-black text-white text-[13px] tracking-tight leading-none">
                                                            {(() => {
                                                                const src = conv.linkedResourceName || conv.name || conv.linkedResourceType || 'H';
                                                                const parts = String(src).trim().split(/\s+/).filter(Boolean);
                                                                if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                                                const w = parts[0] || 'H';
                                                                return w.slice(0, 2).toUpperCase();
                                                            })()}
                                                        </span>
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
                                                {isSecure && (
                                                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0A0908] border border-[#34322F] flex items-center justify-center">
                                                        <Lock size={10} className="text-[#F59E0B]" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <span className={`font-black text-base font-clash tracking-tight truncate flex items-center gap-1.5 ${conv.isSelf ? 'text-[#F59E0B]' : 'text-white'}`}>
                                                {isResourcePinned('conversation', conv.$id, user?.$id, false) ? (
                                                    <Pin size={14} className="text-[#F59E0B] shrink-0 fill-[#F59E0B]" />
                                                ) : null}
                                                {conv.name || (conv.type === 'direct' ? conv.otherUserId : 'Hangout')}
                                                {isSecure && <Lock size={12} className="text-[#F59E0B] ml-1 shrink-0" />}
                                                {!isSecure && conv.linkedResourceType && (
                                                    <span className="px-2 py-0.5 rounded border text-[9px] font-black font-mono uppercase tracking-wider" style={{ backgroundColor: alpha(conv.linkedResourceType === 'project' ? '#6366F1' : conv.linkedResourceType === 'task' ? '#10B981' : conv.linkedResourceType === 'event' ? '#EC4899' : conv.linkedResourceType === 'form' ? '#8B5CF6' : conv.linkedResourceType === 'tag' ? '#EF4444' : '#F59E0B', 0.1), borderColor: alpha(conv.linkedResourceType === 'project' ? '#818CF8' : conv.linkedResourceType === 'task' ? '#34D399' : conv.linkedResourceType === 'event' ? '#F472B6' : conv.linkedResourceType === 'form' ? '#A78BFA' : conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24', 0.2), color: conv.linkedResourceType === 'project' ? '#818CF8' : conv.linkedResourceType === 'task' ? '#34D399' : conv.linkedResourceType === 'event' ? '#F472B6' : conv.linkedResourceType === 'form' ? '#A78BFA' : conv.linkedResourceType === 'tag' ? '#F87171' : '#FBBF24' }}>{conv.linkedResourceType}</span>
                                                )}
                                            </span>
                                            <span className="text-[#9B9691] font-medium text-sm truncate flex items-center gap-1.5">
                                                {isSecure ? (() => {
                                                    const memoryPreview = ChatService.getConversationPreviewSnapshot(conv.$id);
                                                    const memoryAt = memoryPreview?.lastMessageAt ? new Date(memoryPreview.lastMessageAt).getTime() : -1;
                                                    const rowAt = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : -1;
                                                    const memoryText = memoryPreview && (memoryAt >= rowAt || !conv.lastMessageText) ? memoryPreview.lastMessageText : null;
                                                    const resolvedPreview = livePreviewByConversation[conv.$id]?.lastMessageText || memoryText || conv.lastMessageText || 'No messages yet';
                                                    return (conv.isEncrypted && isLikelyEncrypted(resolvedPreview)) ? (
                                                        <span className="flex items-center gap-1"><Lock size={12} className="text-[#9B9691]" /><span>Secured Payload</span></span>
                                                    ) : (<span>{resolvedPreview}</span>);
                                                })() : (<span>{conv.lastMessageText}</span>)}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2">
                                            {conv.lastMessageAt && (
                                                <span className="text-[11px] text-[#9B9691] font-black font-mono">{new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                            )}
                                            {conv.lastMessageAt && conv.lastMessageId && !conv.isSelf && isSecure && (() => {
                                                const readAt = getConversationReadAt(user?.$id, conv.$id);
                                                const isUnread = unreadConversations.has(conv.$id) || (conv.lastMessageSenderId !== user?.$id && new Date(conv.lastMessageAt).getTime() > readAt);
                                                return isUnread ? (<span className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full shadow-[0_0_12px_rgba(245,158,11,0.4)]" />) : null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                )})}
                            </div>
                            {unifiedHasMore && (
                              <div ref={chatSentinelRef} className="flex justify-center py-6">
                                <span className="text-xs font-bold tracking-widest uppercase text-white/25">Loading more…</span>
                              </div>
                            )}
                            </>
                    )}
            </div>

            <ConversationActionsSheet
                conversation={selectedConversation}
                open={Boolean(selectedConversation)}
                onClose={() => setSelectedConversation(null)}
                onConversationUpdated={handleConversationUpdated}
                onConversationDeleted={handleConversationDeleted}
            />

            {/* Mobile hangout settings — bottom drawer z-[1401] opaque per openbricks/chrome-surfaces */}
            {chatSettingsConv && (
              <div className="fixed inset-0 z-[1401] flex items-end justify-center bg-black/50 backdrop-blur-[2px]" onClick={() => setChatSettingsConv(null)}>
                <div className="w-full max-w-[560px] max-h-[86dvh] overflow-hidden rounded-t-[24px] border-t border-white/[0.06] bg-[#0A0908] flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <ChatSettingsPanel
                    conversation={chatSettingsConv}
                    conversationId={chatSettingsConv.$id}
                    isSelf={!!chatSettingsConv?.isSelf}
                    messages={[]}
                    onClose={() => setChatSettingsConv(null)}
                    onExport={async () => {
                      try {
                        const isSecure = chatSettingsConv._kind === 'secure';
                        if (isSecure) {
                          const msgs = await ChatService.getMessages(chatSettingsConv.$id, 100, 0, user?.$id, { prefetchedConversation: chatSettingsConv }).then(r => r.rows || []).catch(() => []);
                          const data = msgs.map((m: any) => ({ sender: m.senderId === user?.$id ? 'Me' : 'Partner', time: m.$createdAt || m.createdAt, content: m.content, type: m.type }));
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `chat_export_${chatSettingsConv.$id}.json`; a.click(); URL.revokeObjectURL(url);
                        } else {
                          const blob = new Blob([JSON.stringify(chatSettingsConv, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `thread_export_${chatSettingsConv.$id}.json`; a.click(); URL.revokeObjectURL(url);
                        }
                        setChatSettingsConv(null);
                        toast.success('Export downloaded');
                      } catch { toast.error('Export failed'); }
                    }}
                    onClearMe={async () => {
                      const c = chatSettingsConv; setChatSettingsConv(null);
                      try {
                        if (c._kind === 'secure') await ChatService.clearChatForMe(c.$id, user!.$id);
                        else await deleteGhostThread(c.$id);
                        toast.success('Chat cleared');
                        setConversations(prev => prev.filter(x => x.$id !== c.$id));
                      } catch (e: any) { toast.error(e?.message || 'Failed'); }
                    }}
                    onClearEveryone={async () => {
                      const c = chatSettingsConv; setChatSettingsConv(null);
                      try {
                        if (c._kind === 'secure') { const r: any = await ChatService.wipeMyFootprint(c.$id, user!.$id); toast.success(`Removed ${r.count || 0} messages`); }
                        else { await deleteGhostThread(c.$id); toast.success('Thread cleared'); setConversations(prev => prev.filter(x => x.$id !== c.$id)); }
                      } catch (e: any) { toast.error(e?.message || 'Failed'); }
                    }}
                    onNuclear={async () => {
                      const c = chatSettingsConv; setChatSettingsConv(null);
                      try {
                        if (c._kind === 'secure') {
                          const res: any = await ChatService.nuclearWipe(c.$id);
                          const newId = res?.regeneratedConversationId || res?.newConversationId;
                          if (newId) toast.success('Wiped — fresh hangout regenerated');
                          else toast.success('Conversation deleted');
                        } else {
                          await deleteGhostThread(c.$id);
                          toast.success('Thread wiped');
                        }
                        setConversations(prev => prev.filter(x => x.$id !== c.$id));
                      } catch (e: any) { toast.error(e?.message || 'Wipe failed'); }
                    }}
                  />
                </div>
              </div>
            )}

            {showCountdownDrawer ? (
                <div className="mx-2 mb-4 rounded-2xl border border-[#F59E0B]/25 bg-[#161412] p-5 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F59E0B]/10 text-[#F59E0B]">
                        <ShieldCheck size={24} />
                    </div>
                    <h6 className="text-sm font-black font-clash text-white m-0 mb-2">
                        Secure chat needs a Master Pass
                    </h6>
                    <p className="text-[#9B9691] text-xs leading-relaxed m-0 mb-4">
                        Set up your Master Pass to unlock private chats on this device.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowCountdownDrawer(false);
                                requestSudo({
                                    intent: 'initialize',
                                    onSuccess: () => {
                                        setIsUnlocked(true);
                                        void loadConversations({ forceRefresh: true });
                                    },
                                });
                            }}
                            className="w-full py-2.5 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold"
                        >
                            Set up Master Pass
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelRedirect}
                            className="w-full py-2.5 rounded-xl border border-white/10 text-white text-xs font-bold hover:bg-white/5"
                        >
                            Not now
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
