'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
} from '@mui/material';
import {
  ChevronDown,
  Menu,
  RefreshCw,
  Search,
  X as CloseIcon,
  Wallet,
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { WalletSidebar } from '@/components/overlays/WalletSidebar';
import { useAuth } from '@/context/auth/AuthContext';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { getUserProfilePicId } from '@/lib/utils';
import { getEcosystemUrl } from '@/constants/ecosystem';
import { TOPBAR_LAYOUT, getAppTone } from '@/lib/sdk/design';
import { createEcosystemPanelItems, createTopbarPanelMotion, createTopbarSearchSurface, isTopbarScrollAtBottom, isTopbarScrollAtTop } from '@/lib/sdk/topbar';
import { createProfilePreviewManager, getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/sdk/appwrite';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { stageProfileView } from '@/lib/profile-handoff';
import { getAppColor } from '@/lib/ecosystem-app-colors';

interface NoteTopbarProps {
  className?: string;
  mode?: 'app' | 'shared';
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function isRenderableImageSrc(value?: string | null) {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

export default function NoteTopbar({
  className,
  mode = 'app',
  onRefresh,
  isRefreshing = false,
}: NoteTopbarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWebsiteRoute = !(
    pathname?.startsWith('/note') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  );
  const logoApp = isWebsiteRoute ? 'root' : 'note';
  const showSearchControl = isAuthenticated && !isWebsiteRoute;
  const landingNavItems = [
    { label: 'Developers', href: '/developers' },
    { label: 'Docs', href: '/docs' },
    { label: 'Pricing', href: '/pricing' },
  ] as const;

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);
  const tone = getAppTone('note');
  const profileName = user?.name || user?.email || 'Note user';
  const profileUsername = (user as any)?.username || (user as any)?.prefs?.username || null;
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
    if (searchParams.get('openWallet') === 'true') {
      setIsWalletOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('openWallet');
      const nextQuery = params.toString();
      router.replace(pathname + (nextQuery ? `?${nextQuery}` : ''));
    }
  }, [pathname, router, searchParams]);

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

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('');
      setPeopleResults([]);
      setSearchingPeople(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const text = searchQuery.trim().toLowerCase();
    if (text.length < 2) {
      setPeopleResults([]);
      setSearchingPeople(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchingPeople(true);
      try {
        const result = await searchGlobalUsers(text, 5);
        if (!active) return;
        const rows = Array.isArray(result)
          ? result
              .map((candidate: any) => ({
                id: candidate.id || candidate.$id || candidate.userId,
                userId: candidate.userId || candidate.id || candidate.$id || null,
                username: candidate.username || candidate.subtitle?.replace(/^@/, '') || null,
                displayName: candidate.displayName || candidate.title || candidate.username || candidate.name || null,
                name: candidate.displayName || candidate.title || candidate.username || candidate.name || null,
                avatar: candidate.avatar || null,
                email: candidate.email || null,
              }))
              .filter((candidate: any) => candidate.userId !== user?.$id)
          : [];
        const resolved = await Promise.all(
          rows.slice(0, 5).map(async (candidate: any) => {
            const rawAvatar = candidate.avatar || null;
            if (!rawAvatar || isRenderableImageSrc(rawAvatar)) {
              return candidate;
            }

            const cachedPreview = previewManager.getCachedProfilePreview(rawAvatar);
            if (cachedPreview !== undefined) {
              return { ...candidate, avatar: cachedPreview };
            }

            try {
              const preview = await previewManager.fetchProfilePreview(rawAvatar, 40, 40);
              return { ...candidate, avatar: preview };
            } catch {
              return { ...candidate, avatar: null };
            }
          }),
        );
        if (active) setPeopleResults(resolved);
      } catch (error) {
        if (active) {
          console.warn('[NoteTopbar] People search failed:', error);
          setPeopleResults([]);
        }
      } finally {
        if (active) setSearchingPeople(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [previewManager, searchOpen, searchQuery, user?.$id]);

  const handleCloseAll = useCallback(() => {
    setSearchOpen(false);
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setMobileMenuOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
    setSearchOpen(true);
  }, []);

  const openAppMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setSearchOpen(false);
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setSearchOpen(false);
    setProfileMenuAnchorEl(event.currentTarget);
  }, []);

  const noteApps = useMemo(
    () =>
      createEcosystemPanelItems('note').map((item) => ({
        ...item,
        href: getEcosystemUrl(item.app === 'kylrix' ? 'kylrix' : item.app),
      })),
    [],
  );
  const searchSurface = useMemo(
    () =>
      createTopbarSearchSurface({
        query: searchQuery,
        routeLabel: 'Note',
        currentApp: 'note',
        snippets: [],
        resolveUrl: (app, path = '') => `${getEcosystemUrl(app === 'kylrix' ? 'kylrix' : app)}${path}`,
      }),
    [searchQuery],
  );
  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = searchOpen
    ? 'search'
    : profileMenuAnchorEl
      ? 'profile'
      : appMenuAnchorEl
        ? 'ecosystem'
        : mobileMenuOpen
          ? 'mobile'
          : null;

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
        <Box
          onWheel={(event) => {
            const node = event.currentTarget;
            if (event.deltaY < 0 && isTopbarScrollAtTop(node)) {
              event.preventDefault();
              handleCloseAll();
            }
          }}
          sx={{
            width: '100%',
            px: { xs: 2, md: 4 },
            py: 1.5,
            maxHeight: TOPBAR_LAYOUT.searchDockMaxHeight,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <Logo app={logoApp} size={18} variant="icon" />
            </Box>
            <TextField
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search notes, tags, shared links, people"
              variant="standard"
              fullWidth
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

          <Stack spacing={1.25} sx={{ mt: 1.25 }}>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {!hasQuery && (
                <Box sx={{ px: 0.5, py: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.84rem' }}>
                    Start typing to search notes, goals, moments, calls, people, and apps.
                  </Typography>
                </Box>
              )}

              {searchSurface.snippets.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {searchSurface.snippets.slice(0, 4).map((snippet) => (
                    <Box
                      key={snippet.id}
                      sx={{
                        px: 1.25,
                        py: 0.75,
                        borderRadius: '999px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.84)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                      }}
                    >
                      {snippet.title}
                    </Box>
                  ))}
                </Stack>
              )}

              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {searchSurface.quickActionLabel}
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  {searchSurface.quickActions.slice(0, 3).map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => window.location.assign(action.href)}
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
                      }}
                    >
                      <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}1F`, color: action.accent, flexShrink: 0 }}>
                        <Logo app="connect" size={16} variant="icon" />
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

              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {searchSurface.searchAcrossLabel}
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  {searchSurface.searchTargets.slice(0, 4).map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => window.location.assign(action.href)}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 1.5,
                        py: 1.1,
                        borderRadius: '18px',
                        bgcolor: action.kind === 'note' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${action.kind === 'note' ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.05)'}`,
                        color: 'white',
                        textAlign: 'left',
                      }}
                    >
                      <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}1F`, color: action.accent, flexShrink: 0 }}>
                        <Logo app="connect" size={16} variant="icon" />
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

              {searchingPeople || peopleResults.length > 0 ? (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {searchSurface.peopleLabel}
                  </Typography>
                  {searchingPeople ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.84rem' }}>
                      Searching people...
                    </Typography>
                  ) : (
                    peopleResults.slice(0, 3).map((person) => (
                      <Box
                        key={person.$id || person.id}
                        component="button"
                        onClick={() => {
                          setSearchQuery(person.displayName || person.username || person.name || '');
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
                        }}
                      >
                        <IdentityAvatar
                          src={person.avatar || undefined}
                          alt={person.displayName || person.username || person.name || 'person'}
                          fallback={(person.displayName || person.username || person.name || 'U')[0]?.toUpperCase() || 'U'}
                          size={32}
                          borderRadius="12px"
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                            {person.displayName || person.username || person.name || 'Person'}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                            {person.username ? `@${String(person.username).replace(/^@/, '')}` : 'Direct chat target'}
                          </Typography>
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              ) : null}
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  };

  const renderProfilePanel = () => {
    if (!profileMenuAnchorEl) return null;
    const handleProfileWheel = (event: React.WheelEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      const atTop = node.scrollTop <= 0;

      if (event.deltaY < 0 && atTop) {
        event.preventDefault();
        handleCloseAll();
        return;
      }

      if (event.deltaY > 0 && isTopbarScrollAtBottom(node)) {
        event.preventDefault();
        const username = profileSeed.username;
        if (username) {
          stageProfileView(profileSeed as any, profileSeed.avatar || null);
          handleCloseAll();
          window.location.href = `${getEcosystemUrl('connect')}/u/${encodeURIComponent(username)}?transition=profile`;
        }
      }
    };

    return (
      <Box
        sx={{
          width: '100%',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          bgcolor: '#161412',
          overflow: 'hidden',
        }}
      >
        <Box
          onWheel={handleProfileWheel}
          sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: TOPBAR_LAYOUT.searchDockMaxHeight, overflowY: 'auto' }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              borderRadius: '30px',
              bgcolor: '#161412',
              border: '1px solid rgba(99,102,241,0.28)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '14px', display: 'grid', placeItems: 'center', color: '#6366F1', bgcolor: alpha('#6366F1', 0.08), border: `1px solid ${alpha('#6366F1', 0.24)}` }}>
                    <Logo app={logoApp} size={18} variant="icon" />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.1 }}>
                      {profileName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha('#fff', 0.52), fontWeight: 700 }}>
                      Profile commands
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={handleCloseAll} size="small" sx={{ width: 34, height: 34, borderRadius: '999px', color: alpha('#fff', 0.9), bgcolor: alpha('#fff', 0.06), border: '1px solid rgba(255,255,255,0.08)' }}>
                  <CloseIcon size={16} />
                </IconButton>
              </Box>

              <Box sx={{ display: 'grid', gap: 1.25, maxHeight: '58vh', overflowY: 'auto', pr: 0.5, pb: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Avatar
                    src={isRenderableImageSrc(profileAvatarUrl) ? profileAvatarUrl || undefined : undefined}
                    sx={{ width: 104, height: 104, bgcolor: tone.secondary, color: '#fff', fontWeight: 900, borderRadius: '28px' }}
                  >
                    {profileName.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', lineHeight: 1.05 }} noWrap>
                      {profileName}
                    </Typography>
                    <Typography sx={{ color: alpha('#fff', 0.62), fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.35 }} noWrap>
                      {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : 'profile'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ borderRadius: '22px', border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)', p: 1.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75 }}>
                    Identity
                  </Typography>
                  <Typography sx={{ color: 'white', fontSize: '0.88rem', lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {profileUsername ? `@${String(profileUsername).replace(/^@+/, '')}` : 'No username set.'}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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

                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5, pb: 0.25 }}>
                  <motion.div
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 140 }}
                    dragElastic={0.14}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 64) {
                        const username = profileUsername ? String(profileUsername).replace(/^@+/, '').toLowerCase() : null;
                        if (username) {
                        stageProfileView(profileSeed as any, profileSeed.avatar || null);
                          handleCloseAll();
                          window.location.href = `${getEcosystemUrl('connect')}/u/${encodeURIComponent(username)}?transition=profile`;
                        }
                      }
                    }}
                    style={{ touchAction: 'pan-y', cursor: 'grab' }}
                  >
                    <Box sx={{ width: 56, height: 6, borderRadius: 999, bgcolor: alpha('#fff', 0.14) }} />
                  </motion.div>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  };

  const renderAppPanel = () => {
    if (!appMenuAnchorEl) return null;

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
              {noteApps.map((item) => {
                const tone = getAppTone(item.app);
                return (
                  <Button
                    key={item.href}
                    fullWidth
                    onClick={() => {
                      handleCloseAll();
                      window.location.assign(item.href);
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      px: 1.5,
                      py: 1.1,
                      borderRadius: '18px',
                      color: 'white',
                      bgcolor: item.selected ? alpha('#6366F1', 0.08) : 'rgba(255,255,255,0.02)',
                      border: '1px solid transparent',
                      '&:hover': {
                        bgcolor: alpha('#6366F1', 0.12),
                        borderColor: alpha('#6366F1', 0.24),
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha(tone.secondary, 0.08), color: tone.secondary, flexShrink: 0 }}>
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

  const renderMobileMenuPanel = () => {
    if (!mobileMenuOpen) return null;

    return (
      <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', bgcolor: '#161412', overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, display: 'grid', gap: 0.75 }}>
          {isWebsiteRoute &&
            landingNavItems.map((item) => (
              <Button
                key={item.label}
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.assign(item.href);
                }}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  borderRadius: '14px',
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {item.label}
              </Button>
            ))}

          {!isWebsiteRoute && (
            <Button
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                openSearch();
              }}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                borderRadius: '14px',
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              startIcon={<Search size={16} />}
            >
              Search
            </Button>
          )}
          {!isLandingRoute && (
            <Button
              fullWidth
              onClick={(event) => {
                setMobileMenuOpen(false);
                openAppMenu(event);
              }}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                borderRadius: '14px',
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              startIcon={<ChevronDown size={16} />}
            >
              Ecosystem Apps
            </Button>
          )}
          {mode === 'shared' && onRefresh && (
            <Button
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                onRefresh();
              }}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                borderRadius: '14px',
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              startIcon={<RefreshCw size={16} />}
            >
              Refresh
            </Button>
          )}
          {isAuthenticated && !isWebsiteRoute && (
            <Button
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                setIsWalletOpen(true);
              }}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                borderRadius: '14px',
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              startIcon={<Wallet size={16} />}
            >
              Wallet
            </Button>
          )}
        </Box>
      </Box>
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
          overflow: 'hidden',
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
                  setSearchOpen(false);
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
              <Logo app={logoApp} size={32} />
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

            {showSearchControl ? (
              <Box
                sx={{
                  width: { xs: 44, md: 114 },
                  minWidth: { xs: 44, md: 114 },
                  maxWidth: { xs: 44, md: 114 },
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {searchOpen ? (
                  <Paper
                    elevation={0}
                    data-note-search-surface="true"
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
                      placeholder="Search notes, tags, shared links, people"
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
              {mode === 'shared' && onRefresh && (
                <Tooltip title="Refresh note">
                  <IconButton
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    sx={{
                      color: isRefreshing ? '#EC4899' : 'rgba(255, 255, 255, 0.4)',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid',
                      borderColor: isRefreshing ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      width: 44,
                      height: 44,
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                      },
                    }}
                  >
                    <RefreshCw size={18} />
                  </IconButton>
                </Tooltip>
              )}

              {isAuthenticated && (
                <>
                  {!isWebsiteRoute && (
                    <Tooltip title="Wallet">
                      <IconButton
                        onClick={() => setIsWalletOpen(true)}
                        sx={{
                          display: { xs: 'none', md: 'inline-flex' },
                          color: getAppColor('note'),
                          bgcolor: alpha(getAppColor('note'), 0.03),
                          border: '1px solid',
                          borderColor: alpha(getAppColor('note'), 0.1),
                          borderRadius: '12px',
                          width: 42,
                          height: 42,
                          '&:hover': { bgcolor: alpha(getAppColor('note'), 0.08) },
                        }}
                      >
                        <Wallet size={18} strokeWidth={1.5} />
                      </IconButton>
                    </Tooltip>
                  )}

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
                        bgcolor: profileAvatarUrl ? 'rgba(255,255,255,0.04)' : getAppTone('note').secondary,
                        color: '#fff',
                        fontWeight: 900,
                        borderRadius: '12px',
                      }}
                    >
                      {profileName.slice(0, 1).toUpperCase()}
                    </Avatar>
                  </ButtonBase>
                </>
              )}
              <Box sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                <IconButton
                  onClick={() => {
                    setSearchOpen(false);
                    setAppMenuAnchorEl(null);
                    setProfileMenuAnchorEl(null);
                    setMobileMenuOpen((prev) => !prev);
                  }}
                  sx={{
                    color: 'rgba(255,255,255,0.75)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    width: 42,
                    height: 42,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  <Menu size={18} />
                </IconButton>
              </Box>
            </Stack>
          </Box>
        </Box>

        {renderMobileMenuPanel()}
        {renderSearchPanel()}
        {renderAppPanel()}
        {renderProfilePanel()}
      </AppBar>
      {isWalletOpen ? <WalletSidebar isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} /> : null}
    </>
  );
}
