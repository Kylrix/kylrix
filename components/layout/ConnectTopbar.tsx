/* eslint-disable react-hooks/rules-of-hooks */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
  alpha,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  IconButton,
  InputAdornment,
  InputBase,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@/lib/openbricks/primitives';
import {
  Bot,
  ChevronDown,
  Wallet,
  Copy as CopyIcon,
  User as UserIcon,
  Search,
  X as CloseIcon,
  Bell,
  Sparkles,
  Activity,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { useAuth } from '@/context/auth/AuthContext';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { getUserProfilePicId, hasEffectivePaidAccess } from '@/lib/utils';
import { getEcosystemUrl, APP_BASE_PATHS } from '@/lib/constants';
import { TOPBAR_LAYOUT, getAppTone, type KylrixApp } from '@/lib/sdk/design';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { createEcosystemPanelItems, createTopbarPanelMotion, createTopbarSearchSurface, isTopbarScrollAtBottom, isTopbarScrollAtTop } from '@/lib/sdk/topbar';
import { createProfilePreviewManager, getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/sdk/appwrite';
import { stageProfileView } from '@/lib/profile-handoff';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
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

interface PageMatch {
  text: string;
  tag: string;
  element: HTMLElement;
}

function searchOnPage(query: string): PageMatch[] {
  if (typeof window === 'undefined' || !query) return [];
  const lowercaseQuery = query.toLowerCase();
  const matches: PageMatch[] = [];
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA', 'BUTTON', 'HEADER', 'NAV'];
        if (skipTags.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        
        if (
          parent.closest('.kylrix-topbar') || 
          parent.closest('[data-note-search-surface]') || 
          parent.closest('.ob-drawer-root')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    const text = currentNode.nodeValue?.trim();
    if (text && text.toLowerCase().includes(lowercaseQuery) && text.length < 200) {
      const parent = currentNode.parentElement;
      if (parent) {
        if (!matches.some(m => m.element === parent)) {
          matches.push({
            text,
            tag: parent.tagName.toLowerCase(),
            element: parent
          });
        }
      }
    }
    if (matches.length >= 8) break;
    currentNode = walker.nextNode();
  }
  
  return matches;
}

function highlightElement(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  const originalTransition = el.style.transition;
  const originalOutline = el.style.outline;
  const originalBoxShadow = el.style.boxShadow;
  
  el.style.transition = 'all 0.3s ease';
  el.style.outline = '2px solid #6366F1';
  el.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.6)';
  el.style.borderRadius = '4px';
  
  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.boxShadow = originalBoxShadow;
    setTimeout(() => {
      el.style.transition = originalTransition;
    }, 300);
  }, 2000);
}

const BRAND_INDIGO = '#6366F1';

interface ConnectTopbarProps {
  className?: string;
}

function isRenderableImageSrc(value?: string | null) {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

function shortenUserId(fullId?: string | null) {
  if (!fullId) return null;
  return fullId.length > 12 ? `${fullId.slice(0, 6)}...${fullId.slice(-6)}` : fullId;
}

function SyncIndicator() {
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    const onStart = () => setSyncing(true);
    const onEnd = () => setSyncing(false);
    window.addEventListener('kylrix:nexus:sync_start', onStart);
    window.addEventListener('kylrix:nexus:sync_end', onEnd);
    return () => {
      window.removeEventListener('kylrix:nexus:sync_start', onStart);
      window.removeEventListener('kylrix:nexus:sync_end', onEnd);
    };
  }, []);

  if (!syncing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        position: 'absolute',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#6366F1',
        color: 'white',
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
        zIndex: 100,
      }}
    >
      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
      SYNCING WORKSPACE
    </motion.div>
  );
}

export default function ConnectTopbar({
  className,
}: ConnectTopbarProps) {
  const { user, logout, isAuthenticating, updatePreferences } = useAuth();
  const { openWallet } = useWalletOverlay();
  const { openAgenticDrawer, closeAgenticDrawer } = useAgenticDrawer();
  const { open: openUnified } = useUnifiedDrawer();
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPro = hasEffectivePaidAccess(user, currentTier);
  const router = useRouter();
  const pathname = usePathname();
  const { setIsCollapsed } = useSidebar();
  const { activeWorkspace, workspaces, setActiveWorkspaceId, createWorkspace } = useWorkspace();
  const { notes = [] } = useNotes();
  const { tasks = [], projects = [] } = useTask();
  // To let any drawer communicate full state expansion globally:
  const isDrawerExpanded = typeof window !== 'undefined' && document.body.classList.contains('drawer-expanded');
  
  if (isDrawerExpanded) {
    return null;
  }
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const activeApp = useMemo<KylrixApp>(() => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    if (pathname?.startsWith('/send')) return 'send';
    if (pathname?.startsWith('/projects')) return 'projects';
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
  const [dismissedHintId, setDismissedHintId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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

  const localNoteResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return notes.filter(note => 
      note.title?.toLowerCase().includes(q) || 
      note.content?.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const localTaskResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return tasks.filter(task => 
      task.title?.toLowerCase().includes(q) || 
      task.description?.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const localProjectResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return projects.filter(proj => 
      proj.name?.toLowerCase().includes(q) || 
      proj.description?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const { events, suggestions, dismissSuggestion } = useLocalContext();

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
  
  const [isClient, setIsClient] = useState(true);
  useEffect(() => setIsClient(true), []);

  const profileSeed = useMemo(
    () => ({
      username: profileUsername ? String(profileUsername).replace(/^@+/, '').toLowerCase() : null,
      displayName: profileName,
      avatar: profileAvatarUrl || profilePicId || null,
      userId: (user as any)?.$id || null,
    }),
    [profileAvatarUrl, profileName, profilePicId, profileUsername, user],
  );

  const previewManager = useMemo(
    () =>
      createProfilePreviewManager(async (fileId, width, height) => {
        const { fetchProfilePreview } = await import('@/lib/profile-preview');
        const preview = await fetchProfilePreview(fileId, width, height);
        return typeof preview === 'string' ? preview : null;
      }),
    [],
  );

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
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
  }, []);

  const handleCloseAll = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setNotifHint(null);
    setShortcutsOpen(false);
    closeAgenticDrawer();
  }, [closeAgenticDrawer]);

  const openAgenticFromTopbar = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setNotifHint(null);
    setShortcutsOpen(false);
    openAgenticDrawer();
  }, [openAgenticDrawer]);

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
        },
      }),
    [searchQuery, activeApp],
  );

  const dynamicQuickActions = useMemo(() => {
    // 1. Dynamic recommendations based on current app route
    const routeSuggestions = {
      note: [
        { id: 'create-note', title: 'Write a New Idea', description: 'Create a private idea inside your workspace', href: '/app', kind: 'note', accent: '#EC4899' },
        { id: 'view-settings', title: 'Security Preferences', description: 'Adjust your ideas security & encryption rules', href: '/settings', kind: 'system', accent: '#6366F1' }
      ],
      projects: [
        { id: 'create-proj', title: 'Start Fresh Project', description: 'Spin up outcome-aware container', href: '/projects', kind: 'flow', accent: '#6366F1' },
        { id: 'view-wf', title: 'Manage Action Workflows', description: 'Automate repetitive workflows', href: '/projects/workflows', kind: 'note', accent: '#A855F7' }
      ],
      flow: [
        { id: 'manage-tasks', title: 'View Outstanding Tasks', description: 'Review scheduled deliverables and actions', href: '/flow', kind: 'flow', accent: '#A855F7' }
      ],
      vault: [
        { id: 'share-secrets', title: 'Audit Ephemeral Secrets', description: 'Review sharing keychains and rules', href: '/vault/sharing', kind: 'vault', accent: '#10B981' }
      ],
      connect: [
        { id: 'start-huddle', title: 'Start Connect Huddle', description: 'Centralize calls and group threads', href: '/connect', kind: 'connect', accent: '#F59E0B' }
      ]
    };

    const currentAppSuggestions = routeSuggestions[activeApp as keyof typeof routeSuggestions] || [];

    // 2. Historical recommendations based on past user actions (most frequent niches in cache)
    const nicheCounts: Record<string, number> = {};
    events.forEach(e => {
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
        href: '/flow',
        kind: 'flow',
        accent: '#A855F7'
      });
    }
 else if (topNiche === 'security' && activeApp !== 'vault') {
      historicalSuggestions.push({
        id: 'hist-vault',
        title: 'Audit Vault Keychain',
        description: 'Manage passwords and TOTP codes safely',
        href: '/vault/sharing',
        kind: 'vault',
        accent: '#10B981'
      });
    }

    return [...currentAppSuggestions, ...historicalSuggestions].slice(0, 3);
  }, [activeApp, events]);

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

  const connectApps = useMemo(
    () => {
      return createEcosystemPanelItems(activeApp).map((item) => ({
        ...item,
        href: getEcosystemUrl(item.app),
      }));
    },
    [activeApp],
  );

  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = searchOpen ? 'search' : notificationsOpen ? 'notifications' : shortcutsOpen ? 'shortcuts' : profileMenuAnchorEl ? 'profile' : appMenuAnchorEl ? 'ecosystem' : null;

  useEffect(() => {
    if (!activePanel) return;

    const isInsideTopbarSurface = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (headerRef.current?.contains(target)) return true;
      return Boolean(
        target.closest(
          '[data-kylrix-topbar-panel], .ob-drawer-root, .ob-drawer-panel, .kylrix-sidebar',
        ),
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isInsideTopbarSurface(event.target)) return;
      handleCloseAll();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [activePanel, handleCloseAll]);

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
        s: 'apps',
        m: 'profile',
        a: 'agent',
        k: 'shortcuts',
        p: '/projects',
        n: '/app',
        t: '/tags',
        x: '/settings',
        g: '/flow/goals',
        q: '/flow/forms',
        e: '/flow/events',
        h: '/connect/calls',
      };

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
        case 'shortcuts':
          setShortcutsOpen(true);
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
        sx={{ 
          p: { xs: 2.25, md: 4 }, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2.5,
          maxHeight: isDesktop ? 'none' : '45vh',
          overflowY: isDesktop ? 'visible' : 'auto'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1', display: 'grid', placeItems: 'center' }}>
                  <Bell size={18} strokeWidth={2.5} />
              </Box>
              <Box>
                  <Typography sx={{ color: 'white', fontSize: '1rem', fontWeight: 900, fontFamily: 'var(--font-clash)', textTransform: 'uppercase', tracking: '0.05em', lineHeight: 1 }}>
                      Intelligence Center
                  </Typography>
                  <Typography sx={{ color: 'white/30', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      System Pulses & Alerts
                  </Typography>
              </Box>
          </Box>
          <IconButton onClick={() => setNotificationsOpen(false)} size="small" sx={{ color: 'white/20', '&:hover': { color: 'white', bgcolor: 'white/5' } }}>
              <CloseIcon size={16} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'grid', gap: 1, overflowY: isDesktop ? 'auto' : 'visible', maxHeight: isDesktop ? 'calc(100vh - 180px)' : 'none', pr: 0.5 }}>
          {/* 1. Intelligence Pulses (Authoritative Suggestions) */}
          {suggestions.map(suggestion => (
              <Box 
                  key={suggestion.id} 
                  component="button"
                  sx={{ 
                      display: 'flex', 
                      gap: 2, 
                      p: 2, 
                      borderRadius: '20px', 
                      bgcolor: 'rgba(99, 102, 241, 0.04)',
                      border: '1px solid rgba(99, 102, 241, 0.12)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      width: '100%',
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)', transform: 'translateY(-1px)', borderColor: 'rgba(99, 102, 241, 0.3)' }
                  }}
                  onClick={() => {
                      dismissSuggestion(suggestion.id);
                      setNotifHint(null);
                      handleCloseAll();
                      if (suggestion.actionHref) router.push(suggestion.actionHref);
                  }}
              >
                  <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Sparkles size={18} strokeWidth={2.5} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.88rem', lineHeight: 1.2 }}>{suggestion.title}</Typography>
                      <Typography component="span" sx={{ color: 'white/45', fontSize: '0.76rem', lineHeight: 1.35 }}>{suggestion.description}</Typography>
                  </Box>
                  <ChevronRight size={16} style={{ color: 'white/10', alignSelf: 'center', flexShrink: 0 }} />
              </Box>
          ))}

          {/* 2. System Alerts */}
          {notifications.map(notif => (
              <Box 
                  key={notif.id} 
                  sx={{ 
                      display: 'flex', 
                      gap: 2, 
                      p: 2, 
                      borderRadius: '20px', 
                      bgcolor: notif.read ? 'transparent' : 'rgba(255,255,255,0.02)',
                      border: '1px solid',
                      borderColor: notif.read ? 'rgba(255,255,255,0.03)' : alpha(notif.accent, 0.12),
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      width: '100%',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: alpha(notif.accent, 0.25) }
                  }}
                  onClick={() => markNotificationRead(notif.id)}
              >
                  <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: alpha(notif.accent, 0.1), color: notif.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Activity size={18} strokeWidth={2.5} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.2 }}>{notif.title}</Typography>
                      <Typography component="span" sx={{ color: 'white/30', fontSize: '0.76rem', lineHeight: 1.35 }}>{notif.message}</Typography>
                  </Box>
                  <IconButton size="small" onClick={(e: React.MouseEvent) => dismissNotification(notif.id, e)} sx={{ color: 'white/10', alignSelf: 'flex-start', flexShrink: 0, '&:hover': { color: '#EF4444' } }}>
                      <CloseIcon size={12} />
                  </IconButton>
              </Box>
          ))}

          {notifications.length === 0 && suggestions.length === 0 && (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'white/3', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                      <RefreshCw size={24} className="text-white/10" />
                  </Box>
                  <Typography sx={{ color: 'white/20', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      No Active Pulses
                  </Typography>
              </Box>
          )}
        </Box>
      </Box>
    );

    if (isDesktop) {
      return (
        <Drawer
          anchor="left"
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              backgroundImage: 'none',
              width: 320,
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
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
          overflowY: isDesktop ? 'visible' : 'auto',
        }}
      >
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
                  bgcolor: 'rgba(0, 0, 0, 0.4)',
                }
              }}
            >
              <Search size={16} style={{ color: 'rgba(255,255,255,0.35)', marginRight: 8, flexShrink: 0 }} />
              <InputBase
                id="topbar-search-field"
                inputRef={searchInputRef}
                value={searchQuery}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                placeholder="Search note, flow, vault, connect..."
                fullWidth
                autoFocus
                sx={{
                  color: 'white',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 },
                }}
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
          {!hasQuery ? (
            <>
              {/* Applications section */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Apps
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                  {[
                    { name: 'note', label: 'Ideas', color: '#EC4899', href: '/app' },
                    { name: 'flow', label: 'Flow', color: '#A855F7', href: '/flow' },
                    { name: 'vault', label: 'Vault', color: '#10B981', href: '/vault' },
                    { name: 'connect', label: 'Connect', color: '#F59E0B', href: '/connect' }
                  ].map((app) => (
                    <ButtonBase
                      key={app.name}
                      onClick={() => {
                        handleCloseAll();
                        router.push(app.href);
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
                        <Logo app={app.name as any} size={16} variant="icon" />
                      </Box>
                      <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>
                        {app.label}
                      </Typography>
                    </ButtonBase>
                  ))}
                </Box>
              </Box>

              {/* Quick Actions section including Send */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  {/* Primary Send action */}
                  <Box
                    component="button"
                    onClick={() => {
                      handleCloseAll();
                      router.push('/send');
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
                        borderColor: '#10B98133',
                        transform: 'translateX(2px)'
                      }
                    }}
                  >
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', flexShrink: 0 }}>
                      <Logo app="send" size={15} variant="icon" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                        Send
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }}>
                        Share secure files and notes
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
                        <Logo app={action.kind as any} size={15} variant="icon" />
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
              {/* Local Notes Matches */}
              {localNoteResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    Ideas ({localNoteResults.length})
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {localNoteResults.slice(0, 4).map((note) => (
                      <Box
                        key={note.$id}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          router.push(`/note?id=${note.$id}`);
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
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', flexShrink: 0 }}>
                          <Logo app="note" size={15} variant="icon" />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            {note.title || 'Untitled Note'}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                            {note.content?.slice(0, 60) || 'Empty content'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Local Tasks & Workspaces Matches */}
              {(localTaskResults.length > 0 || localProjectResults.length > 0) && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    Flow & Workspaces
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {localProjectResults.slice(0, 2).map((proj) => (
                      <Box
                        key={proj.id}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          router.push(`/projects/${proj.id}`);
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
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(168, 85, 247, 0.12)', color: '#A855F7', flexShrink: 0 }}>
                          <Logo app="flow" size={15} variant="icon" />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            Project: {proj.name}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                            {proj.description || 'Active project container'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {localTaskResults.slice(0, 3).map((task) => (
                      <Box
                        key={task.id}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          router.push(`/flow?task=${task.id}`);
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
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(168, 85, 247, 0.12)', color: '#A855F7', flexShrink: 0 }}>
                          <Logo app="flow" size={15} variant="icon" />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            Task: {task.title}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                            {task.description || 'Active task in roadmap'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
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
    );

    if (isDesktop) {
      return (
        <Drawer
          anchor="left"
          open={searchOpen}
          onClose={handleCloseAll}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 320,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              p: 2.75,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
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
                bgcolor: 'rgba(0, 0, 0, 0.4)',
              }
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
                '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 },
              }}
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
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
              overflow: 'hidden',
            }}
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
                      '&:hover': { bgcolor: alpha(appAccent, 0.12) },
                    }}
                    startIcon={<Wallet size={14} />}
                  >
                    Wallet
                  </Button>
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
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                    }}
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
                      '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.12)' },
                    }}
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
              boxSizing: 'border-box',
            }
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
      >
        {profileContent}
      </Box>
    );
  };

  const renderAppPanel = () => {
    if (!appMenuAnchorEl) return null;

    if (isDesktop) {
      return (
        <Drawer
          anchor="left"
          open={Boolean(appMenuAnchorEl)}
          onClose={() => setAppMenuAnchorEl(null)}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 320,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              p: 2.75,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.75 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              Ecosystem
            </Typography>
            <IconButton onClick={() => setAppMenuAnchorEl(null)} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
          
          {/* App List */}
          <Stack spacing={1.25} sx={{ overflowY: 'auto', flex: 1, mx: -2.75, px: 2.75 }}>
            {connectApps.map((item) => {
              const appTone = getAppTone(item.app);
              return (
                <Box
                  key={item.href}
                  component="button"
                  onClick={() => {
                    handleCloseAll();
                    if (!user || user.isPulse) {
                      openUnified('login');
                    } else {
                      router.push(item.href);
                    }
                  }}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 2.25,
                    py: 1.5,
                    borderRadius: '16px',
                    color: '#fff',
                    background: 'transparent',
                    bgcolor: item.selected ? alpha(appTone.secondary, 0.06) : 'rgba(255, 255, 255, 0.005)',
                    border: '1px solid',
                    borderColor: item.selected ? alpha(appTone.secondary, 0.15) : 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: alpha(appTone.secondary, 0.1),
                      borderColor: alpha(appTone.secondary, 0.2),
                      transform: 'translateX(3px)',
                    }
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: alpha(appTone.secondary, 0.08), color: appTone.secondary, flexShrink: 0 }}>
                      <Logo app={item.app} size={15} variant="icon" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
                      <Typography component="span" sx={{ color: '#F3F2F0', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                        {item.label}
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.62)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
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
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          }}
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
            {/* Mobile Header with close button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: 'white', fontSize: '1rem' }}>
                Ecosystem
              </Typography>
              <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
                <CloseIcon size={16} />
              </IconButton>
            </Box>

            {/* Join Discord CTA */}
            {!user?.prefs?.discordJoined && (
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
                className="flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 hover:bg-[#5865F2]/10 transition-all font-satoshi text-xs font-bold text-[#5865F2]"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36c2.65-3.6,5-7.46,7-11.5a68.88,68.88,0,0,1-11-5.26c.92-.68,1.82-1.39,2.69-2.13A75.14,75.14,0,0,0,96.5,77.47c.87.74,1.77,1.45,2.69,2.13a68.88,68.88,0,0,1-11,5.26c2,4,4.35,7.9,7,11.5a105.73,105.73,0,0,0,31-18.83C129,54.65,122.68,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.9,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96.14,53,91,65.69,84.69,65.69Z"/>
                  </svg>
                  <span>Join our Discord Community</span>
                </div>
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-[#5865F2]/10 border border-[#5865F2]/25">Join</span>
              </a>
            )}

            {/* Workspaces Section on Mobile App Dropdown */}
            <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, color: '#9B9691', fontSize: '0.75rem', uppercase: true, tracking: '0.1em' }}>
                  Workspaces
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    handleCloseAll();
                    router.push('/workspaces');
                  }}
                  sx={{ color: '#6366F1', fontWeight: 800, fontSize: '0.75rem', textTransform: 'none' }}
                >
                  + New Workspace
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {workspaces.map((w) => {
                  const isActive = activeWorkspace?.id === w.id;
                  return (
                    <Box
                      key={w.id}
                      component="button"
                      onClick={() => {
                        setActiveWorkspaceId(w.id);
                        handleCloseAll();
                        if (w.isPersonal || w.id === user?.$id) {
                          router.push('/app');
                        } else {
                          router.push(`/workspaces/${w.id}`);
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
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#6366F1' : '#fff' }} noWrap>
                          {w.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                          {w.isPersonal ? 'Personal Workspace' : 'Workspace'}
                        </Typography>
                      </Box>
                      {isActive && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1' }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {connectApps.filter((item) => !['note', 'flow', 'vault'].includes(item.app)).map((item) => {
                const appTone = getAppTone(item.app);
                return (
                  <Box
                    key={item.href}
                    component="button"
                    onClick={() => {
                      handleCloseAll();
                      if (!user && item.app !== 'kylrix') {
                        openUnified('login');
                      } else {
                        router.push(item.href);
                      }
                    }}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      px: 2.25,
                      py: 1.5,
                      borderRadius: '20px',
                      color: 'white',
                      background: 'transparent',
                      bgcolor: item.selected ? alpha(appTone.secondary, 0.06) : 'rgba(255,255,255,0.01)',
                      border: '1px solid',
                      borderColor: item.selected ? alpha(appTone.secondary, 0.15) : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: alpha(appTone.secondary, 0.1),
                        borderColor: alpha(appTone.secondary, 0.2),
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: alpha(appTone.secondary, 0.08), color: appTone.secondary, flexShrink: 0 }}>
                        <Logo app={item.app} size={15} variant="icon" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
                        <Typography component="span" sx={{ color: '#F3F2F0', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                          {item.label}
                        </Typography>
                        <Typography component="span" sx={{ color: 'rgba(255,255,255,0.62)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>
                          {item.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </motion.div>
    );
  };

  const renderShortcutsPanel = () => {
    if (!shortcutsOpen) return null;

    const shortcutsList = [
      { key: 'Ctrl + F', desc: 'Search Ecosystem / Ideas' },
      { key: 'Ctrl + S', desc: 'Ecosystem Apps Directory' },
      { key: 'Ctrl + M', desc: 'Profile System Panel' },
      { key: 'Ctrl + A', desc: 'Agentic Assistant' },
      { key: 'Ctrl + K', desc: 'Keyboard Shortcuts Console' },
      { key: 'Ctrl + P', desc: 'Navigate to Workspaces' },
      { key: 'Ctrl + N', desc: 'Navigate to Ideas' },
      { key: 'Ctrl + T', desc: 'Navigate to Tags' },
      { key: 'Ctrl + X', desc: 'Navigate to Settings' },
      { key: 'Ctrl + Shift + V', desc: 'Navigate to Vault' },
      { key: 'Ctrl + G', desc: 'Navigate to Goals' },
      { key: 'Ctrl + Q', desc: 'Navigate to Forms' },
      { key: 'Ctrl + E', desc: 'Navigate to Events' },
      { key: 'Ctrl + H', desc: 'Navigate to Calls / Huddles' },
    ];

    const shortcutsContent = (
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
          px: { xs: 2.25, md: 2.75 },
          py: { xs: 1.25, md: 0 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxHeight: isDesktop ? 'none' : '45vh',
          overflowY: isDesktop ? 'visible' : 'auto',
          flex: isDesktop ? 1 : undefined,
          minHeight: isDesktop ? 0 : undefined,
        }}
      >
        {!isDesktop && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                <Sparkles size={16} />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1rem', lineHeight: 1.1 }}>
                  System Shortcuts
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Quick keys
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr' },
            gap: 1,
            overflowY: isDesktop ? 'auto' : 'visible',
            maxHeight: isDesktop ? 'calc(100vh - 180px)' : 'none',
            pr: 0.5,
            pb: 0.5,
          }}
        >
          {shortcutsList.map((item) => (
            <Box
              key={item.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                p: 1.5,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)', lineHeight: 1.35, minWidth: 0 }}>
                {item.desc}
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: '#6366F1',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                  px: 1.1,
                  py: 0.55,
                  borderRadius: '8px',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.key}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );

    if (isDesktop) {
      return (
        <Drawer
          anchor="left"
          open={shortcutsOpen}
          onClose={handleCloseAll}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              backgroundImage: 'none',
              width: 320,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              p: 2.75,
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                <Sparkles size={16} />
              </Box>
              <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
                System Shortcuts
              </Typography>
            </Box>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
          {shortcutsContent}
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
      >
        {shortcutsContent}
      </Box>
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
          height: isDesktop ? '88px' : (activePanel ? 'auto' : '88px'),
        }}
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

            {/* Center: 🏝️ Dynamic Island Search & Notification Host */}
            <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
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
                            inputRef={searchInputRef} 
                            value={searchQuery} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} 
                            placeholder="Search ecosystem..." 
                            sx={{ flex: 1, color: 'white', fontWeight: 800, fontSize: '0.9rem', '& input::placeholder': { color: 'white/20' } }} 
                        />
                        
                        {/* 🔔 Notifications CTA - The Island Extension */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Box sx={{ width: 1, height: 20, bgcolor: 'white/10', mx: 0.5 }} />
                            <IconButton 
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    toggleNotifications();
                                }} 
                                sx={{ 
                                    color: (unreadNotifCount > 0 || suggestions.length > 0) ? BRAND_INDIGO : 'white/20', 
                                    position: 'relative', 
                                    p: 1,
                                    bgcolor: notificationsOpen ? 'white/5' : 'transparent',
                                    '&:hover': { bgcolor: 'white/8' }
                                }}
                            >
                                <Bell size={18} strokeWidth={2.5} />
                                {(unreadNotifCount > 0 || suggestions.length > 0) && (
                                    <Box sx={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', bgcolor: '#EC4899', border: '1.5px solid #000' }} />
                                )}
                            </IconButton>
                        </Box>

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
                      onClick={notifHint ? toggleNotifications : openSearch} 
                      style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                    >
                      <Box sx={{ 
                        width: notifHint ? { xs: 'calc(100vw - 140px)', md: 380 } : { xs: 44, md: 160 }, 
                        height: 44, 
                        borderRadius: '999px', 
                        bgcolor: notifHint ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)', 
                        border: notifHint ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(255,255,255,0.08)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: notifHint ? 'flex-start' : 'center', 
                        px: notifHint ? 2 : 0,
                        gap: 1.25, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: 'rgba(99, 102, 241, 0.03)',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        {notifHint ? (
                          <>
                            <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: `${notifHint.accent}22`, color: notifHint.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <Sparkles size={12} strokeWidth={2.5} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.75rem', lineHeight: 1.1, textTransform: 'uppercase' }} noWrap>{notifHint.title}</Typography>
                              <Typography component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.68rem', lineHeight: 1.2 }} noWrap>{notifHint.description}</Typography>
                            </Box>
                            <IconButton 
                              size="small" 
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setDismissedHintId(notifHint.id);
                                setNotifHint(null);
                              }}
                              sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, '&:hover': { color: 'white' } }}
                            >
                              <CloseIcon size={12} />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <Search size={18} strokeWidth={2.5} />
                            <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                            {unreadNotifCount > 0 && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#EC4899', ml: -0.5 }} />}
                          </>
                        )}
                      </Box>
                    </motion.div>
                  ) : (
                    <div 
                      onClick={notifHint ? toggleNotifications : openSearch} 
                      style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                    >
                      <Box sx={{ 
                        width: notifHint ? { xs: 'calc(100vw - 140px)', md: 380 } : { xs: 44, md: 160 }, 
                        height: 44, 
                        borderRadius: '999px', 
                        bgcolor: notifHint ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)', 
                        border: notifHint ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(255,255,255,0.08)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: notifHint ? 'flex-start' : 'center', 
                        px: notifHint ? 2 : 0,
                        gap: 1.25, 
                        color: 'white', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          bgcolor: 'rgba(99, 102, 241, 0.03)',
                          boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                        }
                      }}>
                        {notifHint ? (
                          <>
                            <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: `${notifHint.accent}22`, color: notifHint.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <Sparkles size={12} strokeWidth={2.5} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.75rem', lineHeight: 1.1, textTransform: 'uppercase' }} noWrap>{notifHint.title}</Typography>
                              <Typography component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.68rem', lineHeight: 1.2 }} noWrap>{notifHint.description}</Typography>
                            </Box>
                            <IconButton 
                              size="small" 
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setDismissedHintId(notifHint.id);
                                setNotifHint(null);
                              }}
                              sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, '&:hover': { color: 'white' } }}
                            >
                              <CloseIcon size={12} />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <Search size={18} strokeWidth={2.5} />
                            <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                            {unreadNotifCount > 0 && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#EC4899', ml: -0.5 }} />}
                          </>
                        )}
                      </Box>
                    </div>
                  )}
                </AnimatePresence>
              ) : <Box sx={{ height: 44 }} />}
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
      {renderShortcutsPanel()}
    </>
  );
}
