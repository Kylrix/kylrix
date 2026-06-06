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
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
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
  
  // Dynamic Island Search & Notification State
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
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

  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

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
    setNotificationsOpen(false);
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
  }, []);

  const openAppMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setNotificationsOpen(false);
    setSearchOpen(false);
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setNotificationsOpen(false);
    setSearchOpen(false);
    setAppMenuAnchorEl(null);
    setProfileMenuAnchorEl(event.currentTarget);
    setCopyState('idle');
  }, []);

  const toggleNotifications = useCallback(() => {
    setSearchOpen(true); // Ensure search is expanded as the host
    setAppMenuAnchorEl(null);
    setProfileMenuAnchorEl(null);
    setNotificationsOpen(prev => !prev);
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
        id: 'hist-note', title: 'Review Recent Notes', description: 'Resume writing your workspace notes?', href: '/note/notes', kind: 'note', accent: '#EC4899'
      });
    } else if (topNiche === 'productivity' && activeApp !== 'flow') {
      historicalSuggestions.push({
        id: 'hist-flow', title: 'Coordinate Action Items', description: 'Manage outstanding roadmaps and deliverables', href: '/flow/tasks', kind: 'flow', accent: '#A855F7'
      });
    } else if (topNiche === 'security' && activeApp !== 'vault') {
      historicalSuggestions.push({
        id: 'hist-vault', title: 'Audit Vault Keychain', description: 'Manage passwords and TOTP codes safely', href: '/vault/sharing', kind: 'vault', accent: '#10B981'
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

  // activePanel determines if the Topbar should expand (accordion) or show standard drawers
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

  const renderSearchPanel = () => {
    if (!searchOpen || notificationsOpen) return null;

    const query = searchQuery.trim().toLowerCase();
    const hasQuery = query.length >= 2;

    const searchContent = (
        <Box sx={{ width: '100%', px: isDesktop ? 0 : { xs: 2.25, md: 4 }, py: isDesktop ? 0 : 1.25, maxHeight: isDesktop ? 'none' : '45vh', overflowY: isDesktop ? 'visible' : 'auto' }}>
          <Stack spacing={2} sx={{ mt: isDesktop ? 0 : 1.5 }}>
            {!hasQuery ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', md: '1.2fr 1fr' }, gap: 2.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {suggestions.length > 0 && (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
                        <Sparkles size={11} style={{ color: '#6366F1' }} />
                        Smart Insights
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        {suggestions.map((suggestion) => (
                          <Box key={suggestion.id} sx={{ p: 1.75, borderRadius: '22px', bgcolor: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.12)', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                            <Box sx={{ display: 'flex', gap: 1.25 }}>
                              <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                <Bot size={16} />
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.84rem' }}>{suggestion.title}</Typography>
                                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem' }}>{suggestion.description}</Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                              <Button size="small" onClick={(e) => { e.stopPropagation(); dismissSuggestion(suggestion.id); }} sx={{ color: 'rgba(255,255,255,0.35)', textTransform: 'none', fontSize: '0.7rem', fontWeight: 700 }}>Cancel</Button>
                              {suggestion.actionHref && (
                                <Button size="small" onClick={() => { handleCloseAll(); router.push(suggestion.actionHref!); }} variant="contained" sx={{ bgcolor: '#6366F1', color: 'white', textTransform: 'none', fontSize: '0.7rem', fontWeight: 800 }}>{suggestion.actionLabel || 'Run'}</Button>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
                      <Activity size={11} style={{ color: '#F59E0B' }} />
                      Quick Actions
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {dynamicQuickActions.map((action) => (
                        <Box key={action.id} component="button" onClick={() => { handleCloseAll(); router.push(action.href); }} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', transform: 'translateX(2px)' } }}>
                          <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}12`, color: action.accent, flexShrink: 0 }}><Logo app={action.kind as any} size={15} variant="icon" /></Box>
                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, pr: 0.5, textAlign: 'left' }}>
                            <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem' }} noWrap>{action.title}</Typography>
                            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, fontSize: '0.74rem' }}>{action.description}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>{searchSurface.searchAcrossLabel}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
                    {searchSurface.searchTargets.slice(0, 4).map((action) => (
                      <Box key={action.id} component="button" onClick={() => { handleCloseAll(); router.push(action.href); }} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', color: 'white', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}12`, color: action.accent, flexShrink: 0 }}><Logo app={action.kind as any} size={15} variant="icon" /></Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem' }} noWrap>{action.title}</Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem' }} noWrap>{action.description}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
                {(searchingPeople || peopleResults.length > 0) && (
                  <Box sx={{ display: 'grid', gap: 0.5 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>People</Typography>
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {peopleResults.slice(0, 3).map((person) => (
                        <Box key={person.$id} component="button" onClick={() => { stageProfileView(person, person.avatar); handleCloseAll(); router.push(`/u/${encodeURIComponent((person.username || '').replace(/^@+/, ''))}?transition=profile`); }} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', color: 'white', textAlign: 'left', cursor: 'pointer' }}>
                          <Avatar src={person.avatar || undefined} sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.06)' }}>{(person.displayName || 'U')[0]}</Avatar>
                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Typography component="span" sx={{ color: 'white', fontWeight: 800, fontSize: '0.86rem' }} noWrap>{person.displayName || person.name}</Typography>
                            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem' }} noWrap>@{person.username || 'user'}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        </Box>
    );
      return (
        <Drawer anchor="left" open={searchOpen} onClose={handleCloseAll} disablePortal={true} PaperProps={{ sx: { bgcolor: '#161412', width: 360, height: '100vh', borderRight: '1px solid rgba(255,255,255,0.06)', p: 2.75, display: 'flex', flexDirection: 'column' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.75 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>Search Ecosystem</Typography>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.3)' }}><CloseIcon size={16} /></IconButton>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>{searchContent}</Box>
        </Drawer>
      );
    }
    return <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 28px 28px', bgcolor: '#161412', overflow: 'hidden' }}>{searchContent}</Box>;
  };

  const renderNotificationPanel = () => {
    if (!notificationsOpen) return null;
    
    const notificationList = (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, mb: 1 }}>
          <Typography sx={{ color: 'white/40', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Alerts</Typography>
          {unreadNotifCount > 0 && <Box sx={{ px: 1, py: 0.25, bgcolor: BRAND_INDIGO, color: 'white', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900 }}>{unreadNotifCount} NEW</Box>}
        </Box>
        {notifications.map(notif => (
          <Box key={notif.id} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: notif.read ? 'transparent' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: notif.read ? 'rgba(255,255,255,0.02)' : alpha(notif.accent, 0.15), cursor: 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }} onClick={() => markNotificationRead(notif.id)}>
            <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(notif.accent, 0.1), color: notif.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Bell size={14} /></Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.8rem', lineHeight: 1.2 }}>{notif.title}</Typography>
              <Typography sx={{ color: 'white/40', fontSize: '0.72rem', lineHeight: 1.3 }}>{notif.message}</Typography>
            </Box>
            <IconButton size="small" onClick={(e) => dismissNotification(notif.id, e)} sx={{ color: 'white/10', alignSelf: 'flex-start' }}><CloseIcon size={12} /></IconButton>
          </Box>
        ))}
      </Box>
    );

    if (isDesktop) {
        return (
          <Drawer anchor="top" open={notificationsOpen} onClose={() => setNotificationsOpen(false)} disablePortal={true} PaperProps={{ sx: { bgcolor: '#161412', width: 420, mx: 'auto', left: '50%', transform: 'translateX(-50%)', borderRadius: '0 0 24px 24px', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', maxHeight: 320, overflow: 'hidden' } }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>{notificationList}</Box>
          </Drawer>
        );
    }

    return (
      <Box sx={{ width: '100%', bgcolor: '#161412', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 28px 28px', overflow: 'hidden' }}>
        {notificationList}
      </Box>
    );
  };

  const renderProfilePanel = () => {
    if (!profileMenuAnchorEl || !user) return null;
    const profileContent = (
      <Box sx={{ p: 2 }}>
          <Paper elevation={0} sx={{ borderRadius: '24px', bgcolor: '#161412', border: `1px solid ${alpha(appAccent, 0.2)}`, overflow: 'hidden', p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <IdentityAvatar src={profileAvatarUrl} size={64} pro={isPro} fallback={profileName[0]} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1rem' }} noWrap>{profileName}</Typography>
                    <Typography sx={{ color: 'white/40', fontSize: '0.8rem', fontWeight: 700 }} noWrap>@{profileUsername || 'user'}</Typography>
                </Box>
            </Box>
            <Stack spacing={1}>
                <Button fullWidth onClick={() => { handleCloseAll(); openWallet(); }} sx={{ justifyContent: 'flex-start', color: appAccent, bgcolor: alpha(appAccent, 0.05), borderRadius: '12px' }} startIcon={<Wallet size={16} />}>Wallet</Button>
                <Button fullWidth onClick={() => { handleCloseAll(); router.push('/settings'); }} sx={{ justifyContent: 'flex-start', color: 'white', bgcolor: 'white/3', borderRadius: '12px' }} startIcon={<UserIcon size={16} />}>Settings</Button>
                <Button fullWidth onClick={() => { handleCloseAll(); logout(); }} sx={{ justifyContent: 'flex-start', color: '#ff4d4d', bgcolor: 'rgba(255,77,77,0.05)', borderRadius: '12px' }} startIcon={<CloseIcon size={16} />}>Sign Out</Button>
            </Stack>
          </Paper>
      </Box>
    );
    if (false) {
      return (
        <Drawer
          anchor="left" open={Boolean(profileMenuAnchorEl)} onClose={handleCloseAll} disablePortal={true} PaperProps={{ sx: { bgcolor: '#161412', width: 320, height: '100vh', borderRight: '1px solid rgba(255,255,255,0.06)', p: 2.75 } }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 900, mb: 3 }}>Secure Space</Typography>
          {profileContent}
        </Drawer>
      );
    }
    return <Box sx={{ bgcolor: '#161412', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 28px 28px' }}>{profileContent}</Box>;
  };

  const renderAppPanel = () => {
    if (!appMenuAnchorEl) return null;
    const appList = (
      <Box sx={{ p: 2, display: 'grid', gap: 1 }}>
        {connectApps.map(item => (
          <Box key={item.href} component="button" onClick={() => { handleCloseAll(); router.push(item.href); }} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: item.selected ? alpha(getAppColor(item.app), 0.06) : 'rgba(255,255,255,0.01)', border: '1px solid', borderColor: item.selected ? alpha(getAppColor(item.app), 0.15) : 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: alpha(getAppColor(item.app), 0.1), color: getAppColor(item.app), display: 'grid', placeItems: 'center' }}><Logo app={item.app} size={15} variant="icon" /></Box>
            <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }} noWrap>{item.label}</Typography>
                <Typography sx={{ color: 'white/40', fontSize: '0.72rem' }} noWrap>{item.description}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    );
    return <Box sx={{ bgcolor: '#161412', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 28px 28px' }}>{appList}</Box>;
  };

  return (
    <>
      <AppBar ref={headerRef} position="fixed" elevation={0} sx={{ zIndex: 1201, bgcolor: '#161412', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 28px 28px', boxShadow: '0 16px 42px rgba(0,0,0,0.42)', backgroundImage: 'none', overflow: 'visible', height: activePanel ? 'auto' : '88px' }}>
        <SyncIndicator />
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 }, width: '100%', height: '88px', display: 'flex', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
            
            {/* App Logo / Menu Trigger */}
            <Box onClick={user ? openAppMenu : () => openUnified('login')} sx={{ cursor: 'pointer', flexShrink: 0 }}>
              <Logo app={activeApp} size={32} variant={isDesktop ? 'full' : 'icon'} />
            </Box>

            {/* 🏝️ Dynamic Island Search & Notification Host */}
            {user ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  {searchOpen ? (
                    <motion.div initial={{ width: 44, opacity: 0 }} animate={{ width: isDesktop ? 520 : '100%', opacity: 1 }} exit={{ width: 44, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} style={{ position: 'relative', maxWidth: '100%' }}>
                      <Paper elevation={0} sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, border: '1px solid rgba(255,255,255,0.1)', bgcolor: '#000', color: 'white', borderRadius: '24px', boxShadow: '0 0 26px rgba(0,0,0,0.5)' }}>
                        <Search size={16} strokeWidth={2.5} style={{ opacity: 0.6 }} />
                        <InputBase inputRef={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ecosystem..." sx={{ flex: 1, color: 'white', fontWeight: 800, fontSize: '0.9rem', '& input::placeholder': { color: 'white/20' } }} />
                        
                        {/* 🔔 Notifications CTA */}
                        <IconButton onClick={toggleNotifications} sx={{ color: unreadNotifCount > 0 ? '#6366F1' : 'white/20', position: 'relative', p: 0.5, bgcolor: notificationsOpen ? 'white/5' : 'transparent' }}>
                          <Bell size={18} strokeWidth={2.5} />
                          {unreadNotifCount > 0 && <Box sx={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', bgcolor: '#EC4899', border: '1.5px solid #000' }} />}
                        </IconButton>

                        <Box sx={{ width: 1, height: 20, bgcolor: 'white/10', mx: 0.5 }} />
                        
                        <IconButton size="small" onClick={() => setSearchOpen(false)} sx={{ color: 'white/40' }}><CloseIcon size={16} /></IconButton>
                      </Paper>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.05 }} onClick={openSearch} style={{ cursor: 'pointer' }}>
                      <Box sx={{ width: { xs: 44, md: 160 }, height: 44, borderRadius: '999px', bgcolor: '#000', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, color: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                        <Search size={18} strokeWidth={2.5} />
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search</Typography>
                        {unreadNotifCount > 0 && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#EC4899' }} />}
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            ) : <Box sx={{ flex: 1 }} />}

            {/* Right Stack: Smart Systems & Profile */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
              {user ? (
                <>
                  <IconButton onClick={() => openAgenticDrawer()} sx={{ color: appAccent, bgcolor: '#0A0908', border: '1px solid', borderColor: alpha(appAccent, 0.2), borderRadius: '50%', width: 38, height: 38, boxShadow: `0 8px 22px ${alpha(appAccent, 0.15)}`, '&:hover': { bgcolor: '#111' } }}>
                    <Bot size={16} strokeWidth={2} />
                  </IconButton>
                  <ButtonBase onClick={openProfileMenu} sx={{ borderRadius: '50%', transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}>
                    <IdentityAvatar src={profileAvatarUrl} size={38} pro={isPro} fallback={profileName[0]} />
                  </ButtonBase>
                </>
              ) : (
                <Button onClick={() => openUnified('login')} sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 900, borderRadius: '12px', px: 2.5, py: 1, '&:hover': { bgcolor: '#5254E8' } }}>{isAuthenticating ? <CircularProgress size={16} color="inherit" /> : 'Connect'}</Button>
              )}
            </Stack>
          </Box>
        </Box>

        <AnimatePresence>
          {notificationsOpen ? renderNotificationPanel() : renderSearchPanel()}
        </AnimatePresence>
        {renderAppPanel()}
        {renderProfilePanel()}
      </AppBar>
    </>
  );
}
