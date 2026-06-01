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
} from '@mui/material';
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
  const profileName = user?.name || user?.email || 'User';
  const profileUsername = (user as any)?.username || (user as any)?.prefs?.username || null;
  
  const [isClient, setIsClient] = useState(false);
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
        href: '/note/notes',
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
            px: isDesktop ? 0 : { xs: 2, md: 4 },
            py: isDesktop ? 0 : 1.5,
            maxHeight: isDesktop ? 'none' : TOPBAR_LAYOUT.searchDockMaxHeight,
            overflowY: isDesktop ? 'visible' : 'auto',
          }}
        >
          {!isDesktop && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <Logo app={activeApp} size={18} variant="icon" />
              </Box>
              <TextField
                id="topbar-search-field"
                inputRef={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes, tags, shared links, people"
                variant="standard"
                fullWidth
                autoFocus
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.42)', opacity: 1 },
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ color: 'rgba(255,255,255,0.42)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mr: 0.5 }}>
                        Search
                      </Typography>
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        <CloseIcon size={16} />
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

          <Stack spacing={2} sx={{ mt: isDesktop ? 0 : 2 }}>
            {!hasQuery ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', md: '1.2fr 1fr' },
                  gap: 3,
                }}
              >
                {/* Left Column: Contextual Action Flow & Proactive Insights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Proactive Confident AI Suggestions if any */}
                  {suggestions.length > 0 && (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Sparkles size={13} style={{ color: '#6366F1' }} />
                        Smart Assistant Insights
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1.25 }}>
                        {suggestions.map((suggestion) => (
                          <Box
                            key={suggestion.id}
                            sx={{
                              p: 2,
                              borderRadius: '20px',
                              bgcolor: 'rgba(99, 102, 241, 0.05)',
                              border: '1px solid rgba(99, 102, 241, 0.15)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1.5,
                              position: 'relative',
                              overflow: 'hidden',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'rgba(99, 102, 241, 0.08)',
                                borderColor: 'rgba(99, 102, 241, 0.25)',
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                              <Box sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '12px',
                                bgcolor: 'rgba(99, 102, 241, 0.12)',
                                color: '#6366F1',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0
                              }}>
                                <Bot size={18} />
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem', mb: 0.25 }}>
                                  {suggestion.title}
                                </Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.76rem', lineHeight: 1.3 }}>
                                  {suggestion.description}
                                </Typography>
                              </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', zIndex: 1 }}>
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissSuggestion(suggestion.id);
                                }}
                                sx={{
                                  color: 'rgba(255,255,255,0.42)',
                                  textTransform: 'none',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  borderRadius: '10px',
                                  px: 1.5,
                                  '&:hover': { color: '#FF4D4D', bgcolor: 'rgba(255, 77, 77, 0.08)' }
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
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    borderRadius: '10px',
                                    px: 2,
                                    '&:hover': { bgcolor: '#5254E8' }
                                  }}
                                >
                                  {suggestion.actionLabel || 'Run Action'}
                                </Button>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Contextual Suggestions */}
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Activity size={13} style={{ color: '#F59E0B' }} />
                      Contextual Quick Actions
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {dynamicQuickActions.length === 0 ? (
                        <Box sx={{ p: 2, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                            No live suggestions available yet. Explore the apps to build context!
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
                              gap: 1.5,
                              px: 2,
                              py: 1.25,
                              borderRadius: '18px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.05)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                transform: 'translateX(3px)'
                              }
                            }}
                          >
                            <Box sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '12px',
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: `${action.accent}14`,
                              color: action.accent,
                              flexShrink: 0
                            }}>
                              <Logo app={action.kind as any} size={16} variant="icon" />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.2 }}>
                                {action.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.76rem', mt: 0.25 }}>
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Bell size={13} style={{ color: '#EC4899' }} />
                      Diagnostics & Alerts
                    </Typography>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <Box sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: '8px',
                        bgcolor: '#6366F1',
                        color: 'white',
                        fontSize: '0.68rem',
                        fontWeight: 900
                      }}>
                        {notifications.filter(n => !n.read).length} New
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {notifications.length === 0 ? (
                      <Box sx={{ p: 2.5, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                          No diagnostics alerts at the moment. System is stable.
                        </Typography>
                      </Box>
                    ) : (
                      notifications.map((notif) => (
                        <Box
                          key={notif.id}
                          onClick={() => markNotificationRead(notif.id)}
                          sx={{
                            p: 1.75,
                            borderRadius: '18px',
                            bgcolor: notif.read ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                            border: '1px solid',
                            borderColor: notif.read ? 'rgba(255,255,255,0.03)' : alpha(notif.accent, 0.25),
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            '&:hover': {
                              bgcolor: 'rgba(255,255,255,0.05)',
                              borderColor: notif.read ? 'rgba(255,255,255,0.08)' : alpha(notif.accent, 0.4),
                            }
                          }}
                        >
                          {!notif.read && (
                            <Box sx={{
                              position: 'absolute',
                              top: 18,
                              left: 12,
                              width: 8,
                              height: 8,
                              borderRadius: '999px',
                              bgcolor: notif.accent
                            }} />
                          )}
                          
                          <Box sx={{ pl: notif.read ? 0 : 2, pr: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography sx={{
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '0.84rem',
                                opacity: notif.read ? 0.7 : 1
                              }}>
                                {notif.title}
                              </Typography>
                              <Typography sx={{
                                color: 'rgba(255,255,255,0.36)',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                ml: 'auto'
                              }}>
                                {notif.time}
                              </Typography>
                            </Box>
                            <Typography sx={{
                              color: 'rgba(255,255,255,0.5)',
                              fontSize: '0.76rem',
                              lineHeight: 1.3,
                              fontWeight: 500
                            }}>
                              {notif.message}
                            </Typography>
                          </Box>

                          <IconButton
                            size="small"
                            onClick={(e) => dismissNotification(notif.id, e)}
                            sx={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              color: 'rgba(255,255,255,0.3)',
                              width: 24,
                              height: 24,
                              borderRadius: '8px',
                              '&:hover': {
                                color: 'white',
                                bgcolor: 'rgba(255,255,255,0.08)'
                              }
                            }}
                          >
                            <CloseIcon size={12} />
                          </IconButton>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            ) : (
              /* If hasQuery is true, show Search Results */
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {searchSurface.searchAcrossLabel}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
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
                          px: 1.5,
                          py: 1.1,
                          borderRadius: '18px',
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                        }}
                      >
                        <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}1F`, color: action.accent, flexShrink: 0 }}>
                          <Logo app={action.kind as any} size={16} variant="icon" />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                            {action.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                            {action.description}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {(searchingPeople || peopleResults.length > 0) && (
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      People
                    </Typography>
                    {searchingPeople ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.84rem' }}>
                        Searching people...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'grid', gap: 1 }}>
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
                              px: 1.5,
                              py: 1.1,
                              borderRadius: '18px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                            }}
                          >
                            <Avatar
                              src={person.avatar || undefined}
                              sx={{ width: 32, height: 32, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.8rem', fontWeight: 800 }}
                            >
                              {(person.displayName || person.name || String(person.username || person.prefs?.username || 'U').replace(/^@+/, '') || 'U')[0].toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                                {person.displayName || person.name}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
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
              width: 380,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff' }}>
              Search Ecosystem
            </Typography>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
              <CloseIcon size={18} />
            </IconButton>
          </Box>
          
          <Box sx={{ flex: 1, overflowY: 'auto', mx: -3, px: 3 }}>
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
          bgcolor: '#161412',
          overflow: 'hidden',
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
        sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: isDesktop ? 'calc(100vh - 120px)' : TOPBAR_LAYOUT.searchDockMaxHeight, overflowY: 'auto' }}
      >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              borderRadius: '30px',
              bgcolor: '#161412',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '14px', display: 'grid', placeItems: 'center', color: '#F59E0B', bgcolor: alpha('#F59E0B', 0.08), border: `1px solid ${alpha('#F59E0B', 0.24)}` }}>
                    <Logo app="connect" size={18} variant="icon" />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.1 }}>
                      {profileName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha('#fff', 0.52), fontWeight: 700 }}>
                      Profile & Messaging
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={handleCloseAll} size="small" sx={{ width: 34, height: 34, borderRadius: '999px', color: alpha('#fff', 0.9), bgcolor: alpha('#fff', 0.06), border: '1px solid rgba(255,255,255,0.08)' }}>
                  ✕
                </IconButton>
              </Box>

              <Box sx={{ display: 'grid', gap: 1.25, maxHeight: '58vh', overflowY: 'auto', pr: 0.5, pb: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar
                    src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl || undefined : undefined}
                    sx={{ width: 104, height: 104, bgcolor: tone.secondary, color: '#fff', fontWeight: 900, borderRadius: '28px', flexShrink: 0 }}
                  >
                    {profileName.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', lineHeight: 1.05, minWidth: 0, flex: 1 }} noWrap>
                        {profileName}
                      </Typography>
                      <IconButton
                        onClick={handleOpenFullProfile}
                        disabled={!profileSeed.username}
                        size="small"
                        sx={{
                          flexShrink: 0,
                          width: 32,
                          height: 32,
                          color: 'rgba(255, 255, 255, 0.6)',
                          '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
                          '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' }
                        }}
                      >
                        <UserIcon size={18} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Typography sx={{ color: alpha('#fff', 0.62), fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.35, minWidth: 0, flex: 1 }} noWrap>
                        {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : 'profile'}
                      </Typography>
                      {profileUsername && (
                        <IconButton
                          onClick={handleCopyUsername}
                          size="small"
                          title={copyState === 'copied-username' ? 'Copied!' : 'Copy username'}
                          sx={{
                            flexShrink: 0,
                            width: 28,
                            height: 28,
                            color: copyState === 'copied-username' ? '#10B981' : 'rgba(255, 255, 255, 0.4)',
                            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' }
                          }}
                        >
                          <CopyIcon size={14} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ borderRadius: '22px', border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)', p: 1.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75 }}>
                    Identity
                  </Typography>
                  
                  {/* UserId section with copy button */}
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <Typography sx={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, minWidth: 0, flex: 1, wordBreak: 'break-all' }}>
                      {shortenUserId(profileSeed.userId) || 'No ID'}
                    </Typography>
                    <IconButton
                      onClick={handleCopyUserId}
                      size="small"
                      title={copyState === 'copied-userid' ? 'Copied!' : 'Copy user ID'}
                      sx={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        color: copyState === 'copied-userid' ? '#10B981' : 'rgba(255, 255, 255, 0.4)',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' }
                      }}
                    >
                      <CopyIcon size={14} />
                    </IconButton>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    onClick={() => {
                      handleCloseAll();
                        openWallet();
                    }}
                    sx={{
                      minWidth: 0,
                      flex: '1 1 180px',
                      borderRadius: '16px',
                      bgcolor: alpha(getAppColor('connect'), 0.09),
                      color: getAppColor('connect'),
                      px: 1.5,
                      py: 1.15,
                      textTransform: 'none',
                      '&:hover': { bgcolor: alpha(getAppColor('connect'), 0.15) },
                    }}
                    startIcon={<Wallet size={16} />}
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
                      flex: '1 1 180px',
                      borderRadius: '16px',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      color: 'white',
                      px: 1.5,
                      py: 1.15,
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
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
                      flex: '1 1 180px',
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 77, 77, 0.08)',
                      color: '#FF4D4D',
                      px: 1.5,
                      py: 1.15,
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.14)' },
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
                    borderRadius: '16px',
                    px: 2,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 900,
                    bgcolor: '#F59E0B',
                    color: '#000',
                    '&:hover': { bgcolor: alpha('#F59E0B', 0.86) },
                    '&.Mui-disabled': { bgcolor: 'rgba(245,158,11,0.28)', color: 'rgba(255,255,255,0.6)' },
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
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
              Secure Space
            </Typography>
            <IconButton onClick={() => setProfileMenuAnchorEl(null)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <CloseIcon size={18} />
            </IconButton>
          </Box>

          {/* Scrollable Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3.5, overflowY: 'auto' }}>
            {/* User Profile Info Card */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2, p: 2, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl || undefined : undefined}
                  sx={{ width: 96, height: 96, bgcolor: tone.secondary, color: '#fff', fontWeight: 900, fontSize: '2rem', borderRadius: '28px', border: `2px solid ${alpha(getAppColor('connect'), 0.2)}` }}
                >
                  {profileName.slice(0, 1).toUpperCase()}
                </Avatar>
                {/* Active Indicator dot */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: '#10B981',
                    border: '3px solid #161412',
                  }}
                />
              </Box>

              <Box sx={{ width: '100%' }}>
                <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.25rem', mb: 0.5 }}>
                  {profileName}
                </Typography>
                
                {profileUsername && (
                  <Box
                    onClick={handleCopyUsername}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '999px',
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.82rem' }}>
                      @{String(profileUsername).replace(/^@+/, '')}
                    </Typography>
                    <CopyIcon size={12} style={{ color: copyState === 'copied-username' ? '#10B981' : 'rgba(255, 255, 255, 0.4)' }} />
                  </Box>
                )}
              </Box>
            </Box>

            {/* System Identification details */}
            <Box sx={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.01)', p: 2 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1 }}>
                System Key
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, minWidth: 0, flex: 1, wordBreak: 'break-all' }}>
                  {profileSeed.userId || 'No ID'}
                </Typography>
                <IconButton
                  onClick={handleCopyUserId}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: copyState === 'copied-userid' ? '#10B981' : 'rgba(255, 255, 255, 0.4)',
                    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' }
                  }}
                >
                  <CopyIcon size={13} />
                </IconButton>
              </Box>
            </Box>

            {/* Large styled navigation lists */}
            <Stack spacing={1.5}>
              <Button
                fullWidth
                onClick={() => {
                  handleCloseAll();
                  openWallet();
                }}
                variant="contained"
                sx={{
                  borderRadius: '16px',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'white',
                  py: 1.5,
                  px: 2.5,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 2,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <Wallet size={18} style={{ color: getAppColor('connect') }} />
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
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'white',
                  py: 1.5,
                  px: 2.5,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 2,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <UserIcon size={18} style={{ color: '#F59E0B' }} />
                Account Settings
              </Button>

              <Button
                fullWidth
                onClick={handleOpenFullProfile}
                disabled={!profileSeed.username}
                variant="contained"
                sx={{
                  borderRadius: '16px',
                  bgcolor: '#F59E0B',
                  color: '#000',
                  py: 1.5,
                  px: 2.5,
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  display: 'flex',
                  justifyContent: 'center',
                  '&:hover': { bgcolor: alpha('#F59E0B', 0.86) },
                  '&.Mui-disabled': { bgcolor: 'rgba(245,158,11,0.15)', color: 'rgba(255,255,255,0.3)' },
                }}
              >
                See Full Profile
              </Button>
            </Stack>
          </Box>

          {/* Sign Out Button strictly aligned at the bottom */}
          <Box sx={{ mt: 'auto', pt: 3, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Button
              fullWidth
              onClick={() => {
                handleCloseAll();
                void logout();
              }}
              variant="contained"
              sx={{
                borderRadius: '14px',
                bgcolor: 'rgba(255, 77, 77, 0.08)',
                border: '1px solid rgba(255, 77, 77, 0.15)',
                color: '#FF4D4D',
                py: 1.25,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.88rem',
                '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.16)', borderColor: 'rgba(255, 77, 77, 0.25)' },
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
          borderTop: '1px solid rgba(255,255,255,0.05)',
          bgcolor: '#161412',
          overflow: 'hidden',
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
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff' }}>
              Ecosystem Apps
            </Typography>
            <IconButton onClick={() => setAppMenuAnchorEl(null)} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white' } }}>
              <CloseIcon size={18} />
            </IconButton>
          </Box>
          
          {/* App List */}
          <Stack spacing={1.5} sx={{ overflowY: 'auto', flex: 1 }}>
            {connectApps.map((item) => {
              const appTone = getAppTone(item.app);
              return (
                <Button
                  key={item.href}
                  fullWidth
                  onClick={() => {
                    handleCloseAll();
                    if (!user && item.app !== 'kylrix') {
                      openUnified('login');
                    } else {
                      router.push(item.href);
                    }
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 2,
                    py: 1.5,
                    borderRadius: '16px',
                    color: '#fff',
                    textTransform: 'none',
                    bgcolor: item.selected ? alpha(appTone.secondary, 0.08) : 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: alpha(appTone.secondary, 0.12),
                      borderColor: alpha(appTone.secondary, 0.24),
                      transform: 'translateX(4px)',
                    }
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha(appTone.secondary, 0.08), color: appTone.secondary, flexShrink: 0 }}>
                      <Logo app={item.app} size={16} variant="icon" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                        {item.label}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Button>
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
        <Box sx={{ width: '100%', bgcolor: '#161412', overflow: 'hidden' }}>
          <Box
            onWheel={(event) => {
              const node = event.currentTarget;
              if (event.deltaY < 0 && isTopbarScrollAtTop(node)) {
                event.preventDefault();
                handleCloseAll();
              }
            }}
            sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: TOPBAR_LAYOUT.searchDockMaxHeight, overflowY: 'auto' }}
          >
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {connectApps.map((item) => {
                const appTone = getAppTone(item.app);
                return (
                  <Button
                    key={item.href}
                    fullWidth
                    onClick={() => {
                      handleCloseAll();
                      if (!user && item.app !== 'kylrix') {
                        openUnified('login');
                      } else {
                        router.push(item.href);
                      }
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      px: 1.5,
                      py: 1.1,
                      borderRadius: '18px',
                      color: 'white',
                      bgcolor: item.selected ? alpha('#F59E0B', 0.08) : 'rgba(255,255,255,0.02)',
                      border: '1px solid transparent',
                      '&:hover': {
                        bgcolor: alpha('#F59E0B', 0.12),
                        borderColor: alpha('#F59E0B', 0.24),
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha(appTone.secondary, 0.08), color: appTone.secondary, flexShrink: 0 }}>
                        <Logo app={item.app} size={16} variant="icon" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                          {item.label}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                          {item.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </Button>
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
        className={className}
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
              onClick={openAppMenu}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setAppMenuAnchorEl(event.currentTarget as HTMLElement);
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
              <Logo app={activeApp} size={32} />
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  right: -6,
                  bottom: -6,
                  width: 18,
                  height: 18,
                  bgcolor: '#0A0908',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.55)',
                  '&:hover': { bgcolor: '#161412', color: 'white' },
                }}
              >
                <ChevronDown size={11} />
              </IconButton>
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
                        minWidth: 98,
                        height: 40,
                        px: 2,
                        textTransform: 'none',
                        fontWeight: 800,
                        boxShadow: '0 16px 36px rgba(99, 102, 241, 0.25)',
                        '&:hover': { bgcolor: '#5254E8' }
                      }}
                    >
                      {isAuthenticating ? <CircularProgress size={16} color="inherit" /> : 'Connect'}
                    </Button>
                  )}
                  {user && (
                    <Tooltip title="Smart Systems">
                      <IconButton
                        onClick={() => openAgenticDrawer()}
                        sx={{
                          color: getAppColor(activeApp),
                          bgcolor: alpha(getAppColor(activeApp), 0.03),
                          border: '1px solid',
                          borderColor: alpha(getAppColor(activeApp), 0.1),
                          borderRadius: '12px',
                          width: 42,
                          height: 42,
                          '&:hover': { bgcolor: alpha(getAppColor(activeApp), 0.08) },
                        }}
                      >
                        <Bot size={18} strokeWidth={1.5} />
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
                      <Avatar
                        src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl || undefined : undefined}
                        sx={{
                          width: 38,
                          height: 38,
                          bgcolor: profileAvatarUrl ? 'rgba(255,255,255,0.04)' : tone.secondary,
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: '12px',
                        }}
                      >
                        {profileName.slice(0, 1).toUpperCase()}
                      </Avatar>
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
