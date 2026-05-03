'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  alpha,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Container,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChevronDown,
  LogOut,
  Settings,
  X as CloseIcon,
} from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';

import Logo from './Logo';
import EcosystemPortal from './EcosystemPortal';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';
import { useAuth } from '@/context/auth/AuthContext';
import { useColorMode } from '@/context/ThemeContext';
import { getUserProfilePicId } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';

const TOPBAR_HEIGHT = 88;

export const Navbar = () => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated, logout, openIDMWindow } = useAuth();
  const { mode } = useColorMode();

  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [isEcosystemPortalOpen, setIsEcosystemPortalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  
  const profilePicId = getUserProfilePicId(user);
  const profileName = user?.name || user?.email || 'Kylrix user';

  useEffect(() => {
    let mounted = true;
    const cached = getCachedProfilePreview(profilePicId);
    if (cached !== undefined) setProfileUrl(cached);

    const loadProfile = async () => {
      if (profilePicId) {
        const url = await fetchProfilePreview(profilePicId);
        if (mounted) setProfileUrl(url);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [profilePicId]);

  const handleLaunchClick = () => {
    if (isAuthenticated) {
      router.push(getEcosystemUrl('note'));
    } else {
      openIDMWindow();
    }
  };

  const handleLogout = async () => {
    setProfileMenuAnchorEl(null);
    await logout();
  };

  const handleCloseAll = useCallback(() => {
    setAppMenuAnchorEl(null);
    setProfileMenuAnchorEl(null);
  }, []);

  const openAppMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setAppMenuAnchorEl(null);
    setProfileMenuAnchorEl(event.currentTarget);
  }, []);

  const navItems = useMemo(() => [
    {
      label: 'Products',
      items: [
        ...ECOSYSTEM_APPS.filter(app => app.type === 'app').map(app => ({
          label: app.label,
          description: app.description,
          color: app.color,
          href: getEcosystemUrl(app.subdomain),
          app: app.subdomain
        })),
        {
          label: 'Downloads',
          description: 'Get Kylrix for Desktop and Mobile',
          color: '#6366F1',
          href: '/downloads'
        }
      ]
    },
    {
      label: 'Developers',
      items: [
        { label: 'Documentation', description: 'API docs and guides', href: '/docs' },
        { label: 'API Reference', description: 'Full API documentation', href: '/docs/api' },
        { label: 'SDK Demo', description: 'Interactive SDK example', href: '/sdk' },
        { label: 'GitHub', description: 'View source code', href: 'https://github.com/kylrix', external: true },
      ]
    },
    { label: 'Pricing', href: '/pricing' }
  ], []);

  const activePanel = appMenuAnchorEl ? 'app' : profileMenuAnchorEl ? 'profile' : null;

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

  const renderAppPanel = () => {
    if (!appMenuAnchorEl) return null;

    return (
      <Box sx={{ width: '100%', bgcolor: '#161412', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            py: 1.5,
            maxHeight: '70vh',
            overflowY: 'auto',
            display: 'grid',
            gap: 0.75
          }}
        >
          {navItems.map((section, sectionIdx) => (
            <Box key={`section-${sectionIdx}`}>
              {section.items ? (
                <>
                  <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5, mb: 0.75 }}>
                    {section.label}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {section.items.map((item, idx) => (
                      <Button
                        key={`${section.label}-${idx}`}
                        fullWidth
                        onClick={() => {
                          handleCloseAll();
                          if ((item as any).external) {
                            window.open(item.href, '_blank');
                          } else {
                            window.location.assign(item.href);
                          }
                        }}
                        sx={{
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          px: 1.5,
                          py: 1.1,
                          borderRadius: '18px',
                          color: 'white',
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha(item.color || '#6366F1', 0.08), color: item.color || '#6366F1', flexShrink: 0 }}>
                            <Logo app={(item as any).app || 'accounts'} size={16} variant="icon" />
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
                    ))}
                  </Box>
                </>
              ) : (
                <Button
                  fullWidth
                  onClick={() => {
                    handleCloseAll();
                    window.location.assign((section as any).href);
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1.1,
                    borderRadius: '18px',
                    color: 'white',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    {section.label}
                  </Typography>
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const renderProfilePanel = () => {
    if (!profileMenuAnchorEl || !isAuthenticated) return null;

    const isRenderableImageSrc = (value?: string | null) => {
      if (!value) return false;
      return /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:');
    };

    return (
      <Box sx={{ width: '100%', bgcolor: '#161412', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: '70vh', overflowY: 'auto' }}>
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar
                src={isRenderableImageSrc(profileUrl) ? profileUrl || undefined : undefined}
                sx={{ width: 80, height: 80, bgcolor: '#6366F1', color: '#fff', fontWeight: 900, borderRadius: '20px' }}
              >
                {profileName.slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.05 }} noWrap>
                  {profileName}
                </Typography>
                <Typography sx={{ color: alpha('#fff', 0.62), fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }} noWrap>
                  {user?.email}
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                onClick={() => {
                  handleCloseAll();
                  window.location.href = `${getEcosystemUrl('accounts')}/settings?source=${encodeURIComponent(window.location.origin)}`;
                }}
                fullWidth
                sx={{
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  color: 'white',
                  px: 1.25,
                  py: 0.9,
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <Settings size={16} style={{ marginRight: 8 }} />
                Settings
              </Button>
              <Button
                onClick={handleLogout}
                fullWidth
                sx={{
                  borderRadius: '14px',
                  bgcolor: 'rgba(255, 77, 77, 0.08)',
                  color: '#FF4D4D',
                  px: 1.25,
                  py: 0.9,
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.14)' },
                }}
              >
                <LogOut size={16} style={{ marginRight: 8 }} />
                Sign Out
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <>
      <AppBar
        ref={headerRef}
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
        <Container maxWidth="xl">
          <Box sx={{ px: { xs: 2, md: 4 }, width: '100%' }}>
            <Box
              sx={{
                minHeight: TOPBAR_HEIGHT,
                display: activePanel ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: { xs: 1.25, md: 2 },
              }}
            >
              {/* Logo with dropdown chevron */}
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
                <Logo size={32} />
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

              {/* Spacer */}
              <Box sx={{ flex: 1 }} />

              {/* Right side actions */}
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
                {isAuthenticated && (
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
                      src={profileUrl ? profileUrl : undefined}
                      sx={{
                        width: 38,
                        height: 38,
                        bgcolor: profileUrl ? 'rgba(255,255,255,0.04)' : '#6366F1',
                        color: '#fff',
                        fontWeight: 900,
                        borderRadius: '12px',
                      }}
                    >
                      {profileName.slice(0, 1).toUpperCase()}
                    </Avatar>
                  </ButtonBase>
                )}

                {!isAuthenticated && (
                  <Button
                    onClick={handleLaunchClick}
                    sx={{
                      bgcolor: '#6366F1',
                      color: '#000',
                      fontWeight: 800,
                      borderRadius: '10px',
                      textTransform: 'none',
                      px: 2.5,
                      '&:hover': { bgcolor: alpha('#6366F1', 0.85) }
                    }}
                  >
                    Connect
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>
        </Container>

        {renderAppPanel()}
        {renderProfilePanel()}
      </AppBar>

      <Box sx={{ height: `${TOPBAR_HEIGHT}px` }} />

      <EcosystemPortal open={isEcosystemPortalOpen} onClose={() => setIsEcosystemPortalOpen(false)} />
    </>
  );
};
