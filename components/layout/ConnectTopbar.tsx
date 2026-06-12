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
} from '@/lib/mui-tailwind/material';
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
import { useAuth } from '@/lib/auth';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { getUserProfilePicId, hasPaidKylrixPlan } from '@/lib/utils';
import { getEcosystemUrl, APP_BASE_PATHS } from '@/lib/constants';
import { TOPBAR_LAYOUT, getAppTone, type KylrixApp } from '@/lib/sdk/design';
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
import { useDrawerState } from '@/components/ui/DrawerStateContext';

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
  const { user, logout, isAuthenticating } = useAuth();
  const { openWallet } = useWalletOverlay();
  const { openAgenticDrawer } = useAgenticDrawer();
  const { open: openUnified } = useUnifiedDrawer();
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPro = hasPaidKylrixPlan(user) || currentTier === 'PRO';
  const router = useRouter();
  const pathname = usePathname();
  const { isDrawerOpen } = useDrawerState();
  
  // To let any drawer communicate full state expansion globally:
  const isDrawerExpanded = typeof window !== 'undefined' && document.body.classList.contains('drawer-expanded');
  
  if (isDrawerExpanded) {
    return null;
  }
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const activeApp = useMemo<KylrixApp>(() => {
    if (pathname?.startsWith('/note')) return 'note';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const { events, suggestions, dismissSuggestion } = useLocalContext();

  // Watch for new intelligence pulses (suggestions) to show in Dynamic Island
  useEffect(() => {
    if (suggestions.length > 0) {
      const latest = suggestions[0];
      // Only show hint if it's new (not already the hint or unread)
      if (!notifHint || notifHint.id !== latest.id) {
        setNotifHint({
          id: latest.id,
          title: latest.title,
          description: latest.description,
          accent: latest.niche === 'intelligence' ? '#6366F1' : '#10B981'
        });
        setSearchOpen(true);
        // Clear hint after 8 seconds to return to standard search expansion
        const timer = setTimeout(() => setNotifHint(null), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [suggestions, notifHint]);
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
        const preview = await getProfilePicturePreview(fileId, width, height);
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
        },
      }),
    [searchQuery, activeApp],
  );

  const dynamicQuickActions = useMemo(() => {
    // 1. Dynamic recommendations based on current app route
    const routeSuggestions = {
      note: [
        { id: 'create-note', title: 'Write a New Note', description: 'Create a private note inside your workspace', href: '/note', kind: 'note', accent: '#EC4899' },
        { id: 'view-settings', title: 'Security Preferences', description: 'Adjust your notes security & encryption rules', href: '/settings', kind: 'system', accent: '#6366F1' }
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
        title: 'Review Recent Notes',
        description: 'You spent a lot of time in workspace notes recently. Resume writing?',
        href: '/note',
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
      const items = createEcosystemPanelItems(activeApp).map((item) => ({
        ...item,
        href: getEcosystemUrl(item.app),
      }));
      if (!isDesktop) {
        return items.filter(item => item.id !== 'projects');
      }
      return items;
    },
    [activeApp, isDesktop],
  );

  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = searchOpen ? 'search' : notificationsOpen ? 'notifications' : profileMenuAnchorEl ? 'profile' : appMenuAnchorEl ? 'ecosystem' : null;

  useEffect(() => {
    if (!activePanel) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || (headerRef.current && headerRef.current.contains(target))) return;
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
      if (!event.ctrlKey) return;
      
      const key = event.key.toLowerCase();
      
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
        n: '/note',
        t: '/tags',
        x: '/settings',
        v: '/vault',
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
          openAgenticDrawer();
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
  }, [handleCloseAll, openSearch, openAgenticDrawer, router]);

  const renderNotificationDrawer = () => {
    return (
      <Drawer
        anchor="top"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        keepMounted={false}
        disablePortal={false} 
        PaperProps={{
          sx: {
            bgcolor: '#161412',
            backgroundImage: 'none',
            width: isDesktop ? 480 : '100%',
            mx: 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            borderLeft: isDesktop ? '1px solid rgba(255,255,255,0.08)' : 'none',
            borderRight: isDesktop ? '1px solid rgba(255,255,255,0.08)' : 'none',
            borderRadius: '0 0 32px 32px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            maxHeight: 460, 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
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

          <Box sx={{ display: 'grid', gap: 1, overflowY: 'auto', maxHeight: 340, pr: 0.5 }}>
            {/* 1. Intelligence Pulses (Authoritative Suggestions) */}
            {suggestions.map(suggestion => (
                <Box 
                    key={suggestion.id} 
                    sx={{ 
                        display: 'flex', 
                        gap: 2, 
                        p: 2, 
                        borderRadius: '20px', 
                        bgcolor: 'rgba(99, 102, 241, 0.04)',
                        border: '1px solid rgba(99, 102, 241, 0.12)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
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
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.88rem', lineHeight: 1.2 }}>{suggestion.title}</Typography>
                        <Typography sx={{ color: 'white/45', fontSize: '0.76rem', lineHeight: 1.35, mt: 0.25 }}>{suggestion.description}</Typography>
                    </Box>
                    <ChevronRight size={16} style={{ color: 'white/10', alignSelf: 'center' }} />
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
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: alpha(notif.accent, 0.25) }
                    }}
                    onClick={() => markNotificationRead(notif.id)}
                >
                    <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: alpha(notif.accent, 0.1), color: notif.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Activity size={18} strokeWidth={2.5} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.2 }}>{notif.title}</Typography>
                        <Typography sx={{ color: 'white/30', fontSize: '0.76rem', lineHeight: 1.35, mt: 0.25 }}>{notif.message}</Typography>
                    </Box>
                    <IconButton size="small" onClick={(e) => dismissNotification(notif.id, e)} sx={{ color: 'white/10', alignSelf: 'flex-start', '&:hover': { color: '#EF4444' } }}>
                        <CloseIcon size={12} />
                    </IconButton>
                </Box>
            ))}

            {notifications.length === 0 && suggestions.length === 0 && (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Box sx={{ w: 48, h: 48, borderRadius: 'full', bgcolor: 'white/3', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                        <RefreshCw size={24} className="text-white/10" />
                    </Box>
                    <Typography sx={{ color: 'white/20', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        No Active Pulses
                    </Typography>
                </Box>
            )}
          </Box>
        </Box>
      </Drawer>
    );
  };

  const renderSearchPanel = () => {
    if (!searchOpen) return null;

    const query = searchQuery.trim().toLowerCase();
    const hasQuery = query.length >= 2;

    const searchContent = (
        <Box
          onWheel={(event) => {
            if (isDesktop) return;
            const node = event.currentTarget;
            if (event.deltaY < 0 && isTopbarScrollAtTop(node)) {
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
          {!isDesktop && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              {/* Header with Title and Cancel button */}
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

              {/* Solid search input container */}
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
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search notes, systems..."
                  fullWidth
                  autoFocus
                  sx={{
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 },
                  }}
                  onKeyDown={(event) => {
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

          <Stack spacing={2} sx={{ mt: isDesktop ? 0 : 1.5 }}>
            {!hasQuery ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', md: '1.2fr 1fr' },
                  gap: 2.5,
                }}
              >
                {/* Left Column: Contextual Action Flow & Proactive Insights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Proactive Confident AI Suggestions if any */}
                  {suggestions.length > 0 && (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
                        <Sparkles size={11} style={{ color: '#6366F1' }} />
                        Smart Insights
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        {suggestions.map((suggestion) => (
                          <Box
                            key={suggestion.id}
                            sx={{
                              p: 1.75,
                              borderRadius: '22px',
                              bgcolor: 'rgba(99, 102, 241, 0.04)',
                              border: '1px solid rgba(99, 102, 241, 0.12)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1.25,
                              position: 'relative',
                              overflow: 'hidden',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'rgba(99, 102, 241, 0.06)',
                                borderColor: 'rgba(99, 102, 241, 0.2)',
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1.25 }}>
                              <Box sx={{
                                width: 34,
                                height: 34,
                                borderRadius: '10px',
                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                color: '#6366F1',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0
                              }}>
                                <Bot size={16} />
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
                                <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.84rem', lineHeight: 1.2 }}>
                                  {suggestion.title}
                                </Typography>
                                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem', lineHeight: 1.3 }}>
                                  {suggestion.description}
                                </Typography>
                              </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end', zIndex: 1 }}>
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissSuggestion(suggestion.id);
                                }}
                                sx={{
                                  color: 'rgba(255,255,255,0.35)',
                                  textTransform: 'none',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  borderRadius: '9px',
                                  px: 1.25,
                                  '&:hover': { color: '#FF4D4D', bgcolor: 'rgba(255, 77, 77, 0.06)' }
                                }}
                              >
                                Cancel
                              </Button>
                              {suggestion.actionHref && (
                                <Button
                                  size="small"
                                  onClick={() => {
                                    handleCloseAll();
                                    router.push(suggestion.actionHref!);
                                  }}
                                  variant="contained"
                                  sx={{
                                    bgcolor: '#6366F1',
                                    color: 'white',
                                    textTransform: 'none',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    borderRadius: '9px',
                                    px: 1.75,
                                    '&:hover': { bgcolor: '#5254E8' }
                                  }}
                                >
                                  {suggestion.actionLabel || 'Run'}
                                </Button>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Contextual Suggestions */}
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
                      <Activity size={11} style={{ color: '#F59E0B' }} />
                      Quick Actions
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {dynamicQuickActions.length === 0 ? (
                        <Box sx={{ p: 2, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.06)', textAlign: 'center' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>
                            Explore to build context!
                          </Typography>
                        </Box>
                      ) : (
                        dynamicQuickActions.map((action) => (
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
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: `${action.accent}12`,
                              color: action.accent,
                              flexShrink: 0
                            }}>
                              <Logo app={action.kind as any} size={15} variant="icon" />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
                              <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                                {action.title}
                              </Typography>
                              <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.3 }}>
                                {action.description}
                              </Typography>
                            </Box>
                          </Box>
                        ))
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* Right Column: Platform Alerts & Notifications */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Bell size={11} style={{ color: '#EC4899' }} />
                      Alerts
                    </Typography>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <Box sx={{
                        px: 0.75,
                        py: 0.1,
                        borderRadius: '6px',
                        bgcolor: '#6366F1',
                        color: 'white',
                        fontSize: '0.64rem',
                        fontWeight: 900
                      }}>
                        {notifications.filter(n => !n.read).length} New
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {notifications.length === 0 ? (
                      <Box sx={{ px: 2, py: 1.5, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.06)', textAlign: 'center' }}>
                        <Typography component="span" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', lineHeight: 1.4, display: 'block' }}>
                          System stable.
                        </Typography>
                      </Box>
                    ) : (
                      notifications.map((notif) => (
                        <Box
                          key={notif.id}
                          component="div"
                          onClick={() => markNotificationRead(notif.id)}
                          sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.25,
                            px: 2,
                            py: 1.25,
                            borderRadius: '20px',
                            bgcolor: notif.read ? 'rgba(255,255,255,0.005)' : 'rgba(255,255,255,0.015)',
                            border: '1px solid',
                            borderColor: notif.read ? 'rgba(255,255,255,0.02)' : alpha(notif.accent, 0.18),
                            color: 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'rgba(255,255,255,0.03)',
                              borderColor: notif.read ? 'rgba(255,255,255,0.05)' : alpha(notif.accent, 0.3),
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '10px',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              bgcolor: alpha(notif.accent, notif.read ? 0.04 : 0.1),
                              color: notif.accent,
                              position: 'relative',
                            }}
                          >
                            <Bell size={14} />
                            {!notif.read && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 7,
                                  height: 7,
                                  borderRadius: '999px',
                                  bgcolor: notif.accent,
                                  border: '1.5px solid #161412',
                                }}
                              />
                            )}
                          </Box>

                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
                            <Typography
                              component="span"
                              sx={{
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                lineHeight: 1.2,
                                opacity: notif.read ? 0.65 : 1,
                                display: 'block',
                              }}
                            >
                              {notif.title}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                color: 'rgba(255,255,255,0.38)',
                                fontSize: '0.66rem',
                                fontWeight: 600,
                                lineHeight: 1.3,
                                display: 'block',
                              }}
                            >
                              {notif.time}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                color: 'rgba(255,255,255,0.58)',
                                fontSize: '0.74rem',
                                lineHeight: 1.35,
                                fontWeight: 500,
                                display: 'block',
                                mt: 0.5
                              }}
                            >
                              {notif.message}
                            </Typography>
                          </Box>

                          <IconButton
                            size="small"
                            aria-label="Dismiss alert"
                            onClick={(e) => dismissNotification(notif.id, e)}
                            sx={{
                              flexShrink: 0,
                              mt: -0.25,
                              color: 'rgba(255,255,255,0.25)',
                              width: 26,
                              height: 26,
                              borderRadius: '8px',
                              '&:hover': {
                                color: 'white',
                                bgcolor: 'rgba(255,255,255,0.06)',
                              },
                            }}
                          >
                            <CloseIcon size={11} />
                          </IconButton>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            ) : (
              /* If hasQuery is true, show Search Results */
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    {searchSurface.searchAcrossLabel}
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
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
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

                {(searchingPeople || peopleResults.length > 0) && (
                  <Box sx={{ display: 'grid', gap: 0.5 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                      People
                    </Typography>
                    {searchingPeople ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.8rem', px: 0.5 }}>
                        Searching...
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
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5 }}>
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
          disablePortal={false}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 360,
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
              Search Ecosystem
            </Typography>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
          
          <Box sx={{ flex: 1, overflowY: 'auto', mx: -2.75, px: 2.75 }}>
            {searchContent}
          </Box>
        </Drawer>
      );
    }

    return (
      <Box
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
        sx={{ px: { xs: 2.25, md: 4 }, py: 1.25, maxHeight: isDesktop ? 'calc(100vh - 120px)' : '45vh', overflowY: 'auto' }}
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

                <Box sx={{ display: 'grid', gap: 1.25, maxHeight: '58vh', overflowY: 'auto', pr: 0.5, pb: 0.5 }}>
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
                          '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.25)' }
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
          disablePortal={false}
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
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', letterSpacing: '0.02em', fontSize: '1.1rem' }}>
              Secure Space
            </Typography>
            <IconButton onClick={() => setProfileMenuAnchorEl(null)} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>

          {/* Scrollable Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', mx: -2.75, px: 2.75 }}>
            {/* User Profile Info Card */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1.75, p: 2, borderRadius: '26px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Box sx={{ position: 'relative' }}>
                <IdentityAvatar
                  userId={user?.$id}
                  size={88}
                  pro={isPro}
                  fallback={profileName.slice(0, 1).toUpperCase()}
                  borderRadius="26px"
                />
                {/* Active Indicator dot */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: '#10B981',
                    border: '2.5px solid #161412',
                  }}
                />
              </Box>

              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                  <Box
                    onClick={profileUsername ? handleCopyUsername : undefined}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.25,
                      py: 0.35,
                      borderRadius: '999px',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: profileUsername ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      '&:hover': profileUsername ? { bgcolor: 'rgba(255,255,255,0.08)' } : {},
                    }}
                  >
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.35 }}>
                      {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : profileName}
                    </Typography>
                    {profileUsername && (
                      <CopyIcon size={11} style={{ color: copyState === 'copied-username' ? '#10B981' : 'rgba(255, 255, 255, 0.3)' }} />
                    )}
                  </Box>
                </Box>

                {!isPro && (
                  <Button
                    onClick={() => {
                      setProfileMenuAnchorEl(null);
                      openProUpgrade();
                    }}
                    sx={{
                      width: '100%',
                      py: 1,
                      borderRadius: '12px',
                      bgcolor: '#6366F1',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      '&:hover': { bgcolor: '#5254E8' }
                    }}
                  >
                    Upgrade Pro
                  </Button>
                )}
              </Box>
            </Box>

            {/* System Identification details */}
            <Box sx={{ borderRadius: '22px', border: '1px solid rgba(255,255,255,0.04)', bgcolor: 'rgba(255,255,255,0.005)', p: 2 }}>
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75, display: 'block', lineHeight: 1.3 }}>
                System Key
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 600, minWidth: 0, flex: 1, wordBreak: 'break-all', lineHeight: 1.45 }}>
                  {profileSeed.userId || 'No ID'}
                </Typography>
                <IconButton
                  onClick={handleCopyUserId}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    color: copyState === 'copied-userid' ? '#10B981' : 'rgba(255, 255, 255, 0.3)',
                    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }
                  }}
                >
                  <CopyIcon size={12} />
                </IconButton>
              </Box>
            </Box>

            {/* Large styled navigation lists */}
            <Stack spacing={1.25}>
              <Button
                fullWidth
                onClick={() => {
                  handleCloseAll();
                  openWallet();
                }}
                variant="contained"
                sx={{
                  borderRadius: '16px',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: 'white',
                  py: 1.25,
                  px: 2.25,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 1.75,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)', transform: 'translateX(2px)' },
                }}
              >
                <Wallet size={16} style={{ color: appAccent }} />
                Manage Wallet
              </Button>

              <Button
                fullWidth
                onClick={() => {
                  handleCloseAll();
                  router.push('/settings');
                }}
                variant="contained"
                sx={{
                  borderRadius: '16px',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: 'white',
                  py: 1.25,
                  px: 2.25,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 1.75,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)', transform: 'translateX(2px)' },
                }}
              >
                <UserIcon size={16} style={{ color: '#F59E0B' }} />
                Account Settings
              </Button>

            </Stack>
          </Box>

          {/* Sign Out Button strictly aligned at the bottom */}
          <Box sx={{ mt: 'auto', pt: 2.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <Button
              fullWidth
              onClick={() => {
                handleCloseAll();
                void logout();
              }}
              variant="contained"
              sx={{
                borderRadius: '12px',
                bgcolor: 'rgba(255, 77, 77, 0.05)',
                border: '1px solid rgba(255, 77, 77, 0.12)',
                color: '#FF4D4D',
                py: 1.15,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.86rem',
                '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.12)', borderColor: 'rgba(255, 77, 77, 0.2)' },
              }}
            >
              Sign Out
            </Button>
          </Box>
        </Drawer>
      );
    }

    return (
      <Box
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
          disablePortal={false}
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
            onWheel={(event) => {
              const node = event.currentTarget;
              if (event.deltaY < 0 && isTopbarScrollAtTop(node)) {
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

            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {connectApps.map((item) => {
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
      { key: 'Ctrl + F', desc: 'Search Ecosystem / Notes' },
      { key: 'Ctrl + S', desc: 'Ecosystem Apps Directory' },
      { key: 'Ctrl + M', desc: 'Profile System Panel' },
      { key: 'Ctrl + A', desc: 'Agentic Assistant' },
      { key: 'Ctrl + K', desc: 'Keyboard Shortcuts Console' },
      { key: 'Ctrl + P', desc: 'Navigate to Projects' },
      { key: 'Ctrl + N', desc: 'Navigate to Notes' },
      { key: 'Ctrl + T', desc: 'Navigate to Tags' },
      { key: 'Ctrl + X', desc: 'Navigate to Settings' },
      { key: 'Ctrl + V', desc: 'Navigate to Vault' },
      { key: 'Ctrl + G', desc: 'Navigate to Goals' },
      { key: 'Ctrl + Q', desc: 'Navigate to Forms' },
      { key: 'Ctrl + E', desc: 'Navigate to Events' },
      { key: 'Ctrl + H', desc: 'Navigate to Calls / Huddles' },
    ];

    return (
      <Drawer
        anchor="bottom"
        open={shortcutsOpen}
        onClose={handleCloseAll}
        keepMounted={false}
        disablePortal={false}
        PaperProps={{
          sx: {
            bgcolor: '#161412',
            backgroundImage: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px 28px 0 0',
            boxShadow: '0 -16px 42px rgba(0,0,0,0.5)',
            maxHeight: '60vh',
            width: isDesktop ? 600 : '100%',
            mx: 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            p: 3,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
              <Sparkles size={16} />
            </Box>
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              System Shortcuts
            </Typography>
          </Box>
          <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
            <CloseIcon size={16} />
          </IconButton>
        </Box>

        {/* Shortcuts list */}
        <Box sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {shortcutsList.map((item) => (
              <Box 
                key={item.key} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  p: 1.5, 
                  borderRadius: '14px', 
                  bgcolor: 'rgba(255,255,255,0.01)', 
                  border: '1px solid rgba(255,255,255,0.03)' 
                }}
              >
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>
                  {item.desc}
                </Typography>
                <Typography sx={{ color: '#6366F1', fontSize: '0.74rem', fontWeight: 700, fontFamily: 'var(--font-mono)', bgcolor: 'rgba(99, 102, 241, 0.08)', px: 1, py: 0.5, borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.18)' }}>
                  {item.key}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Drawer>
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Box onClick={user ? openAppMenu : () => openUnified('login')} sx={{ cursor: 'pointer', flexShrink: 0 }}>
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
                      animate={{ width: isDesktop ? 520 : 'calc(100vw - 32px)', opacity: 1 }} 
                      exit={{ width: 44, opacity: 0 }} 
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                      style={{ position: 'relative', maxWidth: '100%' }}
                    >
                      <Paper elevation={0} sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, border: '1px solid rgba(99, 102, 241, 0.25)', bgcolor: '#161412', color: 'white', borderRadius: '24px', boxShadow: '0 0 26px rgba(99, 102, 241, 0.08), 0 0 0 4px rgba(99, 102, 241, 0.12)', overflow: 'hidden' }}>
                        {notifHint ? (
                            <Box 
                                onClick={toggleNotifications}
                                sx={{ 
                                    flex: 1, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1.5, 
                                    cursor: 'pointer',
                                    px: 0.5,
                                    animation: 'fadeIn 0.4s ease'
                                }}
                            >
                                <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: `${notifHint.accent}12`, color: notifHint.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <Sparkles size={16} strokeWidth={2.5} />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.82rem', lineHeight: 1.1, textTransform: 'uppercase' }} noWrap>{notifHint.title}</Typography>
                                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.72rem', lineHeight: 1.2 }} noWrap>{notifHint.description}</Typography>
                                </Box>
                                <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            </Box>
                        ) : (
                            <>
                                <Search size={16} strokeWidth={2.5} style={{ opacity: 0.6, flexShrink: 0 }} />
                                <InputBase 
                                    inputRef={searchInputRef} 
                                    value={searchQuery} 
                                    onChange={(e) => setSearchQuery(e.target.value)} 
                                    placeholder="Search ecosystem..." 
                                    sx={{ flex: 1, color: 'white', fontWeight: 800, fontSize: '0.9rem', '& input::placeholder': { color: 'white/20' } }} 
                                />
                            </>
                        )}
                        
                        {/* 🔔 Notifications CTA - The Island Extension */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Box sx={{ width: 1, height: 20, bgcolor: 'white/10', mx: 0.5 }} />
                            <IconButton 
                                onClick={(e) => {
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
                        
                        <IconButton size="small" onClick={() => setSearchOpen(false)} sx={{ color: 'white/40' }}><CloseIcon size={16} /></IconButton>
                      </Paper>
                    </motion.div>
                  ) : isMounted ? (
                    <motion.div 
                      key="island-rest"
                      initial={{ scale: 0.8, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }} 
                      whileHover={{ scale: 1.05 }} 
                      onClick={openSearch} 
                      style={{ cursor: 'pointer' }}
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
                        <Search size={18} strokeWidth={2.5} />
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                        {unreadNotifCount > 0 && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#EC4899', ml: -0.5 }} />}
                      </Box>
                    </motion.div>
                  ) : (
                    <div 
                      onClick={openSearch} 
                      style={{ cursor: 'pointer' }}
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
                        <Search size={18} strokeWidth={2.5} />
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: 'var(--font-satoshi)', fontWeight: 600, fontSize: '0.8rem' }}>Search</Typography>
                        {unreadNotifCount > 0 && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#EC4899', ml: -0.5 }} />}
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
                    <IconButton onClick={() => openAgenticDrawer()} sx={{ color: appAccent, bgcolor: '#0A0908', border: '1px solid', borderColor: alpha(appAccent, 0.2), borderRadius: '50%', width: 38, height: 38, boxShadow: `0 8px 22px ${alpha(appAccent, 0.15)}`, '&:hover': { bgcolor: '#111' } }}>
                      <Bot size={16} strokeWidth={2} />
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
                  <Button onClick={() => openUnified('login')} sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 900, borderRadius: '12px', px: 2.5, py: 1, '&:hover': { bgcolor: '#5254E8' } }}>{isAuthenticating ? <CircularProgress size={16} color="inherit" /> : 'Connect'}</Button>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>

        {renderSearchPanel()}
        {renderNotificationDrawer()}
        {renderAppPanel()}
        {renderProfilePanel()}
        {renderShortcutsPanel()}
      </AppBar>
    </>
  );
}
