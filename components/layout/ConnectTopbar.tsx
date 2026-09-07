/* eslint-disable react-hooks/rules-of-hooks */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
  Terminal,
  Wallet,
  Copy as CopyIcon,
  Search,
  X as CloseIcon,
  Bell,
  Sparkles,
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
  ChevronDown,
  Check,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { useAuth } from '@/context/auth/AuthContext';
import { getUserProfilePicId, getEffectiveUsername, hasEffectivePaidAccess } from '@/lib/utils';
import { getCachedIdentityById } from '@/lib/identity-cache';
import { toast } from 'react-hot-toast';
import { APP_BASE_PATHS } from '@/lib/constants';
import { type KylrixApp } from '@/sdk/design';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { createTopbarPanelMotion, createTopbarSearchSurface, isTopbarScrollAtTop } from '@/sdk/topbar';
import { createProfilePreviewManager, getUserProfilePicId as getSdkUserProfilePicId } from '@/sdk/appwrite';
import { stageProfileView } from '@/lib/profile-handoff';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useWebMcpContext } from '@/context/WebMcpContext';
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
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';
import { useSection } from '@/context/SectionContext';
import { executeInstantShare } from '@/lib/share/instant-share';

import {
  renderShortcutsList,
  searchOnPage,
  highlightElement,
  type PageMatch,
} from './connect-topbar-utils';
import { SyncIndicator } from './SyncIndicator';
import { NotificationDrawer } from './NotificationDrawer';
import { renderSearchPanel as renderSearchPanel_ext } from './ConnectTopbarSections/renderSearchPanel';
import { renderAppPanel as renderAppPanel_ext } from './ConnectTopbarSections/renderAppPanel';
import { renderProfilePanel as renderProfilePanel_ext } from './ConnectTopbarSections/renderProfilePanel';
import { handleGlobalShortcuts as handleGlobalShortcuts_ext } from './ConnectTopbarSections/handleGlobalShortcuts';
import { triggerBuiltInAction as triggerBuiltInAction_ext } from './ConnectTopbarSections/triggerBuiltInAction';





interface ConnectTopbarProps {
  className?: string;
}

export default function ConnectTopbar({
  className}: ConnectTopbarProps) {
  const { user, logout, isAuthenticating, updatePreferences } = useAuth();
  const { openWallet } = useWalletOverlay();
  const { openAgenticDrawer, closeAgenticDrawer } = useAgenticDrawer();
  const { toggleInspector: toggleWebMcp, isInspectorOpen: isWebMcpOpen } = useWebMcpContext();
  const { open: openUnified } = useUnifiedDrawer();
  const nativeSidebar = useNativeSidebarApiOptional();
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPro = hasEffectivePaidAccess(user, currentTier);
  const router = useRouter();
  const navPush = useCallback((href: string) => router.push(href), [router]);
  const pathname = usePathname();
  const { setIsCollapsed } = useSidebar();
  const { activeWorkspace, workspaces, ownedWorkspaces, sharedWorkspaces, agentWorkspaces, setActiveWorkspaceId, markWorkspacePublic, loadingWorkspaces } = useWorkspace();
  const [agentWorkspacesExpanded, setAgentWorkspacesExpanded] = useState(false);
  const { notes = [] } = useNotes();
  const { tasks = [], projects = [], selectTask } = useTask();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setActiveDetail } = useSection();
  // To let any drawer communicate full state expansion globally:
  const isDrawerExpanded = typeof window !== 'undefined' && document.body.classList.contains('drawer-expanded');
  
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
  const [showWebMcpTopbar, setShowWebMcpTopbar] = useState(false);

  useEffect(() => {
    // 1. Initial check from LocalEngine (offline-first)
    import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
      LocalEngine.cacheGet<boolean>('setting_show_webmcp_topbar').then((val) => {
        if (typeof val === 'boolean') {
          setShowWebMcpTopbar(val);
        }
      }).catch(() => {});
    });

    // 2. Event listener for live updates
    const handleTopbarChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') {
        setShowWebMcpTopbar(detail);
      }
    };
    window.addEventListener('kylrix:webmcp-topbar-changed', handleTopbarChange);
    return () => {
      window.removeEventListener('kylrix:webmcp-topbar-changed', handleTopbarChange);
    };
  }, []);

  const [copyState, setCopyState] = useState<'idle' | 'copied-userid' | 'copied-username' | 'copied-referral'>('idle');
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
  const [localMoments, setLocalMoments] = useState<any[]>([]);
  const [localVaultCreds, setLocalVaultCreds] = useState<any[]>([]);
  const [localVaultTotp, setLocalVaultTotp] = useState<any[]>([]);

  useEffect(() => {
    if (!searchOpen) return;
    const uid = user?.$id || 'guest';
    import('@/lib/data').then(({ readLocalTagRows }) => {
      readLocalTagRows(uid === 'guest' ? null : uid)
        .then((tagsData) => {
          if (tagsData.length) setLocalTags(tagsData);
        })
        .catch(() => {});
      Promise.all([
        import('@/lib/services/LocalEngine').then(({ LocalEngine }) =>
          LocalEngine.cacheGet<any[]>(`trash_all_${uid}`).catch(() => []),
        ),
        import('@/lib/services/LocalEngine').then(({ LocalEngine }) =>
          LocalEngine.cacheGet<any[]>(`f_forms_${uid}`).catch(() => []),
        ),
        import('@/lib/services/LocalEngine').then(({ LocalEngine }) =>
          LocalEngine.cacheGet<any[]>('f_unified_moments_feed').then(r => r || LocalEngine.cacheGet<any[]>('f_moments_list')).catch(() => []),
        ),
        import('@/lib/services/LocalEngine').then(({ LocalEngine }) =>
          LocalEngine.cacheGet<any[]>('f_vault_creds').catch(() => []),
        ),
        import('@/lib/services/LocalEngine').then(({ LocalEngine }) =>
          LocalEngine.cacheGet<any[]>('f_vault_totp').catch(() => []),
        ),
      ]).then(([trashData, formsData, momentsData, credsData, totpData]) => {
        if (Array.isArray(trashData) && trashData.length) setLocalTrash(trashData);
        if (Array.isArray(formsData) && formsData.length) setLocalForms(formsData);
        if (Array.isArray(momentsData) && momentsData.length) setLocalMoments(momentsData);
        if (Array.isArray(credsData) && credsData.length) setLocalVaultCreds(credsData);
        if (Array.isArray(totpData) && totpData.length) setLocalVaultTotp(totpData);
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
      vaultCreds: localVaultCreds,
      vaultTotp: localVaultTotp,
      moments: localMoments,
      chats: [],
      threads: [],
      tags: localTags,
      trash: localTrash,
    });
  }, [searchQuery, notes, tasks, projects, localEvents, localForms, localVaultCreds, localVaultTotp, localMoments, localTags, localTrash]);
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

  const { suggestions } = useLocalContext();

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

  const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);
  const appAccent = getAppColor(activeApp);
  const { profile: myProfile } = useProfile();
  const cachedIdentity = (user as any)?.$id ? getCachedIdentityById((user as any).$id) : null;
  const rawUsername =
    myProfile?.username ||
    (user as any)?.prefs?.username ||
    (user as any)?.prefs?.user_name ||
    (user as any)?.username ||
    (user as any)?.profile?.username ||
    cachedIdentity?.username ||
    getEffectiveUsername(user) ||
    null;

  const profileUsername = rawUsername ? String(rawUsername).replace(/^@+/, '').trim() : null;
  const profileDisplayName =
    myProfile?.displayName ||
    user?.name ||
    (user as any)?.prefs?.name ||
    cachedIdentity?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'User');
  const profileName = profileDisplayName;
  
  const [_isClient, setIsClient] = useState(true);
  useEffect(() => setIsClient(true), []);

  const profileSeed = useMemo(
    () => ({
      username: profileUsername ? String(profileUsername).replace(/^@+/, '').toLowerCase() : null,
      displayName: profileDisplayName,
      avatar: profileAvatarUrl || profilePicId || null,
      userId: (user as any)?.$id || null}),
    [profileAvatarUrl, profileDisplayName, profilePicId, profileUsername, user]);

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

  const openProfileMenu = useCallback((_event?: MouseEvent<HTMLElement>) => {
    handleCloseAll();
    const effectiveUsername = user?.prefs?.username || user?.name || 'user';
    openUnified('profile-preview', {
      userId: user?.$id,
      username: effectiveUsername,
      name: user?.name,
      avatar: profileAvatarUrl,
    });
  }, [user, profileAvatarUrl, openUnified, handleCloseAll]);


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

  const [isGeneratingUsername, setIsGeneratingUsername] = useState(false);

  const handleGenerateUsername = useCallback(async () => {
    if (isGeneratingUsername) return;
    setIsGeneratingUsername(true);
    try {
      const { generateUsernameOnTheFlyAction } = await import('@/lib/actions/referrals');
      const res = await generateUsernameOnTheFlyAction(profileName);
      if (res.ok && res.username) {
        if (updatePreferences) {
          await updatePreferences({ username: res.username }).catch(() => null);
        }
      }
    } catch {} finally {
      setIsGeneratingUsername(false);
    }
  }, [isGeneratingUsername, profileName, updatePreferences]);

  const handleCopyUsername = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const textToCopy = profileUsername ? `@${profileUsername}` : profileDisplayName || profileSeed.userId || '';
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopyState('copied-username');
    toast.success(`Copied ${textToCopy}`);
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [profileUsername, profileDisplayName, profileSeed.userId]);

  const handleCopyReferralLink = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const base = window.location.origin;
    const refCode = profileUsername
      ? `u_${String(profileUsername).replace(/^@+/, '')}`
      : `id_${profileSeed.userId || ''}`;
    const refLink = `${base}/?ref=${refCode}`;
    await navigator.clipboard.writeText(refLink);
    setCopyState('copied-referral');
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [profileUsername, profileSeed.userId]);

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
    const handleGlobalShortcuts = (..._args: any[]) => handleGlobalShortcuts_ext({ _isClient, _searchMode, _setDismissedHintId, activeApp, activePanel, agentWorkspacesExpanded, appAccent, appMenuAnchorEl, appPanelMotion, cachedIdentity, copyState, dismissedHintId, dynamicQuickActions, feedSearchResults, globalResults, groupedGlobalResults, handleCloseAll, handleCopyReferralLink, handleCopyUsername, handleGenerateUsername, handleGlobalShortcuts, headerRef, isDesktop, isDrawerExpanded, isGeneratingUsername, isMounted, isPro, localForms, localMoments, localTags, localTrash, localVaultCreds, localVaultTotp, nativeSidebar, navPush, notifHint, notificationsOpen, onPageResults, openAgenticFromTopbar, openAppMenu, openProfileMenu, openSearch, openSearchShortcuts, pathname, peopleResults, previewManager, profileAvatarUrl, profileDisplayName, profileMenuAnchorEl, profileName, profilePicId, profileSeed, profileUsername, rawUsername, renderAppPanel, renderNotificationDrawer, renderProfilePanel, renderSearchPanel, router, searchInputRef, searchOpen, searchQuery, searchShortcutsView, searchSurface, searchingPeople, setAgentWorkspacesExpanded, setAppMenuAnchorEl, setCopyState, setFeedSearchResults, setIsClient, setIsGeneratingUsername, setIsMounted, setLocalForms, setLocalMoments, setLocalTags, setLocalTrash, setLocalVaultCreds, setLocalVaultTotp, setNotifHint, setNotificationsOpen, setOnPageResults, setPeopleResults, setProfileAvatarUrl, setProfileMenuAnchorEl, setSearchMode, setSearchOpen, setSearchQuery, setSearchShortcutsView, setSearchingPeople, setShowWebMcpTopbar, showWebMcpTopbar, theme, toggleNotifications });

    const triggerBuiltInAction = (..._args: any[]) => triggerBuiltInAction_ext({ _isClient, _searchMode, _setDismissedHintId, activeApp, activePanel, agentWorkspacesExpanded, appAccent, appMenuAnchorEl, appPanelMotion, cachedIdentity, copyState, dismissedHintId, dynamicQuickActions, feedSearchResults, globalResults, groupedGlobalResults, handleCloseAll, handleCopyReferralLink, handleCopyUsername, handleGenerateUsername, headerRef, isDesktop, isDrawerExpanded, isGeneratingUsername, isMounted, isPro, localForms, localMoments, localTags, localTrash, localVaultCreds, localVaultTotp, nativeSidebar, navPush, notifHint, notificationsOpen, onPageResults, openAgenticFromTopbar, openAppMenu, openProfileMenu, openSearch, openSearchShortcuts, pathname, peopleResults, previewManager, profileAvatarUrl, profileDisplayName, profileMenuAnchorEl, profileName, profilePicId, profileSeed, profileUsername, rawUsername, renderAppPanel, renderNotificationDrawer, renderProfilePanel, renderSearchPanel, router, searchInputRef, searchOpen, searchQuery, searchShortcutsView, searchSurface, searchingPeople, setAgentWorkspacesExpanded, setAppMenuAnchorEl, setCopyState, setFeedSearchResults, setIsClient, setIsGeneratingUsername, setIsMounted, setLocalForms, setLocalMoments, setLocalTags, setLocalTrash, setLocalVaultCreds, setLocalVaultTotp, setNotifHint, setNotificationsOpen, setOnPageResults, setPeopleResults, setProfileAvatarUrl, setProfileMenuAnchorEl, setSearchMode, setSearchOpen, setSearchQuery, setSearchShortcutsView, setSearchingPeople, setShowWebMcpTopbar, showWebMcpTopbar, theme, toggleNotifications, triggerBuiltInAction });


    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [handleCloseAll, openSearch, openAgenticFromTopbar, router]);

  const renderNotificationDrawer = () => {
    return (
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        appAccent={appAccent}
        isDesktop={isDesktop}
        nativeSidebar={!!nativeSidebar}
      />
    );
  };

  const renderSearchPanel = (..._args: any[]) => renderSearchPanel_ext({ _isClient, _searchMode, _setDismissedHintId, activeApp, activePanel, agentWorkspacesExpanded, appAccent, appMenuAnchorEl, appPanelMotion, cachedIdentity, copyState, dismissedHintId, dynamicQuickActions, feedSearchResults, globalResults, groupedGlobalResults, handleCloseAll, handleCopyReferralLink, handleCopyUsername, handleGenerateUsername, handleGlobalShortcuts, headerRef, isDesktop, isDrawerExpanded, isGeneratingUsername, isMounted, isPro, localForms, localMoments, localTags, localTrash, localVaultCreds, localVaultTotp, nativeSidebar, navPush, notifHint, notificationsOpen, onPageResults, openAgenticFromTopbar, openAppMenu, openProfileMenu, openSearch, openSearchShortcuts, pathname, peopleResults, previewManager, profileAvatarUrl, profileDisplayName, profileMenuAnchorEl, profileName, profilePicId, profileSeed, profileUsername, rawUsername, renderAppPanel, renderNotificationDrawer, renderProfilePanel, renderSearchPanel, router, searchInputRef, searchOpen, searchQuery, searchShortcutsView, searchSurface, searchingPeople, setAgentWorkspacesExpanded, setAppMenuAnchorEl, setCopyState, setFeedSearchResults, setIsClient, setIsGeneratingUsername, setIsMounted, setLocalForms, setLocalMoments, setLocalTags, setLocalTrash, setLocalVaultCreds, setLocalVaultTotp, setNotifHint, setNotificationsOpen, setOnPageResults, setPeopleResults, setProfileAvatarUrl, setProfileMenuAnchorEl, setSearchMode, setSearchOpen, setSearchQuery, setSearchShortcutsView, setSearchingPeople, setShowWebMcpTopbar, showWebMcpTopbar, theme, toggleNotifications });

  const renderProfilePanel = (..._args: any[]) => renderProfilePanel_ext({ _isClient, _searchMode, _setDismissedHintId, activeApp, activePanel, agentWorkspacesExpanded, appAccent, appMenuAnchorEl, appPanelMotion, cachedIdentity, copyState, dismissedHintId, dynamicQuickActions, feedSearchResults, globalResults, groupedGlobalResults, handleCloseAll, handleCopyReferralLink, handleCopyUsername, handleGenerateUsername, handleGlobalShortcuts, headerRef, isDesktop, isDrawerExpanded, isGeneratingUsername, isMounted, isPro, localForms, localMoments, localTags, localTrash, localVaultCreds, localVaultTotp, nativeSidebar, navPush, notifHint, notificationsOpen, onPageResults, openAgenticFromTopbar, openAppMenu, openProfileMenu, openSearch, openSearchShortcuts, pathname, peopleResults, previewManager, profileAvatarUrl, profileDisplayName, profileMenuAnchorEl, profileName, profilePicId, profileSeed, profileUsername, rawUsername, renderAppPanel, renderNotificationDrawer, renderProfilePanel, renderSearchPanel, router, searchInputRef, searchOpen, searchQuery, searchShortcutsView, searchSurface, searchingPeople, setAgentWorkspacesExpanded, setAppMenuAnchorEl, setCopyState, setFeedSearchResults, setIsClient, setIsGeneratingUsername, setIsMounted, setLocalForms, setLocalMoments, setLocalTags, setLocalTrash, setLocalVaultCreds, setLocalVaultTotp, setNotifHint, setNotificationsOpen, setOnPageResults, setPeopleResults, setProfileAvatarUrl, setProfileMenuAnchorEl, setSearchMode, setSearchOpen, setSearchQuery, setSearchShortcutsView, setSearchingPeople, setShowWebMcpTopbar, showWebMcpTopbar, theme, toggleNotifications });

  const renderAppPanel = (..._args: any[]) => renderAppPanel_ext({ _isClient, _searchMode, _setDismissedHintId, activeApp, activePanel, agentWorkspacesExpanded, appAccent, appMenuAnchorEl, appPanelMotion, cachedIdentity, copyState, dismissedHintId, dynamicQuickActions, feedSearchResults, globalResults, groupedGlobalResults, handleCloseAll, handleCopyReferralLink, handleCopyUsername, handleGenerateUsername, handleGlobalShortcuts, headerRef, isDesktop, isDrawerExpanded, isGeneratingUsername, isMounted, isPro, localForms, localMoments, localTags, localTrash, localVaultCreds, localVaultTotp, nativeSidebar, navPush, notifHint, notificationsOpen, onPageResults, openAgenticFromTopbar, openAppMenu, openProfileMenu, openSearch, openSearchShortcuts, pathname, peopleResults, previewManager, profileAvatarUrl, profileDisplayName, profileMenuAnchorEl, profileName, profilePicId, profileSeed, profileUsername, rawUsername, renderAppPanel, renderNotificationDrawer, renderProfilePanel, renderSearchPanel, router, searchInputRef, searchOpen, searchQuery, searchShortcutsView, searchSurface, searchingPeople, setAgentWorkspacesExpanded, setAppMenuAnchorEl, setCopyState, setFeedSearchResults, setIsClient, setIsGeneratingUsername, setIsMounted, setLocalForms, setLocalMoments, setLocalTags, setLocalTrash, setLocalVaultCreds, setLocalVaultTotp, setNotifHint, setNotificationsOpen, setOnPageResults, setPeopleResults, setProfileAvatarUrl, setProfileMenuAnchorEl, setSearchMode, setSearchOpen, setSearchQuery, setSearchShortcutsView, setSearchingPeople, setShowWebMcpTopbar, showWebMcpTopbar, theme, toggleNotifications });

  return (
    <>
      <AppBar
        ref={headerRef}
        className={`${className} kylrix-topbar`}
        position="fixed"
        elevation={0}
        sx={{
          display: isDrawerExpanded ? 'none' : 'block',
          zIndex: 1201,
          bgcolor: '#000000',
          borderBottom: '2px solid rgba(255,255,255,0.25)',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 16px 42px rgba(0,0,0,0.5)',
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
                      <Paper elevation={0} sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, border: '1px solid rgba(99, 102, 241, 0.35)', bgcolor: '#161412', color: 'white', borderRadius: '24px', boxShadow: '0 0 26px rgba(99, 102, 241, 0.08), 0 0 0 4px rgba(99, 102, 241, 0.12)', overflow: 'hidden' }}>
                        <Search size={16} strokeWidth={2.5} style={{ opacity: 0.8, flexShrink: 0 }} />
                        <InputBase 
                            id="topbar-search-input"
                            inputRef={searchInputRef} 
                            value={searchQuery} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} 
                            placeholder="Search ecosystem..." 
                            sx={{ flex: 1, color: '#FFFFFF', fontWeight: 800, fontSize: '0.9rem', '& input::placeholder': { color: 'rgba(255,255,255,0.4)' } }} 
                        />
                        
                        <Tooltip title="Keyboard shortcuts">
                          <IconButton
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openSearchShortcuts();
                            }}
                            sx={{
                              color: searchShortcutsView ? '#6366F1' : '#FFFFFF',
                              opacity: searchShortcutsView ? 1 : 0.6,
                              p: 1,
                              bgcolor: searchShortcutsView ? 'rgba(255,255,255,0.08)' : 'transparent',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', opacity: 1 }}}
                          >
                            <Keyboard size={17} strokeWidth={2.25} />
                          </IconButton>
                        </Tooltip>

                        <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.12)', mx: 0.5 }} />
                        
                        <IconButton size="small" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} sx={{ color: '#FFFFFF', opacity: 0.6, '&:hover': { opacity: 1 } }}><CloseIcon size={16} /></IconButton>
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
                        bgcolor: '#161412', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 1, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: '#201D1A',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        <Box sx={{ display: 'grid', placeItems: 'center' }}>
                          <Search size={18} strokeWidth={2.5} />
                        </Box>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 700, fontSize: '0.8rem', color: '#FFFFFF' }}>Search</Typography>
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
                        bgcolor: '#161412', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 1, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: '#201D1A',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        <Box sx={{ display: 'grid', placeItems: 'center' }}>
                          <Search size={18} strokeWidth={2.5} />
                        </Box>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 700, fontSize: '0.8rem', color: '#FFFFFF' }}>Search</Typography>
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
                    bgcolor: notificationsOpen ? 'rgba(99,102,241,0.18)' : '#161412',
                    border: '1px solid',
                    borderColor: notificationsOpen ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.1)',
                    color: (suggestions.length > 0 || notifHint) ? '#6366F1' : '#FFFFFF',
                    position: 'relative',
                    flexShrink: 0,
                    '&:hover': { bgcolor: '#201D1A', borderColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }
                  }}
                >
                  <Bell size={18} strokeWidth={2.2} />
                  {(suggestions.length > 0 || notifHint) && (
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
                    {showWebMcpTopbar && isDesktop && (
                      <Tooltip title="WebMCP Tools (Browser-Native Inspector)">
                        <IconButton
                          onClick={() => {
                            setProfileMenuAnchorEl(null);
                            setAppMenuAnchorEl(null);
                            setSearchOpen(false);
                            setSearchShortcutsView(false);
                            setNotificationsOpen(false);
                            setNotifHint(null);
                            // Single toggle — do not also dispatch kylrix:toggle-webmcp (double-toggles closed).
                            toggleWebMcp();
                          }}
                          sx={{
                            color: isWebMcpOpen ? '#34D399' : '#10B981',
                            bgcolor: isWebMcpOpen ? '#000000' : '#161412',
                            border: '1px solid',
                            borderColor: isWebMcpOpen ? '#10B981' : alpha('#10B981', 0.35),
                            borderRadius: '14px',
                            width: 44,
                            height: 44,
                            boxShadow: `0 8px 24px ${alpha('#10B981', 0.25)}`,
                            '&:hover': { bgcolor: '#201D1A', transform: 'scale(1.05)' },
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        >
                          <Terminal size={19} strokeWidth={2.2} />
                        </IconButton>
                      </Tooltip>
                    )}

                    <IconButton onClick={openAgenticFromTopbar} sx={{ color: appAccent, bgcolor: '#161412', border: '1px solid', borderColor: alpha(appAccent, 0.35), borderRadius: '14px', width: 44, height: 44, boxShadow: `0 8px 24px ${alpha(appAccent, 0.25)}`, '&:hover': { bgcolor: '#201D1A', transform: 'scale(1.05)' }, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
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
      {!isDrawerExpanded && (
        <>
          {renderSearchPanel()}
          {renderNotificationDrawer()}
          {renderAppPanel()}
          {renderProfilePanel()}
        </>
      )}
    </>
  );
}

