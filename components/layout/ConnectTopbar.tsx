'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { useAuth } from '@/lib/auth';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { getUserProfilePicId } from '@/lib/utils';
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
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useLocalContext } from '@/lib/context-engine';

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
  const isPro = hasPaidKylrixPlan(user);
  const router = useRouter();
  const pathname = usePathname();
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const activeApp = useMemo<KylrixApp>(() => {
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    if (pathname?.startsWith('/send')) return 'send';
    return 'kylrix';
  }, [pathname]);

  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied-userid' | 'copied-username'>('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const { events, suggestions, dismissSuggestion } = useLocalContext();
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

  const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);
  const tone = getAppTone(activeApp);
  const appAccent = getAppColor(activeApp);
  const profileName = user?.name || user?.email || 'User';
  const profileUsername = (user as any)?.username || (user as any)?.prefs?.username || null;
  
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
  }, []);

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
        { id: 'create-note', title: 'Write a New Note', description: 'Create a private note inside your workspace', href: '/note/notes', kind: 'note', accent: '#EC4899' },
        { id: 'view-settings', title: 'Security Preferences', description: 'Adjust your notes security & encryption rules', href: '/settings', kind: 'system', accent: '#6366F1' }
      ],
      projects: [
        { id: 'create-proj', title: 'Start Fresh Project', description: 'Spin up outcome-aware container', href: '/projects', kind: 'flow', accent: '#6366F1' },
        { id: 'view-wf', title: 'Manage Action Workflows', description: 'Automate repetitive workflows', href: '/projects/workflows', kind: 'note', accent: '#A855F7' }
      ],
      flow: [
        { id: 'manage-tasks', title: 'View Outstanding Tasks', description: 'Review scheduled deliverables and actions', href: '/flow/tasks', kind: 'flow', accent: '#A855F7' }
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
        href: '/note/notes',
        kind: 'note',
        accent: '#EC4899'
      });
    } else if (topNiche === 'productivity' && activeApp !== 'flow') {
      historicalSuggestions.push({
        id: 'hist-flow',
        title: 'Coordinate Action Items',
        description: 'Manage outstanding roadmaps and deliverables',
        href: '/flow/tasks',
        kind: 'flow',
        accent: '#A855F7'
      });
    } else if (topNiche === 'security' && activeApp !== 'vault') {
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
    () =>
      createEcosystemPanelItems(activeApp).map((item) => ({
        ...item,
        href: getEcosystemUrl(item.app),
      })),
    [activeApp],
  );

  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = searchOpen ? 'search' : profileMenuAnchorEl ? 'profile' : appMenuAnchorEl ? 'ecosystem' : null;

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 2 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <Logo app={activeApp} size={16} variant="icon" />
              </Box>
              <TextField
                id="topbar-search-field"
                inputRef={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search ecosystem"
                variant="standard"
                fullWidth
                autoFocus
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.38)', opacity: 1 },
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', mr: 0.5 }}>
                        Search
                      </Typography>
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        <CloseIcon size={14} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ flex: 1, minWidth: { xs: '100%', md: 320 } }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    handleCloseAll();
                  }
                }}
              />
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
                            <Avatar
                              src={person.avatar || undefined}
                              sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '0.75rem', fontWeight: 800 }}
                            >
                              {(person.displayName || person.name || String(person.username || person.prefs?.username || 'U').replace(/^@+/, '') || 'U')[0].toUpperCase()}
                            </Avatar>
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
          disablePortal={true}
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
                    src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl : null}
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
                        {profileName}
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
                          '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' }
                        }}
                      >
                        <UserIcon size={16} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Typography component="span" sx={{ color: alpha('#fff', 0.58), fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35, minWidth: 0, flex: 1 }} noWrap>
                        {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : 'profile'}
                      </Typography>
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

                <Button
                  onClick={handleOpenFullProfile}
                  disabled={!profileSeed.username}
                  variant="contained"
                  sx={{
                    width: '100%',
                    borderRadius: '14px',
                    px: 2,
                    py: 1.15,
                    textTransform: 'none',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    bgcolor: appAccent,
                    color: '#000',
                    '&:hover': { bgcolor: alpha(appAccent, 0.86) },
                    '&.Mui-disabled': { bgcolor: alpha(appAccent, 0.22), color: 'rgba(255,255,255,0.5)' },
                  }}
                >
                  See full profile
                </Button>
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
                <Avatar
                  src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl || undefined : undefined}
                  sx={{ width: 88, height: 88, bgcolor: tone.secondary, color: '#fff', fontWeight: 900, fontSize: '1.75rem', borderRadius: '26px', border: `1.5px solid ${alpha(appAccent, 0.15)}` }}
                >
                  {profileName.slice(0, 1).toUpperCase()}
                </Avatar>
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
                <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', lineHeight: 1.15 }}>
                  {profileName}
                </Typography>
                
                {profileUsername && (
                  <Box
                    onClick={handleCopyUsername}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      alignSelf: 'center',
                      gap: 0.5,
                      px: 1.25,
                      py: 0.35,
                      borderRadius: '999px',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                    }}
                  >
                    <Typography component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.35 }}>
                      @{String(profileUsername).replace(/^@+/, '')}
                    </Typography>
                    <CopyIcon size={11} style={{ color: copyState === 'copied-username' ? '#10B981' : 'rgba(255, 255, 255, 0.3)' }} />
                  </Box>
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

              <Button
                fullWidth
                onClick={handleOpenFullProfile}
                disabled={!profileSeed.username}
                variant="contained"
                sx={{
                  borderRadius: '16px',
                  bgcolor: appAccent,
                  color: '#000',
                  py: 1.35,
                  px: 2.25,
                  mt: 1,
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'center',
                  '&:hover': { bgcolor: alpha(appAccent, 0.86), transform: 'translateY(-1px)' },
                  '&.Mui-disabled': { bgcolor: alpha(appAccent, 0.12), color: 'rgba(255,255,255,0.25)' },
                }}
              >
                See Full Profile
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
          disablePortal={true}
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
          height: activePanel ? 'auto' : '88px',
        }}
      >
        <SyncIndicator />
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 }, width: '100%' }}>
          <Box
            sx={{
              minHeight: TOPBAR_LAYOUT.height,
              display: activePanel ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 1.25, md: 2 },
            }}
          >
            <Box
              component="div"
              role="button"
              tabIndex={0}
              onClick={user ? openAppMenu : () => openUnified('login')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (user) {
                    setAppMenuAnchorEl(event.currentTarget as HTMLElement);
                  } else {
                    openUnified('login');
                  }
                }
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Logo app={activeApp} size={32} variant={isDesktop ? 'full' : 'icon'} />
            </Box>

            {user ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {searchOpen ? (
                  <Paper
                    elevation={0}
                    sx={{
                      width: { xs: 'calc(100vw - 32px)', sm: 420, md: 520 },
                      maxWidth: 'calc(100vw - 32px)',
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 0,
                      border: '1px solid rgba(255,255,255,0.08)',
                      bgcolor: '#000',
                      color: 'white',
                      borderRadius: '24px',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 26px rgba(0,0,0,0.55)',
                    }}
                  >
                    <Search size={16} strokeWidth={2.25} style={{ flexShrink: 0, opacity: 0.84 }} />
                    <InputBase
                      id="topbar-search-input"
                      inputRef={searchInputRef}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search people, notes, apps..."
                      sx={{
                        flex: 1,
                        color: 'white',
                        fontWeight: 800,
                        '& input::placeholder': { color: 'rgba(255,255,255,0.42)', opacity: 1 },
                      }}
                    />
                    <IconButton size="small" onClick={() => setSearchOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      <CloseIcon size={16} />
                    </IconButton>
                  </Paper>
                ) : (
                  <Button
                    onClick={openSearch}
                    sx={{
                      width: { xs: 44, md: 170 },
                      minWidth: { xs: 44, md: 170 },
                      maxWidth: { xs: 44, md: 170 },
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0,
                      minHeight: 44,
                      border: '1px solid rgba(255,255,255,0.08)',
                      bgcolor: '#000',
                      color: 'white',
                      borderRadius: '999px',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 26px rgba(0,0,0,0.55)',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#0f0f0f', transform: 'translateY(-1px)' },
                    }}
                  >
                    <Search size={16} strokeWidth={2.25} />
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 800 }}>
                      Search
                    </Typography>
                  </Button>
                )}
              </Box>
            ) : (
              <Box sx={{ flex: 1 }} />
            )}

            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
              {isClient && (
                <>
                  {!user && (
                    <Button
                      onClick={() => openUnified('login')}
                      disabled={isAuthenticating}
                      sx={{
                        color: '#fff',
                        bgcolor: '#6366F1',
                        borderRadius: '12px',
                        minWidth: { xs: 40, md: 98 },
                        height: 40,
                        px: { xs: 1.25, md: 2 },
                        textTransform: 'none',
                        fontWeight: 800,
                        boxShadow: '0 16px 36px rgba(99, 102, 241, 0.25)',
                        '&:hover': { bgcolor: '#5254E8' }
                      }}
                    >
                      {isAuthenticating ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <>
                          <Box component="span" sx={{ display: { xs: 'inline-flex', md: 'none' }, alignItems: 'center' }}>
                            <Sparkles size={15} />
                          </Box>
                          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                            Connect
                          </Box>
                        </>
                      )}
                    </Button>
                  )}
                  {user && (
                    <Tooltip title="Smart Systems">
                      <IconButton
                        aria-label="Open smart systems"
                        onClick={() => openAgenticDrawer()}
                        sx={{
                          color: getAppColor(activeApp),
                          bgcolor: '#0A0908',
                          border: '1px solid',
                          borderColor: alpha(getAppColor(activeApp), 0.24),
                          borderRadius: '999px',
                          width: 38,
                          height: 38,
                          boxShadow: `0 8px 22px ${alpha(getAppColor(activeApp), 0.18)}`,
                          '&:hover': { bgcolor: '#13110F', borderColor: alpha(getAppColor(activeApp), 0.36) },
                        }}
                      >
                        <Bot size={16} strokeWidth={1.8} />
                      </IconButton>
                    </Tooltip>
                  )}

                  {user && (
                    <ButtonBase
                      onClick={openProfileMenu}
                      sx={{
                        p: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        '&:hover': { transform: 'scale(1.05)' },
                        transition: 'transform 0.2s',
                      }}
                    >
                      <IdentityAvatar
                        src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl : null}
                        size={38}
                        pro={isPro}
                        fallback={profileName.slice(0, 1).toUpperCase()}
                        sx={{
                          bgcolor: profileAvatarUrl ? 'rgba(255,255,255,0.04)' : tone.secondary,
                        }}
                      />
                    </ButtonBase>
                  )}
                </>
              )}
            </Stack>
          </Box>
        </Box>

        {renderSearchPanel()}
        {renderAppPanel()}
        {renderProfilePanel()}
      </AppBar>
    </>
  );
}
