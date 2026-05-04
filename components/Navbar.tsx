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
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  Settings,
  X as CloseIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import Logo from './Logo';
import EcosystemPortal from './EcosystemPortal';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';
import { useAuth } from '@/context/auth/AuthContext';
import { useColorMode } from '@/context/ThemeContext';
import { getUserProfilePicId } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';

const TOPBAR_HEIGHT = 88;

export default function Navbar() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated, logout, openIDMWindow } = useAuth();
  const { mode } = useColorMode();

  const [productsMenuOpen, setProductsMenuOpen] = useState<null | HTMLElement>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState<null | HTMLElement>(null);
  const [navMenuOpen, setNavMenuOpen] = useState<null | HTMLElement>(null);
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
    setProfileMenuOpen(null);
    await logout();
  };

  const handleCloseAll = useCallback(() => {
    setProductsMenuOpen(null);
    setProfileMenuOpen(null);
    setNavMenuOpen(null);
  }, []);

  const openProductsMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProfileMenuOpen(null);
    setNavMenuOpen(null);
    setProductsMenuOpen(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProductsMenuOpen(null);
    setNavMenuOpen(null);
    setProfileMenuOpen(event.currentTarget);
  }, []);

  const openNavMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProductsMenuOpen(null);
    setProfileMenuOpen(null);
    setNavMenuOpen(event.currentTarget);
  }, []);

  const productItems = useMemo(() => [
    ...ECOSYSTEM_APPS.filter(app => app.type === 'app' || app.type === 'accounts').map(app => ({
      label: app.label,
      description: app.description,
      color: app.color,
      href: getEcosystemUrl(app.subdomain),
      app: app.subdomain
    }))
  ], []);

  const navItems = useMemo(() => [
    { label: 'Developers', href: '/developers' },
    { label: 'Docs', href: '/docs' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Download CLI', href: 'https://github.com/Kylrix/cli' },
  ], []);

  const activePanel = productsMenuOpen ? 'products' : profileMenuOpen ? 'profile' : navMenuOpen ? 'nav' : null;

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

  const renderProductsPanel = () => {
    if (!productsMenuOpen) return null;

    return (
      <Box sx={{ width: '100%', bgcolor: '#161412', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: '70vh', overflowY: 'auto', display: 'grid', gap: 0.75 }}>
          {productItems.map((item, idx) => (
            <Button
              key={`product-${idx}`}
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
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha((item as any).color || '#6366F1', 0.08), color: (item as any).color || '#6366F1', flexShrink: 0 }}>
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
      </Box>
    );
  };

  const renderNavPanel = () => {
    if (!navMenuOpen) return null;

    return (
      <Box sx={{ width: '100%', bgcolor: '#161412', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ px: { xs: 2, md: 4 }, py: 1.5, maxHeight: '70vh', overflowY: 'auto', display: 'grid', gap: 0.75 }}>
          {/* Navigation items */}
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {navItems.map((item) => (
              <Button
                key={item.label}
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
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }} noWrap>
                  {item.label}
                </Typography>
              </Button>
            ))}
          </Box>



          {/* Connect button for guests */}
          {!isAuthenticated && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Button
                fullWidth
                onClick={() => {
                  handleCloseAll();
                  handleLaunchClick();
                }}
                sx={{
                  bgcolor: '#6366F1',
                  color: '#000',
                  fontWeight: 800,
                  borderRadius: '14px',
                  textTransform: 'none',
                  py: 1.2,
                  fontSize: '0.9rem',
                  '&:hover': { bgcolor: alpha('#6366F1', 0.85) }
                }}
              >
                Connect
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  const renderProfilePanel = () => {
    if (!profileMenuOpen || !isAuthenticated) return null;

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
              {/* Logo with Products dropdown */}
              <Box
                component="div"
                role="button"
                tabIndex={0}
                onClick={openProductsMenu}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setProductsMenuOpen(event.currentTarget as HTMLElement);
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

              {/* Desktop nav items */}
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  flex: 1,
                  ml: 4,
                }}
              >
                {navItems.map((item) => (
                  <Button
                    key={item.label}
                    onClick={() => window.location.assign(item.href)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: 'rgba(255,255,255,0.7)',
                      '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Stack>

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
                    id="navbar-connect-btn"
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

                {/* Mobile menu button */}
                <IconButton
                  onClick={openNavMenu}
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    width: 40,
                    height: 40,
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  <MenuIcon size={20} />
                </IconButton>
              </Stack>
            </Box>
          </Box>
        </Container>

        {renderProductsPanel()}
        {renderNavPanel()}
        {renderProfilePanel()}
      </AppBar>

      <Box sx={{ height: `${TOPBAR_HEIGHT}px` }} />

      <EcosystemPortal open={isEcosystemPortalOpen} onClose={() => setIsEcosystemPortalOpen(false)} />
    </>
  );
}
