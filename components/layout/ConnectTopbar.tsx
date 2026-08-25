/* eslint-disable react-hooks/rules-of-hooks */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
  alpha,
  AppBar,
  Box,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Tooltip,
  Typography,
  CircularProgress,
  Drawer,
  useMediaQuery,
  useTheme} from '@/lib/openbricks/primitives';
import { isFlowPath } from '@/lib/routing/app-paths';
import { searchLocalEngine, type GlobalResult } from '@/lib/search/globalLocalSearch';
import {
  Bot,
  Wallet,
  Copy as CopyIcon,
  User as UserIcon,
  Search,
  X as CloseIcon,
  Bell,
  Sparkles,
  Activity,
  ChevronRight,
  Keyboard,
  Target,
  FileText,
  Lock,
  MessageCircle,
  GitFork,
  Tag as TagIcon,
  Trash2 as TrashIcon,
  Share2 as ShareIcon,
  MoreVertical as MoreIcon,
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { useAuth } from '@/context/auth/AuthContext';
import { getUserProfilePicId, hasEffectivePaidAccess } from '@/lib/utils';
import { APP_BASE_PATHS } from '@/lib/constants';
import { getAppTone, type KylrixApp } from '@/lib/sdk/design';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { createTopbarPanelMotion, createTopbarSearchSurface, isTopbarScrollAtTop } from '@/lib/sdk/topbar';
import { createProfilePreviewManager, getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/sdk/appwrite';
import { stageProfileView } from '@/lib/profile-handoff';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useNativeSidebarApiOptional } from '@/context/RightRailContext';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { useProfile } from '@/components/providers/ProfileProvider';
import { useLocalContext } from '@/lib/context-engine';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSection } from '@/context/SectionContext';
import { executeInstantShare } from '@/lib/share/instant-share';

import {
  renderShortcutsList,
  searchOnPage,
  highlightElement,
  shortenUserId,
  type PageMatch,
} from './connect-topbar-utils';
import { SyncIndicator } from './SyncIndicator';

interface ConnectTopbarProps {
  className?: string;
}

export default function ConnectTopbar({
  className}: ConnectTopbarProps) {
  const { user, logout, isAuthenticating, updatePreferences } = useAuth();
  const { openWallet } = useWalletOverlay();
  const { openAgenticDrawer, closeAgenticDrawer } = useAgenticDrawer();
  const { open: openUnified } = useUnifiedDrawer();
  const nativeSidebar = useNativeSidebarApiOptional();
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPro = hasEffectivePaidAccess(user, currentTier);
  const router = useRouter();
  const [, startNavTransition] = useTransition();
  const navPush = useCallback((href: string) => startNavTransition(() => router.push(href)), [router]);
  const pathname = usePathname();
  const { setIsCollapsed } = useSidebar();
  const { activeWorkspace, workspaces, ownedWorkspaces, sharedWorkspaces, setActiveWorkspaceId, markWorkspacePublic, loadingWorkspaces } = useWorkspace();
  const { notes = [] } = useNotes();
  const { tasks = [], projects = [], selectTask } = useTask();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setActiveDetail } = useSection();
  // To let any drawer communicate full state expansion globally:
  const isDrawerExpanded = typeof window !== 'undefined' && document.body.classList.contains('drawer-expanded');
  
  if (isDrawerExpanded) {
    return null;
  }
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const activeApp = useMemo<KylrixApp>(() => {
    if (pathname?.startsWith('/app')) return 'note';
    if (isFlowPath(pathname)) return 'flow';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    if (pathname?.startsWith('/send')) return 'send';
    if (pathname?.startsWith('/workspace')) return 'projects';
    return 'kylrix';
  }, [pathname]);

  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [copyState, setCopyState] = useState<'idle' | 'copied-userid' | 'copied-username'>('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifHint, setNotifHint] = useState<{ id: string; title: string; description: string; accent: string } | null>(null);
  const [dismissedHintId, _setDismissedHintId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [searchShortcutsView, setSearchShortcutsView] = useState(false);
  const [onPageResults, setOnPageResults] = useState<PageMatch[]>([]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setOnPageResults([]);
      return;
    }
    const matches = searchOnPage(query);
    setOnPageResults(matches);
  }, [searchQuery]);

  const [localTags, setLocalTags] = useState<any[]>([]);
  const [localTrash, setLocalTrash] = useState<any[]>([]);
  const [localForms, setLocalForms] = useState<any[]>([]);

  useEffect(() => {
    if (!searchOpen) return;
    const uid = user?.$id || 'guest';
    import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
      Promise.all([
        LocalEngine.cacheGet<any[]>(`f_tags_list_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`trash_all_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_forms_${uid}`).catch(() => []),
      ]).then(([tagsData, trashData, formsData]) => {
        if (Array.isArray(tagsData)) setLocalTags(tagsData);
        if (Array.isArray(trashData)) setLocalTrash(trashData);
        if (Array.isArray(formsData)) setLocalForms(formsData);
      });
    });
  }, [searchOpen, user?.$id]);

  const { events: localEvents } = useLocalContext();
  const globalResults = useMemo(() => {
    return searchLocalEngine(searchQuery, {
      notes,
      tasks,
      workspaces: projects,
      events: localEvents,
      forms: localForms,
      flows: [],
      vaultCreds: [],
      vaultTotp: [],
      moments: [],
      chats: [],
      threads: [],
      tags: localTags,
      trash: localTrash,
    });
  }, [searchQuery, notes, tasks, projects, localEvents, localForms, localTags, localTrash]);
  const groupedGlobalResults = useMemo(() => {
    const byKind: Record<string, GlobalResult[]> = {};
    for (const r of globalResults) {
      byKind[r.kind] = byKind[r.kind] || [];
      byKind[r.kind].push(r);
    }
    return byKind;
  }, [globalResults]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const { suggestions, dismissSuggestion } = useLocalContext();

  // Watch for new intelligence pulses (suggestions) to show in Dynamic Island
  useEffect(() => {
    if (suggestions.length > 0) {
      const latest = suggestions[0];
      // Only show hint if it's new, not already the hint, and not dismissed
      if (latest.id !== dismissedHintId && (!notifHint || notifHint.id !== latest.id)) {
        setNotifHint({
          id: latest.id,
          title: latest.title,
          description: latest.description,
          accent: latest.niche === 'intelligence' ? '#6366F1' : '#10B981'
        });
        // Clear hint after 8 seconds to return to standard search expansion
        const timer = setTimeout(() => setNotifHint(null), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [suggestions, notifHint, dismissedHintId]);

  const [notifications, setNotifications] = useState([
    { id: 'notif-1', title: 'Workspace Sync Complete', message: 'All local action workflows and workspace logs successfully synchronized.', time: 'Just now', read: false, accent: '#10B981' },
    { id: 'notif-2', title: 'Workflows Negations Active', message: 'Action chain engine generated valid inversions for 3 private notes.', time: '2 hours ago', read: false, accent: '#6366F1' },
    { id: 'notif-3', title: 'Secure Keychain Audited', message: 'Local master credentials checked. Integrity score 100%.', time: '1 day ago', read: true, accent: '#F59E0B' }
  ]);

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const dismissNotification = (id: string, event: any) => {
    event.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);
  const tone = getAppTone(activeApp);
  const appAccent = getAppColor(activeApp);
  const { profile: myProfile } = useProfile();
  const profileName = user?.name || user?.email || 'User';
  const profileUsername = myProfile?.username || (user as any)?.username || (user as any)?.prefs?.username || null;
  
  const [_isClient, setIsClient] = useState(true);
  useEffect(() => setIsClient(true), []);

  const profileSeed = useMemo(
    () => ({
      username: profileUsername ? String(profileUsername).replace(/^@+/, '').toLowerCase() : null,
      displayName: profileName,
      avatar: profileAvatarUrl || profilePicId || null,
      userId: (user as any)?.$id || null}),
    [profileAvatarUrl, profileName, profilePicId, profileUsername, user]);

  const previewManager = useMemo(
    () =>
      createProfilePreviewManager(async (fileId, width, height) => {
        const { fetchProfilePreview } = await import('@/lib/profile-preview');
        const preview = await fetchProfilePreview(fileId, width, height);
        return typeof preview === 'string' ? preview : null;
      }),
    []);

  useEffect(() => {
    let mounted = true;

    const resolveProfilePreview = async () => {
      if (!profilePicId) {
        if (mounted) setProfileAvatarUrl(null);
        return;
      }

      const cached = previewManager.getCachedProfilePreview(profilePicId);
      if (cached !== undefined) {
        if (mounted) setProfileAvatarUrl(cached ?? null);
        return;
      }

      try {
        const url = await previewManager.fetchProfilePreview(profilePicId, 64, 64);
        if (mounted) setProfileAvatarUrl(url);
      } catch {
        if (mounted) setProfileAvatarUrl(null);
      }
    };

    void resolveProfilePreview();
    return () => {
      mounted = false;
    };
  }, [previewManager, profilePicId]);

  const openSearch = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchShortcutsView(false);
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
  }, []);

  const handleCloseAll = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchOpen(false);
    setSearchShortcutsView(false);
    setNotificationsOpen(false);
    setNotifHint(null);
    closeAgenticDrawer();
  }, [closeAgenticDrawer]);

  const openAgenticFromTopbar = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchOpen(false);
    setSearchShortcutsView(false);
    setNotificationsOpen(false);
    setNotifHint(null);
    openAgenticDrawer();
  }, [openAgenticDrawer]);

  const openSearchShortcuts = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setNotificationsOpen(false);
    setNotifHint(null);
    setSearchOpen(true);
    setSearchShortcutsView(true);
  }, []);

  const toggleNotifications = useCallback(() => {
    if (!notificationsOpen) {
      handleCloseAll();
      setNotificationsOpen(true);
    } else {
      setNotificationsOpen(false);
    }
    setNotifHint(null);
  }, [notificationsOpen, handleCloseAll]);

  const openAppMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProfileMenuAnchorEl(event.currentTarget);
    setCopyState('idle');
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setPeopleResults([]);
      return;
    }

    let mounted = true;
    const searchPeople = async () => {
      setSearchingPeople(true);
      try {
        const results = await searchGlobalUsers(query);
        if (mounted) setPeopleResults(results);
      } catch (err) {
        console.error('Failed to search people', err);
      } finally {
        if (mounted) setSearchingPeople(false);
      }
    };

    const timer = setTimeout(searchPeople, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const searchSurface = useMemo(
    () =>
      createTopbarSearchSurface({
        query: searchQuery,
        routeLabel: activeApp.charAt(0).toUpperCase() + activeApp.slice(1),
        currentApp: activeApp,
        snippets: [],
        resolveUrl: (app, path = '') => {
          return (APP_BASE_PATHS[app as keyof typeof APP_BASE_PATHS] || '/') + path;
        }}),
    [searchQuery, activeApp]);

  const dynamicQuickActions = useMemo(() => {
    // 1. Dynamic recommendations based on current app route
    const routeSuggestions = {
      note: [
        { id: 'create-note', title: 'Write a New Idea', description: 'Create a private idea inside your workspace', href: '/app', kind: 'note', accent: '#EC4899' },
        { id: 'view-settings', title: 'Security Preferences', description: 'Adjust your ideas security & encryption rules', href: '/settings', kind: 'system', accent: '#6366F1' }
      ],
      projects: [
        { id: 'create-proj', title: 'Start Fresh Project', description: 'Spin up outcome-aware container', href: '/app', kind: 'flow', accent: '#6366F1' },
        { id: 'view-wf', title: 'Manage Action Workflows', description: 'Automate repetitive workflows', href: '/flows', kind: 'note', accent: '#A855F7' }
      ],
      flow: [
        { id: 'manage-tasks', title: 'View Outstanding Tasks', description: 'Review scheduled deliverables and actions', href: '/flows', kind: 'flow', accent: '#A855F7' }
      ],
      vault: [
        { id: 'share-secrets', title: 'Audit Ephemeral Secrets', description: 'Review sharing keychains and rules', href: '/vault', kind: 'vault', accent: '#10B981' }
      ],
      connect: [
        { id: 'start-huddle', title: 'Start Connect Huddle', description: 'Centralize calls and group threads', href: '/connect', kind: 'connect', accent: '#F59E0B' }
      ]
    };

    const currentAppSuggestions = routeSuggestions[activeApp as keyof typeof routeSuggestions] || [];

    // 2. Historical recommendations based on past user actions (most frequent niches in cache)
    const nicheCounts: Record<string, number> = {};
    localEvents.forEach(e => {
      nicheCounts[e.niche] = (nicheCounts[e.niche] || 0) + 1;
    });

    let topNiche = '';
    let maxCount = 0;
    Object.entries(nicheCounts).forEach(([niche, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topNiche = niche;
      }
    });

    const historicalSuggestions = [];
    if (topNiche === 'workspace' && activeApp !== 'note') {
      historicalSuggestions.push({
        id: 'hist-note',
        title: 'Review Recent Ideas',
        description: 'You spent a lot of time in workspace ideas recently. Resume writing?',
        href: '/app',
        kind: 'note',
        accent: '#EC4899'
      });
    } else if (topNiche === 'productivity' && activeApp !== 'flow') {
      historicalSuggestions.push({
        id: 'hist-flow',
        title: 'Coordinate Action Items',
        description: 'Manage outstanding roadmaps and deliverables',
        href: '/flows',
        kind: 'flow',
        accent: '#A855F7'
      });
    }
 else if (topNiche === 'security' && activeApp !== 'vault') {
      historicalSuggestions.push({
        id: 'hist-vault',
        title: 'Audit Vault Keychain',
        description: 'Manage passwords and TOTP codes safely',
        href: '/vault',
        kind: 'vault',
        accent: '#10B981'
      });
    }

    return [...currentAppSuggestions, ...historicalSuggestions].slice(0, 3);
  }, [activeApp, localEvents]);

  const handleCopyUserId = useCallback(async () => {
    if (!profileSeed.userId || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(profileSeed.userId);
    setCopyState('copied-userid');
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [profileSeed.userId]);

  const handleCopyUsername = useCallback(async () => {
    if (!profileSeed.username || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`@${profileSeed.username}`);
    setCopyState('copied-username');
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [profileSeed.username]);

  const handleOpenFullProfile = useCallback(() => {
    if (!profileSeed.username) return;
    stageProfileView(profileSeed as any, profileSeed.avatar || null);
    handleCloseAll();
    router.push(`/u/${encodeURIComponent(profileSeed.username)}?transition=profile`);
  }, [profileSeed, handleCloseAll, router]);

  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = searchOpen ? 'search' : notificationsOpen ? 'notifications' : profileMenuAnchorEl ? 'profile' : appMenuAnchorEl ? 'ecosystem' : null;

  useEffect(() => {
    if (!activePanel) return;

    const isInsideTopbarSurface = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (headerRef.current?.contains(target)) return true;
      return Boolean(
        target.closest(
          '[data-kylrix-topbar-panel], [data-kylrix-native-sidebar], .ob-drawer-root, .ob-drawer-panel, .kylrix-sidebar'));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isInsideTopbarSurface(event.target)) return;
      handleCloseAll();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [activePanel, handleCloseAll]);

  const [_searchMode, setSearchMode] = useState<'global' | 'feed'>('global');
  const [feedSearchResults, setFeedSearchResults] = useState<any[]>([]);

  useEffect(() => {
    const handleOpenTopbarSearch = (event?: any) => {
      const detail = event?.detail;
      if (detail?.mode === 'feed') {
        setSearchMode('feed');
      } else {
        setSearchMode('global');
      }
      openSearch();
    };
    window.addEventListener('kylrix:open-topbar-search' as any, handleOpenTopbarSearch);
    return () => window.removeEventListener('kylrix:open-topbar-search' as any, handleOpenTopbarSearch);
  }, [openSearch]);

  // Debounced feed search across LocalEngine & live Nostr relays
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setFeedSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const words = query.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [query.toLowerCase()];
      if (words.length) {
        void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) => {
          recordFeedInteraction({ topics: words, searchWeight: 3 });
        });
      }

      let cancelled = false;
      void (async () => {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const moments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
          const localMatches = moments.filter((m) => {
            const text = `${m.caption || m.content || ''} ${m.userName || m.user?.name || ''} ${m.username || ''}`.toLowerCase();
            return words.some((w) => text.includes(w));
          });

          // Optimistically load matching Nostr posts from relays
          const { NostrRelayPool } = await import('@/lib/nostr/nostr');
          const { getNostrReadRelays } = await import('@/lib/connect/feed-settings');
          const relays = await getNostrReadRelays();
          const pool = new NostrRelayPool(relays);
          await pool.connect();

          const nostrMatches: any[] = [];
          pool.addListener((ev) => {
            if (cancelled || ev.kind !== 1) return;
            const content = (ev.content || '').toLowerCase();
            if (words.some((w) => content.includes(w))) {
              if (!nostrMatches.some((m) => m.id === ev.id)) {
                nostrMatches.push({
                  id: `nostr_${ev.id}`,
                  content: ev.content,
                  userName: `npub…${ev.pubkey.slice(-8)}`,
                  pubkey: ev.pubkey,
                  source: 'nostr',
                  createdAt: ev.created_at * 1000,
                });
                if (!cancelled) {
                  setFeedSearchResults([...localMatches, ...nostrMatches].slice(0, 25));
                }
              }
            }
          });

          pool.subscribe('feed-live-search', [{ kinds: [1], limit: 30 }]);
          if (!cancelled) setFeedSearchResults(localMatches.slice(0, 20));

          setTimeout(() => {
            if (pool) pool.close();
          }, 3000);
        } catch {}
      })();
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseAll();
      }
    };
    window.addEventListener('keydown', handleGlobalEscape, true);
    return () => window.removeEventListener('keydown', handleGlobalEscape, true);
  }, [handleCloseAll]);

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      
      const key = event.key.toLowerCase();

      // Leave Ctrl/Cmd+A for native select-all — never bind or preventDefault it.
      if (key === 'a') return;

      if (event.shiftKey && key === 'v') {
        event.preventDefault();
        handleCloseAll();
        router.push('/vault');
        return;
      }
      
      // Load user-defined custom shortcuts if any
      let customShortcuts: any[] = [];
      try {
        const stored = localStorage.getItem('user-shortcuts');
        if (stored) customShortcuts = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse user-shortcuts:', e);
      }

      const customMatch = customShortcuts.find(
        (s: any) => s.key.toLowerCase() === key && (s.ctrlKey ?? true)
      );

      if (customMatch) {
        event.preventDefault();
        handleCloseAll();
        if (customMatch.action === 'navigate' && customMatch.targetUrl) {
          router.push(customMatch.targetUrl);
        } else if (customMatch.action === 'custom') {
          window.dispatchEvent(new CustomEvent('custom-shortcut-triggered', { detail: customMatch }));
        } else {
          triggerBuiltInAction(customMatch.action);
        }
        return;
      }

      // Default system shortcuts
      const builtInActions: Record<string, string> = {
        f: 'search',
        k: 'agent',
        s: 'apps',
        m: 'profile',
        p: '/app',
        n: '/app',
        t: '/tags',
        x: '/settings',
        g: '/goals',
        q: '/forms',
        e: '/events',
        h: '/connect/chats'};

      const action = builtInActions[key];
      if (action) {
        event.preventDefault();
        handleCloseAll();
        if (action.startsWith('/')) {
          router.push(action);
        } else {
          triggerBuiltInAction(action);
        }
      }
    };

    const triggerBuiltInAction = (action: string) => {
      switch (action) {
        case 'search':
          openSearch();
          break;
        case 'apps':
          setAppMenuAnchorEl(document.body);
          break;
        case 'profile':
          setProfileMenuAnchorEl(document.body);
          break;
        case 'agent':
          openAgenticFromTopbar();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [handleCloseAll, openSearch, openAgenticFromTopbar, router]);

  const renderNotificationDrawer = () => {
    if (!notificationsOpen) return null;

    const content = (
      <Box
        onWheel={(event: React.WheelEvent) => {
          if (isDesktop) return;
          const node = event.currentTarget;
          if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
            event.preventDefault();
            handleCloseAll();
          }
        }}
        sx={{ px: { xs: 2.25, md: 4 }, py: 1.25, maxHeight: isDesktop ? 'none' : '45vh', overflowY: isDesktop ? 'visible' : 'auto' }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: '26px',
            bgcolor: '#161412',
            border: `1px solid ${alpha(appAccent, 0.22)}`,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, pt: 0.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '12px', display: 'grid', placeItems: 'center', color: appAccent, bgcolor: alpha(appAccent, 0.08), border: `1px solid ${alpha(appAccent, 0.18)}`, flexShrink: 0 }}>
                  <Bell size={16} strokeWidth={2.5} />
                </Box>
                <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                  <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.92rem', lineHeight: 1.2, fontFamily: 'var(--font-clash)' }}>
                    Notifications
                  </Typography>
                  <Typography component="span" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: '0.68rem', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {suggestions.length + notifications.length ? `${suggestions.length + notifications.length} updates` : 'All caught up'}
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={() => setNotificationsOpen(false)} size="small" sx={{ width: 30, height: 30, borderRadius: '999px', color: alpha('#fff', 0.7), bgcolor: alpha('#fff', 0.05), border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' } }}>
                ✕
              </IconButton>
            </Box>

            <Box sx={{ display: 'grid', gap: 1, pr: 0.25 }}>
              {suggestions.map(suggestion => (
                <Box
                  key={suggestion.id}
                  component="button"
                  onClick={() => {
                    dismissSuggestion(suggestion.id);
                    setNotifHint(null);
                    handleCloseAll();
                    if (suggestion.actionHref) router.push(suggestion.actionHref);
                  }}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.25,
                    py: 1.5,
                    borderRadius: '18px',
                    bgcolor: '#1C1A18',
                    border: '1px solid rgba(99,102,241,0.14)',
                    color: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: '#23211F', borderColor: 'rgba(99,102,241,0.28)', transform: 'translateY(-1px)' }
                  }}
                >
                  <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.12)', color: '#6366F1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Sparkles size={16} strokeWidth={2.2} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35, pr: 0.5 }}>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.25 }} noWrap>
                      {suggestion.title}
                    </Typography>
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.62)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      {suggestion.description}
                    </Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.2)' }}>
                    <ChevronRight size={16} />
                  </Box>
                </Box>
              ))}

              {notifications.map(notif => (
                <Box
                  key={notif.id}
                  component="button"
                  onClick={() => markNotificationRead(notif.id)}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.25,
                    py: 1.5,
                    borderRadius: '18px',
                    bgcolor: notif.read ? '#0B0A09' : '#1C1A18',
                    border: '1px solid',
                    borderColor: notif.read ? 'rgba(255,255,255,0.06)' : alpha(notif.accent, 0.14),
                    color: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: '#23211F', borderColor: alpha(notif.accent, 0.22) }
                  }}
                >
                  <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: alpha(notif.accent, 0.12), color: notif.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Activity size={16} strokeWidth={2.2} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35, pr: 0.5 }}>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.25 }} noWrap>
                      {notif.title}
                    </Typography>
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.62)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      {notif.message}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      dismissNotification(notif.id, e);
                    }}
                    sx={{ flexShrink: 0, width: 28, height: 28, color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' } }}
                  >
                    <CloseIcon size={12} />
                  </IconButton>
                </Box>
              ))}

              {notifications.length === 0 && suggestions.length === 0 && (
                <Box sx={{ py: 4, textAlign: 'center', display: 'grid', placeItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center' }}>
                    <Bell size={20} style={{ color: 'rgba(255,255,255,0.18)' } as any} />
                  </Box>
                  <Typography component="span" sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.2 }}>
                    No new notifications
                  </Typography>
                  <Typography component="span" sx={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.35 }}>
                    You&apos;re all caught up
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={notificationsOpen}
            sidebarKey="topbar-notifications"
            width={420}
            title="Notifications"
          >
            {content}
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="right"
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              backgroundImage: 'none',
              width: 420,
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          {content}
        </Drawer>
      );
    }

    return (
      <Box
        data-kylrix-topbar-panel
        sx={{
          width: '100%',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 28px 28px',
          bgcolor: '#161412',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)'}}
      >
        {content}
      </Box>
    );
  };

  const renderSearchPanel = () => {
    if (!searchOpen) return null;

    const query = searchQuery.trim().toLowerCase();
    const hasQuery = query.length >= 2;

    const searchContent = (
      <Box
        onWheel={(event: React.WheelEvent) => {
          if (isDesktop) return;
          const node = event.currentTarget;
          if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
            event.preventDefault();
            handleCloseAll();
          }
        }}
        sx={{
          width: '100%',
          px: isDesktop ? 0 : { xs: 2.25, md: 4 },
          py: isDesktop ? 0 : 1.25,
          maxHeight: isDesktop ? 'none' : '45vh',
          overflowY: isDesktop ? 'visible' : 'auto'}}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: '26px',
            bgcolor: '#161412',
            border: `1px solid ${alpha(appAccent, 0.22)}`,
            overflow: 'hidden'}}
        >
          <Box sx={{ p: 1.25 }}>
        {/* For Mobile Search Input */}
        {!isDesktop && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                  <Logo app={activeApp} size={14} variant="icon" />
                </Box>
                <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1rem' }}>
                  Search Ecosystem
                </Typography>
              </Box>
              <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
                <CloseIcon size={16} />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                px: 2,
                py: 0.5,
                transition: 'all 0.2s',
                '&:focus-within': {
                  borderColor: '#6366F1',
                  boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
                  bgcolor: 'rgba(0, 0, 0, 0.4)'}
              }}
            >
              <Search size={16} style={{ color: 'rgba(255,255,255,0.35)', marginRight: 8, flexShrink: 0 }} />
              <InputBase
                id="topbar-search-field"
                inputRef={searchInputRef}
                value={searchQuery}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                placeholder="Search ideas, goals, vault, connect..."
                fullWidth
                autoFocus
                sx={{
                  color: 'white',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 }}}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === 'Escape') {
                    handleCloseAll();
                  }
                }}
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>
                  <CloseIcon size={14} />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        <Stack spacing={2.5} sx={{ mt: isDesktop ? 0 : 1.5 }}>
          {searchShortcutsView ? (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                    <Keyboard size={16} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1rem', lineHeight: 1.1 }}>
                      Keyboard shortcuts
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Quick keys
                    </Typography>
                  </Box>
                </Box>
                <Button
                  onClick={() => setSearchShortcutsView(false)}
                  sx={{
                    minWidth: 0,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    color: 'rgba(255,255,255,0.7)',
                    px: 1.5,
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' }}}
                >
                  Back to search
                </Button>
              </Box>
              {renderShortcutsList()}
            </Box>
          ) : !hasQuery ? (
            <>
              {/* Keyboard shortcuts — top so keys are easy to find */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Keyboard shortcuts
                </Typography>
                <Box
                  component="button"
                  onClick={openSearchShortcuts}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2,
                    py: 1.25,
                    borderRadius: '20px',
                    bgcolor: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    color: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.035)',
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                      transform: 'translateX(2px)'}}}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', flexShrink: 0 }}>
                    <Keyboard size={15} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                      View all shortcuts
                    </Typography>
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }}>
                      Quick keys · Ctrl+F to search
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Applications section */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Apps
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                  {[
                    { name: 'note', label: 'Ideas', color: '#EC4899', href: '/app', Icon: FileText },
                    { name: 'goals', label: 'Goals', color: '#A855F7', href: '/goals', Icon: Target },
                    { name: 'vault', label: 'Vault', color: '#10B981', href: '/vault', Icon: Lock },
                    { name: 'connect', label: 'Connect', color: '#F59E0B', href: '/connect', Icon: MessageCircle },
                    { name: 'tags', label: 'Tags', color: '#F87171', action: () => openUnified('tags'), Icon: TagIcon },
                    { name: 'trash', label: 'Trash', color: '#EF4444', action: () => openUnified('trash'), Icon: TrashIcon },
                  ].map((app) => {
                    const AppIcon = app.Icon;
                    return (
                    <ButtonBase
                      key={app.name}
                      onClick={() => {
                        handleCloseAll();
                        if (app.action) {
                          app.action();
                        } else if (app.href) {
                          router.push(app.href);
                        }
                      }}
                      sx={{
                        borderRadius: '20px',
                        bgcolor: 'rgba(255, 255, 255, 0.015)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        p: 1.75,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1.25,
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.035)',
                          borderColor: alpha(app.color, 0.3),
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Box sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${app.color}12`, color: app.color }}>
                        <AppIcon size={16} strokeWidth={1.75} />
                      </Box>
                      <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>
                        {app.label}
                      </Typography>
                    </ButtonBase>
                    );
                  })}
                </Box>
              </Box>

              {/* Quick Actions */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Box
                    component="button"
                    onClick={() => {
                      handleCloseAll();
                      router.push('/flows');
                    }}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 2,
                      py: 1.25,
                      borderRadius: '20px',
                      bgcolor: 'rgba(255,255,255,0.015)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      color: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.035)',
                        borderColor: 'rgba(168, 85, 247, 0.35)',
                        transform: 'translateX(2px)'}}}
                  >
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(168, 85, 247, 0.12)', color: '#A855F7', flexShrink: 0 }}>
                      <GitFork size={15} strokeWidth={1.75} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                        Workflows
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }}>
                        Open flows and automations
                      </Typography>
                    </Box>
                  </Box>

                  {/* Rest of the dynamic quick actions */}
                  {dynamicQuickActions.filter(a => a.id !== 'hist-note' && a.id !== 'hist-flow').map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => {
                        handleCloseAll();
                        router.push(action.href);
                      }}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.25,
                        borderRadius: '20px',
                        bgcolor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        color: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.03)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          transform: 'translateX(2px)'
                        }
                      }}
                    >
                      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}12`, color: action.accent, flexShrink: 0 }}>
                        {action.kind === 'note' ? (
                          <FileText size={15} strokeWidth={1.75} />
                        ) : action.kind === 'vault' ? (
                          <Lock size={15} strokeWidth={1.75} />
                        ) : action.kind === 'connect' ? (
                          <MessageCircle size={15} strokeWidth={1.75} />
                        ) : action.kind === 'flow' ? (
                          <GitFork size={15} strokeWidth={1.75} />
                        ) : (
                          <Sparkles size={15} strokeWidth={1.75} />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                          {action.title}
                        </Typography>
                        <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }}>
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : (
            /* Results View */
            <Box sx={{ display: 'grid', gap: 2 }}>
              {/* Live Feed Moments Results */}
              {feedSearchResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: '#F59E0B', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    Feed Moments · {feedSearchResults.length}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {feedSearchResults.map((moment) => (
                      <Box
                        key={moment.$id || moment.id}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          router.push(`/connect/post/${moment.$id || moment.id}`);
                        }}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 2,
                          py: 1.25,
                          borderRadius: '16px',
                          bgcolor: 'rgba(245, 158, 11, 0.04)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            {moment.userName || moment.user?.name || moment.username || 'Moment'}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.3 }} noWrap>
                            {moment.caption || moment.content || 'Shared an update'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Global LocalEngine Results — miniature cards, desktop uses sidebar grid */}
              {globalResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {Object.entries(groupedGlobalResults).map(([kind, items]) => (
                    <Box key={kind} sx={{ display: 'grid', gap: 0.75 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                        {kind} · {items.length}
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr' }}>
                        {items.slice(0, isDesktop ? 6 : 4).map((r) => (
                          <Box
                            key={`${r.kind}-${r.id}`}
                            component="button"
                            onClick={() => {
                              handleCloseAll();
                              if (r.kind === 'note' && r.raw) {
                                const noteItem = r.raw;
                                setActiveDetail({ type: 'note', id: r.id, data: noteItem });
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const NoteDetailSidebarComp = require('@/components/ui/NoteDetailSidebar').NoteDetailSidebar;
                                if (isWide) {
                                  openSidebar(
                                    <NoteDetailSidebarComp note={noteItem} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <NoteDetailSidebarComp note={noteItem} onClose={closeOverlay} />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'goal') {
                                selectTask(r.id);
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const GoalObjectDetailComp = require('@/components/objects/GoalObjectDetail').GoalObjectDetail;
                                if (isWide) {
                                  openSidebar(
                                    <GoalObjectDetailComp taskId={r.id} embedded onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <GoalObjectDetailComp taskId={r.id} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'moment') {
                                const MomentObjectDetailComp = require('@/components/objects/MomentObjectDetail').MomentObjectDetail;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const source = r.raw?.source || (r.id.startsWith('nostr_') ? 'nostr' : 'internal');
                                const cleanId = r.id.replace(/^nostr_/, '');
                                const preview = r.raw ? {
                                  authorName: r.raw.authorName || r.raw.author?.name || r.raw.authorUsername,
                                  authorAvatar: r.raw.authorAvatar || r.raw.author?.avatar,
                                  content: r.raw.content || r.raw.caption,
                                } : undefined;
                                if (isWide) {
                                  openSidebar(
                                    <MomentObjectDetailComp momentId={cleanId} source={source} embedded preview={preview} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <MomentObjectDetailComp momentId={cleanId} source={source} preview={preview} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'chat' || r.kind === 'thread') {
                                const CommObjectDetailComp = require('@/components/objects/CommObjectDetail').CommObjectDetail;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const commKind = r.kind === 'thread' ? 'thread' : 'chat';
                                if (isWide) {
                                  openSidebar(
                                    <CommObjectDetailComp conversationId={r.id} kind={commKind} embedded title={r.title} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <CommObjectDetailComp conversationId={r.id} kind={commKind} title={r.title} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'event') {
                                const EventDetailsComp = require('@/components/events/EventDetails').default;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                if (isWide) {
                                  openSidebar(
                                    <EventDetailsComp eventId={r.id} initialData={r.raw} onClose={closeSidebar} onBack={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <EventDetailsComp eventId={r.id} initialData={r.raw} onClose={closeOverlay} onBack={closeOverlay} />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'tag') {
                                openUnified('tags', { tagId: r.id });
                                return;
                              }
                              if (r.kind === 'trash') {
                                openUnified('trash');
                                return;
                              }
                              navPush(r.href);
                            }}
                            sx={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              px: 1.75,
                              py: 1.15,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: `1px solid ${r.accent}14`,
                              color: 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: `${r.accent}30` },
                            }}
                          >
                            <Box sx={{ width: 28, height: 28, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${r.accent}18`, color: r.accent, flexShrink: 0, fontSize: '0.7rem', fontWeight: 900 }}>
                              {r.kind[0].toUpperCase()}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.15 }}>
                              <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.82rem', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.title}
                              </Typography>
                              <Typography component="span" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: '0.7rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.subtitle || r.kind}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              {globalResults.length === 0 && searchQuery.trim().length >= 2 && !searchingPeople && (
                <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.84rem', px: 0.5, fontWeight: 600 }}>No local matches — try people or check spelling.</Typography>
              )}

              {/* On-Page Results Matches */}
              {onPageResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    On-Page Matches ({onPageResults.length})
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {onPageResults.map((match, idx) => (
                      <Box
                        key={idx}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          highlightElement(match.element);
                        }}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 2,
                          py: 1.25,
                          borderRadius: '20px',
                          bgcolor: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', flexShrink: 0 }}>
                          <Search size={15} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            {match.text}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.38)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', tracking: '0.05em' }}>
                            element: &lt;{match.tag}&gt;
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* People Search Results */}
              {(searchingPeople || peopleResults.length > 0) && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    People
                  </Typography>
                  {searchingPeople ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.8rem', px: 0.5 }}>
                      Searching users...
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {peopleResults.slice(0, 3).map((person) => (
                        <Box
                          key={person.$id || person.id}
                          component="button"
                          onClick={() => {
                            const username = person.username || person.prefs?.username;
                            if (username) {
                              stageProfileView(person, person.avatar || null);
                              handleCloseAll();
                              router.push(`/u/${encodeURIComponent(username.replace(/^@+/, ''))}?transition=profile`);
                            }
                          }}
                          sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            px: 2,
                            py: 1.25,
                            borderRadius: '20px',
                            bgcolor: 'rgba(255,255,255,0.01)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            color: 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                          }}
                        >
                          <IdentityAvatar
                            userId={person.userId || person.$id}
                            size={36}
                            fallback={(person.displayName || person.name || String(person.username || 'U').replace(/^@+/, '') || 'U')[0].toUpperCase()}
                            borderRadius="10px"
                          />
                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                              {person.displayName || person.name}
                            </Typography>
                            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                              @{String(person.username || person.prefs?.username || 'user').replace(/^@+/, '')}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* Fallback Search Targets */}
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Ecosystem Search
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
                  {searchSurface.searchTargets.slice(0, 4).map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => {
                        handleCloseAll();
                        router.push(action.href);
                      }}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.25,
                        borderRadius: '20px',
                        bgcolor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        color: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                      }}
                    >
                      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}12`, color: action.accent, flexShrink: 0 }}>
                        <Logo app={action.kind as any} size={15} variant="icon" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                          {action.title}
                        </Typography>
                        <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Stack>
          </Box>
        </Paper>
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={searchOpen}
            sidebarKey="topbar-search"
            width={560}
            title="Search"
          >
            <Box sx={{ p: 2.75, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#161412' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
                <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
                  Search System
                </Typography>
                <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }, width: 32, height: 32 }}>
                  <CloseIcon size={16} />
                </IconButton>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  px: 2,
                  py: 1.25,
                  mb: 3,
                }}
              >
                <Search size={18} style={{ color: 'rgba(255,255,255,0.35)', marginRight: 10, flexShrink: 0 }} />
                <InputBase
                  inputRef={searchInputRef}
                  value={searchQuery}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                  placeholder="Search globally..."
                  fullWidth
                  autoFocus
                  sx={{
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 }}}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Escape') handleCloseAll();
                  }}
                />
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{searchContent}</Box>
            </Box>
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="right"
          open={searchOpen}
          onClose={handleCloseAll}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 420,
              height: '100vh',
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              p: 2.75,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'}
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              Search System
            </Typography>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
          
          {/* Search Input for Desktop */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              px: 2,
              py: 1.25,
              mb: 3,
              transition: 'all 0.2s',
              '&:focus-within': {
                borderColor: '#6366F1',
                boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
                bgcolor: 'rgba(0, 0, 0, 0.4)'}
            }}
          >
            <Search size={18} style={{ color: 'rgba(255,255,255,0.35)', marginRight: 10, flexShrink: 0 }} />
            <InputBase
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
              placeholder="Search globally..."
              fullWidth
              autoFocus
              sx={{
                color: 'white',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 600,
                fontSize: '0.92rem',
                '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 }}}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Escape') {
                  handleCloseAll();
                } else if (event.key === 'Enter' && searchQuery.trim()) {
                  const query = searchQuery.trim();
                  // In feed search mode or in connect routes: apply filter directly to live feed and close search drawer instantly
                  if (typeof window !== 'undefined') {
                    const words = query.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [];
                    if (words.length) {
                      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) => {
                        recordFeedInteraction({ topics: words, searchWeight: 3 });
                      });
                    }
                    window.dispatchEvent(new CustomEvent('kylrix:feed-search-submit', { detail: { query } }));
                  }
                  handleCloseAll();
                }
              }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>
                <CloseIcon size={14} />
              </IconButton>
            )}
          </Box>
          
          <Box sx={{ flex: 1, overflowY: 'auto', mx: -2.75, px: 2.75 }}>
            {searchContent}
          </Box>
        </Drawer>
      );
    }

    return (
      <Box
        data-kylrix-topbar-panel
        data-note-search-surface="true"
        sx={{
          width: '100%',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 28px 28px',
          bgcolor: '#161412',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)'}}
      >
        {searchContent}
      </Box>
    );
  };

  const renderProfilePanel = () => {
    if (!profileMenuAnchorEl || !user) return null;

    const profileContent = (
      <Box
        sx={{ px: { xs: 2.25, md: 4 }, py: 1.25, maxHeight: isDesktop ? 'none' : '45vh', overflowY: isDesktop ? 'visible' : 'auto' }}
      >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              borderRadius: '26px',
              bgcolor: '#161412',
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              overflow: 'hidden'}}
          >
            <Box sx={{ p: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '12px', display: 'grid', placeItems: 'center', color: appAccent, bgcolor: alpha(appAccent, 0.06), border: `1px solid ${alpha(appAccent, 0.18)}` }}>
                    <Logo app={activeApp} size={16} variant="icon" />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.86rem', lineHeight: 1.2 }}>
                      {profileName}
                    </Typography>
                    <Typography component="span" variant="caption" sx={{ color: alpha('#fff', 0.45), fontWeight: 700, lineHeight: 1.3 }}>
                      Profile
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={handleCloseAll} size="small" sx={{ width: 30, height: 30, borderRadius: '999px', color: alpha('#fff', 0.8), bgcolor: alpha('#fff', 0.05), border: '1px solid rgba(255,255,255,0.06)' }}>
                  ✕
                </IconButton>
               </Box>
              <Box sx={{ display: 'grid', gap: 1.25, maxHeight: isDesktop ? 'none' : '58vh', overflowY: isDesktop ? 'visible' : 'auto', pr: 0.5, pb: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: 0.75 }}>
                  <IdentityAvatar
                    userId={user?.$id}
                    size={88}
                    pro={isPro}
                    fallback={profileName.slice(0, 1).toUpperCase()}
                    sx={{
                       bgcolor: tone.secondary,
                       flexShrink: 0
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.15, minWidth: 0, flex: 1 }} noWrap>
                        {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : profileName}
                      </Typography>
                      <IconButton
                        onClick={handleOpenFullProfile}
                        disabled={!profileSeed.username}
                        size="small"
                        sx={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          color: 'rgba(255, 255, 255, 0.5)',
                          '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' },
                          '&.ob-disabled': { color: 'rgba(255, 255, 255, 0.25)' }
                        }}
                      >
                        <UserIcon size={16} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {!isPro && (
                        <Button
                          onClick={() => {
                            handleCloseAll();
                            openProUpgrade();
                          }}
                          sx={{
                            borderRadius: '10px',
                            bgcolor: '#6366F1',
                            color: 'white',
                            fontWeight: 900,
                            fontSize: '0.68rem',
                            py: 0.5,
                            px: 1.5,
                            textTransform: 'uppercase',
                            flexShrink: 0,
                            '&:hover': { bgcolor: '#5254E8' }
                          }}
                        >
                          Upgrade
                        </Button>
                      )}
                      {profileUsername && (
                        <IconButton
                          onClick={handleCopyUsername}
                          size="small"
                          title={copyState === 'copied-username' ? 'Copied!' : 'Copy username'}
                          sx={{
                            flexShrink: 0,
                            width: 26,
                            height: 26,
                            color: copyState === 'copied-username' ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }
                          }}
                        >
                          <CopyIcon size={12} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </Box>

                <div className="rounded-[20px] border border-white/[0.04] bg-white/[0.01] p-4">
                  <span className="block text-white/45 text-[11px] font-extrabold uppercase tracking-wider mb-2 leading-none font-satoshi">
                    userid
                  </span>
                  
                  {/* UserId section with copy button */}
                  <div className="flex gap-2 items-center">
                    <span className="text-white/85 font-mono text-xs font-semibold min-w-0 flex-1 break-all select-all leading-normal">
                      {shortenUserId(profileSeed.userId) || 'No ID'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      title={copyState === 'copied-userid' ? 'Copied!' : 'Copy user ID'}
                      className={`flex-shrink-0 w-6.5 h-6.5 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        copyState === 'copied-userid' ? 'text-[#10B981] bg-[#10B981]/10' : 'text-white/35 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <CopyIcon size={12} />
                    </button>
                  </div>
                </div>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    onClick={() => {
                      handleCloseAll();
                        openWallet();
                    }}
                    sx={{
                      minWidth: 0,
                      flex: '1 1 120px',
                      borderRadius: '14px',
                      bgcolor: alpha(appAccent, 0.06),
                      color: appAccent,
                      px: 1.25,
                      py: 1,
                      fontSize: '0.84rem',
                      textTransform: 'none',
                      '&:hover': { bgcolor: alpha(appAccent, 0.12) }}}
                    startIcon={<Wallet size={14} />}
                  >
                    Wallet
                  </Button>
                  {/* Account switching disabled */}
                  <Button
                    onClick={() => {
                      handleCloseAll();
                      router.push('/settings');
                    }}
                    sx={{
                      minWidth: 0,
                      flex: '1 1 120px',
                      borderRadius: '14px',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      color: 'white',
                      px: 1.25,
                      py: 1,
                      fontSize: '0.84rem',
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }}}
                  >
                    Settings
                  </Button>
                  <Button
                    onClick={() => {
                      handleCloseAll();
                      void logout();
                    }}
                    sx={{
                      minWidth: 0,
                      flex: '1 1 120px',
                      borderRadius: '14px',
                      bgcolor: 'rgba(255, 77, 77, 0.06)',
                      color: '#FF4D4D',
                      px: 1.25,
                      py: 1,
                      fontSize: '0.84rem',
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.12)' }}}
                  >
                    Sign out
                  </Button>
                </Stack>

             </Box>
          </Box>
        </Paper>
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={Boolean(profileMenuAnchorEl)}
            sidebarKey="topbar-profile"
            width={380}
            title="Profile"
          >
            {profileContent}
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="left"
          open={Boolean(profileMenuAnchorEl)}
          onClose={() => setProfileMenuAnchorEl(null)}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 320,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'}
          }}
        >
          {profileContent}
        </Drawer>
      );
    }

    return (
      <Box
        data-kylrix-topbar-panel
        sx={{
          width: '100%',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 28px 28px',
          bgcolor: '#161412',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)'}}
      >
        {profileContent}
      </Box>
    );
  };

  const renderAppPanel = () => {
    if (!appMenuAnchorEl) return null;

    const workspaceSwitcher = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, color: '#9B9691', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Workspaces
          </Typography>
          <Button
            size="small"
            onClick={() => {
              handleCloseAll();
              openUnified('new-project');
            }}
            sx={{ color: '#6366F1', fontWeight: 800, fontSize: '0.75rem', textTransform: 'none', minWidth: 0, px: 1, py: 0.25, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.1)', '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' } }}
          >
            + New
          </Button>
        </Box>

        {loadingWorkspaces && workspaces.length <= 1 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', px: 0.5 }}>
            Loading workspaces…
          </Typography>
        ) : null}

        {/* 1. Personal & Owned Workspaces */}
        {[
          ...workspaces.filter((w) => w.isPersonal),
          ...ownedWorkspaces,
        ].map((w) => {
          const isActive = activeWorkspace?.id === w.id;
          return (
            <Box
              key={w.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveWorkspaceId(w.id);
                handleCloseAll();
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveWorkspaceId(w.id);
                  handleCloseAll();
                }
              }}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.25,
                borderRadius: '14px',
                bgcolor: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid',
                borderColor: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255,255,255,0.04)',
                },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#6366F1' : '#fff' }} noWrap>
                  {w.title}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                  {w.isPersonal ? 'Default workspace' : 'Workspace'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {!w.isPersonal && (
                  <IconButton
                    size="small"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleCloseAll();
                      markWorkspacePublic(w.id);
                      void executeInstantShare('project', w.id, {
                        resourceTitle: w.title,
                        isPublic: true,
                        isGuest: true,
                      });
                      openUnified('share-context', {
                        resourceType: 'project',
                        resourceId: w.id,
                        resourceTitle: w.title,
                  <>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        markWorkspacePublic(w.id);
                        void executeInstantShare('project', w.id, {
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                        });
                        openUnified('share-context', {
                          resourceType: 'project',
                          resourceId: w.id,
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                          accentColor: '#10B981',
                        });
                      }}
                      sx={{
                        color: w.isPublic ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                        bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: w.isPublic ? '#10B981' : '#6366F1',
                          bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.15)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title={w.isPublic ? 'Public sharing enabled (click to manage)' : 'Share workspace'}
                    >
                      <ShareIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        openUnified('project-settings', { project: w });
                      }}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.35)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#FFFFFF',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="Workspace settings"
                    >
                      <MoreIcon size={14} />
                    </IconButton>
                  </>
                )}
                {isActive ? (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1', flexShrink: 0 }} />
                ) : null}
              </Box>
            </Box>
          );
        })}

        {/* 2. Shared Workspaces Section */}
        {sharedWorkspaces.length > 0 && (
          <>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', px: 1, pt: 1 }}>
              Shared Workspaces
            </Typography>
            {sharedWorkspaces.map((w) => {
              const isActive = activeWorkspace?.id === w.id;
              return (
                <Box
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveWorkspaceId(w.id);
                    handleCloseAll();
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveWorkspaceId(w.id);
                      handleCloseAll();
                    }
                  }}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.25,
                    borderRadius: '14px',
                    bgcolor: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.15)',
                    color: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: isActive ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255,255,255,0.04)',
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#6366F1' : '#fff' }} noWrap>
                      {w.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(99, 102, 241, 0.8)' }}>
                      {w.role ? `Shared (${w.role})` : 'Shared with you'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        markWorkspacePublic(w.id);
                        void executeInstantShare('project', w.id, {
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                        });
                        openUnified('share-context', {
                          resourceType: 'project',
                          resourceId: w.id,
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                          accentColor: '#10B981',
                        });
                      }}
                      sx={{
                        color: '#10B981',
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#10B981',
                          bgcolor: 'rgba(16, 185, 129, 0.22)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="Share workspace link"
                    >
                      <ShareIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        openUnified('share-context', {
                          resourceType: 'project',
                          resourceId: w.id,
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                          accentColor: '#10B981',
                        });
                      }}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.35)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#FFFFFF',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="More options"
                    >
                      <MoreIcon size={14} />
                    </IconButton>
                    {isActive ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1', flexShrink: 0 }} />
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Box>
    );

    const githubCta = (
      <a
        href="https://github.com/Kylrix/kylrix"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleCloseAll()}
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all font-satoshi text-xs font-bold text-white/90"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span>View Source on GitHub</span>
        </div>
        <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-white/80">Code</span>
      </a>
    );

    const discordCta = !user?.prefs?.discordJoined ? (
      <a
        href="https://discord.gg/YjF5yCBCmx"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          handleCloseAll();
          if (typeof updatePreferences === 'function') {
            void updatePreferences({ discordJoined: true }).catch(() => {});
          }
        }}
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 hover:bg-[#5865F2]/10 transition-all font-satoshi text-xs font-bold text-[#5865F2]"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36c2.65-3.6,5-7.46,7-11.5a68.88,68.88,0,0,1-11-5.26c.92-.68,1.82-1.39,2.69-2.13A75.14,75.14,0,0,0,96.5,77.47c.87.74,1.77,1.45,2.69,2.13a68.88,68.88,0,0,1-11,5.26c2,4,4.35,7.9,7,11.5a105.73,105.73,0,0,0,31-18.83C129,54.65,122.68,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.9,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96.14,53,91,65.69,84.69,65.69Z"/>
          </svg>
          <span>Join our Discord Community</span>
        </div>
        <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-[#5865F2]/10 border border-[#5865F2]/25">Join</span>
      </a>
    ) : null;

    const ecosystemBody = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {githubCta}
        {discordCta}
        {workspaceSwitcher}
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={Boolean(appMenuAnchorEl)}
            sidebarKey="topbar-ecosystem"
            width={380}
            title="Ecosystem"
          >
            <Box sx={{ p: 2 }}>
              {ecosystemBody}
            </Box>
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="left"
          open={Boolean(appMenuAnchorEl)}
          onClose={() => setAppMenuAnchorEl(null)}
          keepMounted={false}
          disablePortal={true}
          slotProps={{
            backdrop: {
              sx: {
                top: `88px`,
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                bgcolor: 'rgba(0,0,0,0.4)'
              }
            }
          }}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 340,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              p: 2.75,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'}
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.75 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              Ecosystem
            </Typography>
            <IconButton onClick={() => setAppMenuAnchorEl(null)} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              borderRadius: '26px',
              bgcolor: '#161412',
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              overflow: 'hidden',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 1.25, overflowY: 'auto', flex: 1 }}>
              {ecosystemBody}
            </Box>
          </Paper>
        </Drawer>
      );
    }

    return (
      <motion.div
        key="app-panel"
        initial={appPanelMotion.initial}
        animate={appPanelMotion.animate}
        exit={appPanelMotion.exit}
        transition={appPanelMotion.transition}
        style={{ width: '100%', transformOrigin: 'top center' }}
      >
        <Box
          data-kylrix-topbar-panel
          sx={{
            width: '100%',
            bgcolor: '#161412',
            overflow: 'hidden',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0 0 28px 28px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)'}}
        >
          <Box
            onWheel={(event: React.WheelEvent) => {
              const node = event.currentTarget;
              if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
                event.preventDefault();
                handleCloseAll();
              }
            }}
            sx={{ px: { xs: 2.25, md: 4 }, py: 1.25, maxHeight: '45vh', overflowY: 'auto' }}
          >
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                borderRadius: '26px',
                bgcolor: '#161412',
                border: `1px solid ${alpha(appAccent, 0.22)}`,
                overflow: 'hidden'}}
            >
              <Box sx={{ p: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: 'white', fontSize: '1rem' }}>
                    Ecosystem
                  </Typography>
                  <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
                    <CloseIcon size={16} />
                  </IconButton>
                </Box>
                {ecosystemBody}
              </Box>
            </Paper>
          </Box>
        </Box>
      </motion.div>
    );
  };

  return (
    <>
      <AppBar
        ref={headerRef}
        className={`${className} kylrix-topbar`}
        position="fixed"
        elevation={0}
        sx={{
          zIndex: 1201,
          bgcolor: '#161412',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 16px 42px rgba(0,0,0,0.42)',
          backgroundImage: 'none',
          overflow: 'visible',
          pointerEvents: 'auto',
          height: isDesktop ? '88px' : (activePanel ? 'auto' : '88px')}}
      >
        <SyncIndicator />
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 }, width: '100%', height: '88px', display: activePanel ? 'none' : 'flex', alignItems: 'center' }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: 'auto 1fr auto', md: '1fr auto 1fr' }, 
            alignItems: 'center', 
            width: '100%', 
            gap: 2 
          }}>
            
            {/* Left: App Logo / Menu Trigger */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', pointerEvents: 'auto' }}>
              <Box 
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  if (!user) {
                    openUnified('login');
                    return;
                  }
                  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    setIsCollapsed((prev: boolean) => !prev);
                  } else {
                    openAppMenu(e);
                  }
                }} 
                sx={{ cursor: 'pointer', flexShrink: 0, pointerEvents: 'auto' }}
              >
                <Logo app={activeApp} size={32} variant="full" />
              </Box>
            </Box>

            {/* Center: Search — compact, not obstructing; Bell is separate */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {user ? (
                <AnimatePresence mode="wait">
                  {searchOpen ? (
                    <motion.div 
                      key="search-active"
                      initial={{ width: 44, opacity: 0 }} 
                      animate={{ width: isDesktop ? 520 : 'calc(100vw - 120px)', opacity: 1 }} 
                      exit={{ width: 44, opacity: 0 }} 
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                      style={{ position: 'relative', maxWidth: '100%', zIndex: 10 }}
                    >
                      <Paper elevation={0} sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, border: '1px solid rgba(99, 102, 241, 0.25)', bgcolor: '#161412', color: 'white', borderRadius: '24px', boxShadow: '0 0 26px rgba(99, 102, 241, 0.08), 0 0 0 4px rgba(99, 102, 241, 0.12)', overflow: 'hidden' }}>
                        <Search size={16} strokeWidth={2.5} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <InputBase 
                            id="topbar-search-input"
                            inputRef={searchInputRef} 
                            value={searchQuery} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} 
                            placeholder="Search ecosystem..." 
                            sx={{ flex: 1, color: 'white', fontWeight: 800, fontSize: '0.9rem', '& input::placeholder': { color: 'white/20' } }} 
                        />
                        
                        <Tooltip title="Keyboard shortcuts">
                          <IconButton
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openSearchShortcuts();
                            }}
                            sx={{
                              color: searchShortcutsView ? '#6366F1' : 'white/35',
                              p: 1,
                              bgcolor: searchShortcutsView ? 'white/5' : 'transparent',
                              '&:hover': { bgcolor: 'white/8', color: 'white' }}}
                          >
                            <Keyboard size={17} strokeWidth={2.25} />
                          </IconButton>
                        </Tooltip>

                        <Box sx={{ width: 1, height: 20, bgcolor: 'white/10', mx: 0.5 }} />
                        
                        <IconButton size="small" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} sx={{ color: 'white/40' }}><CloseIcon size={16} /></IconButton>
                      </Paper>
                    </motion.div>
                  ) : isMounted ? (
                    <motion.div 
                      key="island-rest"
                      initial={{ scale: 0.8, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }} 
                      whileHover={{ scale: 1.02 }} 
                      onClick={openSearch} 
                      style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                    >
                      <Box sx={{ 
                        width: { xs: 44, md: 160 }, 
                        height: 44, 
                        borderRadius: '999px', 
                        bgcolor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 1, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        <Box sx={{ display: 'grid', placeItems: 'center' }}>
                          <Search size={18} strokeWidth={2.5} />
                        </Box>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                      </Box>
                    </motion.div>
                  ) : (
                    <div 
                      onClick={openSearch} 
                      style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                    >
                      <Box sx={{ 
                        width: { xs: 44, md: 160 }, 
                        height: 44, 
                        borderRadius: '999px', 
                        bgcolor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 1, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        <Box sx={{ display: 'grid', placeItems: 'center' }}>
                          <Search size={18} strokeWidth={2.5} />
                        </Box>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                      </Box>
                    </div>
                  )}
                </AnimatePresence>
              ) : <Box sx={{ height: 44 }} />}
              {user && (
                <IconButton
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    toggleNotifications();
                  }}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '999px',
                    bgcolor: notificationsOpen ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: notificationsOpen ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)',
                    color: (unreadNotifCount > 0 || suggestions.length > 0) ? '#6366F1' : 'rgba(255,255,255,0.6)',
                    position: 'relative',
                    flexShrink: 0,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }
                  }}
                >
                  <Bell size={18} strokeWidth={2.2} />
                  {(unreadNotifCount > 0 || suggestions.length > 0 || notifHint) && (
                    <Box sx={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', bgcolor: '#EC4899', border: '1.5px solid #000' }} />
                  )}
                </IconButton>
              )}
            </Box>

            {/* Right: Smart Systems & Profile */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
                {user ? (
                  <>
                    <IconButton onClick={openAgenticFromTopbar} sx={{ color: appAccent, bgcolor: '#0B0A09', border: '1px solid', borderColor: alpha(appAccent, 0.35), borderRadius: '14px', width: 44, height: 44, boxShadow: `0 8px 24px ${alpha(appAccent, 0.25)}`, '&:hover': { bgcolor: '#1C1A18', transform: 'scale(1.05)' }, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <Bot size={20} strokeWidth={2.2} />
                    </IconButton>
                    <ButtonBase onClick={openProfileMenu} sx={{ borderRadius: '50%', transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}>
                      <IdentityAvatar 
                        userId={user?.$id}
                        size={38} 
                        pro={isPro} 
                        fallback={profileName[0]} 
                      />
                    </ButtonBase>
                  </>
                ) : (
                  <Button onClick={() => openUnified('login')} sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 900, borderRadius: '12px', px: 2.5, py: 1, '&:hover': { bgcolor: '#5254E8' } }}>{isAuthenticating ? <CircularProgress size={16} color="inherit" /> : 'Sync'}</Button>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>

      </AppBar>
      {renderSearchPanel()}
      {renderNotificationDrawer()}
      {renderAppPanel()}
      {renderProfilePanel()}
    </>
  );
}

