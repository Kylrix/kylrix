'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Menu as LucideMenu,
  Search,
  Bell,
  Settings,
  LogOut,
  User,
  LayoutGrid,
  Sparkles,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Wallet
} from 'lucide-react';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { Logo } from '@/components/common/Logo';
import { getTopbarLogoHref } from '@/lib/sdk';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/constants';
import dynamic from 'next/dynamic';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { getUserProfilePicId } from '@/lib/utils';
import { Button } from '@mui/material';
import { IdentityAvatar, computeIdentityFlags } from '../common/IdentityBadge';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

import { useRouter } from 'next/navigation';

type IslandNotification = {
  app?: string;
  type?: string;
  title?: string;
  message?: string;
  duration?: number;
  majestic?: boolean;
};

const AICommandModal = dynamic(() => import('@/components/ai/AICommandModal').then(mod => mod.AICommandModal), { ssr: false });
const EcosystemPortal = dynamic(() => import('@/components/common/EcosystemPortal'), { ssr: false });

function getInitials(user: { name?: string | null; email?: string | null } | null) {
  const text = user?.name?.trim() || user?.email?.split('@')[0] || '';
  if (!text) return 'U';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AppBar() {
  const theme = useTheme();
  const { toggleSidebar, setSearchQuery, searchQuery } = useTask();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [appsAnchorEl, setAppsAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { openWallet } = useWalletOverlay();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const [islandNotification, setIslandNotification] = useState<IslandNotification | null>(null);
  const [islandAnchorEl, setIslandAnchorEl] = useState<null | HTMLElement>(null);
  const islandTimerRef = React.useRef<number | null>(null);
  const profileUsername = String((user?.prefs as any)?.username || user?.name || '').trim();

  const router = useRouter();

  React.useEffect(() => {
    let mounted = true;
    const profilePicId = getUserProfilePicId(user);
    const cached = getCachedProfilePreview(profilePicId || undefined);
    if (cached !== undefined && mounted) {
      setProfileUrl(cached ?? null);
    }

    const fetchPreview = async () => {
      try {
        if (profilePicId) {
          const url = await fetchProfilePreview(profilePicId, 64, 64);
          if (mounted) setProfileUrl(url as unknown as string);
        } else if (mounted) setProfileUrl(null);
      } catch (_err: unknown) {
        if (mounted) setProfileUrl(null);
      }
    };

    fetchPreview();
    return () => { mounted = false; };
  }, [user]);

  React.useEffect(() => {
    let mounted = true;
    const loadProfileRecord = async () => {
      if (!profileUsername) return;
      try {
        const results = await searchGlobalUsers(profileUsername, 1);
        if (!mounted) return;
        setProfileRecord(results[0] || null);
      } catch (error) {
        console.warn('[Flow AppBar] Failed to load profile record:', error);
      }
    };
    loadProfileRecord();
    return () => { mounted = false; };
  }, [profileUsername]);

  useEffect(() => {
    const handleExternalNotification = (event: Event) => {
      const detail = (event as CustomEvent<IslandNotification>).detail;
      if (!detail) return;

      setIslandNotification(detail);

      if (islandTimerRef.current) {
        window.clearTimeout(islandTimerRef.current);
      }

      const duration = typeof detail.duration === 'number' ? detail.duration : 6500;
      if (duration > 0) {
        islandTimerRef.current = window.setTimeout(() => {
          setIslandNotification(null);
          islandTimerRef.current = null;
        }, duration);
      }
    };

    window.addEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
    return () => {
      window.removeEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
      if (islandTimerRef.current) {
        window.clearTimeout(islandTimerRef.current);
      }
    };
  }, []);

  const shouldCollapseChrome = Boolean(islandNotification);
  const islandColor = useMemo(() => {
    const key = String(islandNotification?.app || islandNotification?.type || '').toLowerCase();
    if (key === 'note') return '#EC4899';
    if (key === 'connect') return '#F59E0B';
    if (key === 'root' || key === 'accounts') return '#6366F1';
    return '#A855F7';
  }, [islandNotification]);
  const islandApp = islandNotification?.app || 'flow';

  const identitySignals = computeIdentityFlags({
    createdAt: profileRecord?.createdAt || (user as any)?.$createdAt || (user as any)?.createdAt || null,
    lastUsernameEdit: profileRecord?.lastUsernameEdit || (user?.prefs as any)?.last_username_edit || null,
    profilePicId: profileRecord?.profilePicId || getUserProfilePicId(user) || null,
    username: profileRecord?.username || (user?.prefs as any)?.username || user?.name || null,
    bio: profileRecord?.bio || (user?.prefs as any)?.bio || null,
    tier: profileRecord?.tier || (user?.prefs as any)?.tier || null,
    publicKey: profileRecord?.publicKey || (user?.prefs as any)?.publicKey || null,
    emailVerified: Boolean((user as any)?.emailVerification),
  });

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotifClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleIslandClick = (event: React.MouseEvent<HTMLElement>) => {
    setIslandAnchorEl(event.currentTarget);
  };

  const [portalOpen, setPortalOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Space to open portal
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        setPortalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setAnchorEl(null);
    setAppsAnchorEl(null);
    setNotifAnchorEl(null);
    setIslandAnchorEl(null);
  };


  return (
    <MuiAppBar
      position="fixed"
      elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
    >
      <Toolbar sx={{ gap: 2, minHeight: '88px' }}>
        {shouldCollapseChrome ? (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Box
              onClick={handleIslandClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.1,
                borderRadius: '999px',
                bgcolor: 'rgba(11, 9, 8, 0.92)',
                border: `1px solid ${alpha(islandColor, 0.35)}`,
                boxShadow: `0 0 0 1px ${alpha(islandColor, 0.08)}, 0 0 22px ${alpha(islandColor, 0.18)}`,
                cursor: 'pointer',
                maxWidth: 'min(92vw, 640px)',
              }}
            >
              <Box sx={{ flexShrink: 0, width: 28, height: 28 }}>
                <Logo size={28} variant="icon" app={islandApp as any} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 800, lineHeight: 1.1 }}>
                  {islandNotification?.title || 'Notification'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)', display: 'block', lineHeight: 1.15, maxWidth: '52ch' }} noWrap>
                  {islandNotification?.message || 'Tap to expand'}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            {/* Menu Toggle - only on desktop */}
            <IconButton
              edge="start"
              color="inherit"
              aria-label="toggle sidebar"
              onClick={toggleSidebar}
              sx={{
                color: '#F2F2F2',
                display: { xs: 'none', md: 'flex' },
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }
              }}
            >
              <LucideMenu size={20} strokeWidth={1.5} />
            </IconButton>

            {/* Logo */}
            <Box component={Link} href={getTopbarLogoHref('flow')} sx={{ mr: { xs: 0, md: 2 }, display: { xs: 'none', sm: 'flex' } }}>
              <Logo size={32} variant="full" app="flow" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, letterSpacing: '-0.04em' }} />
            </Box>
            <Box component={Link} href={getTopbarLogoHref('flow')} sx={{ mr: { xs: 0, md: 2 }, display: { xs: 'flex', sm: 'none' } }}>
              <Logo size={28} variant="icon" app="flow" />
            </Box>

            {/* Search */}
            <Box
              sx={{
                position: 'relative',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: alpha('#6366F1', 0.4),
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
                },
                '&:focus-within': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: '#6366F1',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                },
                width: { xs: 0, sm: 300, md: 400 },
                maxWidth: '100%',
                display: { xs: 'none', sm: 'block' },
                transition: 'all 0.2s ease',
              }}
            >
              <Box
                sx={{
                  padding: theme.spacing(0, 2),
                  height: '100%',
                  position: 'absolute',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Search size={18} strokeWidth={1.5} color="#A1A1AA" />
              </Box>
              <InputBase
                placeholder="Search tasks... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  color: '#F2F2F2',
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  '& .MuiInputBase-input': {
                    padding: theme.spacing(1.5, 1.5, 1.5, 0),
                    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
                    width: '100%',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  },
                }}
              />
            </Box>
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {!shouldCollapseChrome ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          {/* AI Assistant Button */}
          <Tooltip title="AI Assistant">
            <IconButton
              onClick={() => setAiModalOpen(true)}
              sx={{
                backgroundColor: alpha('#6366F1', 0.03),
                color: '#6366F1',
                borderRadius: '12px',
                p: { xs: 1, sm: 1.25 },
                border: '1px solid',
                borderColor: alpha('#6366F1', 0.1),
                '&:hover': {
                  backgroundColor: alpha('#6366F1', 0.08),
                  borderColor: '#6366F1',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)'
                },
              }}
            >
              <Sparkles size={18} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          {/* Wallet Toggle */}
          <Tooltip title="Secure Wallet">
            <IconButton
              onClick={openWallet}
              sx={{
                backgroundColor: alpha('#A855F7', 0.03),
                color: '#A855F7',
                borderRadius: '12px',
                p: { xs: 1, sm: 1.25 },
                border: '1px solid',
                borderColor: alpha('#A855F7', 0.1),
                '&:hover': {
                  backgroundColor: alpha('#A855F7', 0.08),
                  borderColor: '#A855F7',
                  boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)'
                },
              }}
            >
              <Wallet size={18} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          {/* Ecosystem Apps */}
          <Tooltip title="Kylrix Portal (Ctrl+Space)">
            <IconButton
              onClick={() => setPortalOpen(true)}
              sx={{
                color: '#6366F1',
                borderRadius: '12px',
                p: 1.25,
                bgcolor: alpha('#6366F1', 0.05),
                border: '1px solid',
                borderColor: alpha('#6366F1', 0.1),
                '&:hover': {
                  backgroundColor: alpha('#6366F1', 0.1),
                  borderColor: '#6366F1',
                  color: '#6366F1',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)'
                }
              }}
            >
              <LayoutGrid size={20} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              onClick={handleNotifClick}
              sx={{
                color: unreadCount > 0 ? '#6366F1' : 'rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                p: { xs: 1, sm: 1.25 },
                bgcolor: unreadCount > 0 ? alpha('#6366F1', 0.03) : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid',
                borderColor: unreadCount > 0 ? alpha('#6366F1', 0.3) : 'rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  backgroundColor: alpha('#6366F1', 0.08),
                  borderColor: unreadCount > 0 ? '#6366F1' : 'rgba(255, 255, 255, 0.15)',
                  boxShadow: unreadCount > 0 ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none'
                }
              }}
            >
              <Badge
                badgeContent={unreadCount}
                color="primary"
                sx={{
                  '& .MuiBadge-badge': {
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    backgroundColor: '#FF4D4D',
                    color: '#FFFFFF',
                    border: '2px solid #0B0908'
                  }
                }}
              >
                <Bell size={18} strokeWidth={1.5} />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Profile */}
          {user ? (
            <Tooltip title="User Profile">
              <IconButton onClick={handleProfileClick} sx={{ 
                ml: 0.5,
                p: 0.5,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': { borderColor: alpha('#6366F1', 0.3), bgcolor: 'rgba(255, 255, 255, 0.05)', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}>
                <IdentityAvatar
                  src={profileUrl || undefined}
                  alt={user?.name || user?.email || 'profile'}
                  fallback={getInitials(user)}
                  verified={identitySignals.verified}
                  pro={identitySignals.pro}
                  size={32}
                  borderRadius="10px"
                />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              href={`${getEcosystemUrl('accounts')}/login?source=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`}
              variant="contained"
              size="large"
              sx={{
                ml: 1,
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontFamily: 'var(--font-satoshi)',
                borderRadius: '14px',
                textTransform: 'none',
                px: 3,
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.15)',
                '&:hover': { background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)' }
              }}
            >
              Connect
            </Button>
          )}
          </Box>
        ) : null}

        {/* Profile Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          onClick={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              width: 260,
              mt: 2,
              borderRadius: '24px',
              bgcolor: 'rgba(11, 9, 8, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundImage: 'none',
              p: 1,
              color: 'white'
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {user && (
            <Box sx={{ px: 3, py: 2.5, bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Account Identity
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', mt: 0.5, opacity: 0.9 }}>
                {user?.email}
              </Typography>
            </Box>
          )}
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 1 }} />
          <MenuItem 
            sx={{ py: 1.5, px: 2.5, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
            onClick={() => {
              if (profileUsername) {
                router.push(`${getEcosystemUrl('connect')}/u/${encodeURIComponent(profileUsername)}?transition=profile`);
              }
              handleClose();
            }}
          >
            <ListItemIcon>
              <User size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.6)" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}>Profile</ListItemText>
          </MenuItem>
          <MenuItem
            sx={{ py: 1.5, px: 2.5, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
            onClick={() => {
              handleClose();
              const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
              const idSubdomain = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN || 'accounts';
              router.push(`/accounts/settings?source=${encodeURIComponent(window.location.origin)}&tab=profile`);
            }}
          >
            <ListItemIcon>
              <Settings size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.6)" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}>Account Settings</ListItemText>
          </MenuItem>
          <MenuItem
            sx={{ py: 1.5, px: 2.5, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
            onClick={() => {
              alert('Exporting your data...');
              handleClose();
            }}
          >
            <ListItemIcon>
              <Download size={18} strokeWidth={1.5} color="#FFC107" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: 700, color: '#FFC107', fontSize: '0.9rem' }}>Export Data</ListItemText>
          </MenuItem>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 1 }} />
          <MenuItem sx={{ py: 1.5, px: 2.5, borderRadius: '14px', color: '#FF4D4D', '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.05)' } }} onClick={() => logout()}>
            <ListItemIcon>
              <LogOut size={18} strokeWidth={1.5} color="#FF4D4D" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}>Sign out</ListItemText>
          </MenuItem>
        </Menu>

        {/* Apps Menu */}
        <Menu
          anchorEl={appsAnchorEl}
          open={Boolean(appsAnchorEl)}
          onClose={handleClose}
          onClick={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              width: 340,
              mt: 2,
              p: 2,
              borderRadius: '28px',
              bgcolor: 'rgba(11, 9, 8, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundImage: 'none',
              color: 'white'
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Typography variant="overline" sx={{ px: 1.5, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
            Ecosystem
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
              mt: 2
            }}
          >
            {ECOSYSTEM_APPS.map((app) => (
              <Box
                key={app.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: 2,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    borderColor: alpha(app.color, 0.3),
                    transform: 'translateY(-4px)',
                    boxShadow: `0 10px 20px ${alpha(app.color, 0.05)}`
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    backgroundColor: alpha(app.color, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    mb: 1.5,
                    border: `1px solid ${alpha(app.color, 0.15)}`
                  }}
                >
                  {app.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-satoshi)',
                    color: 'white'
                  }}
                >
                  {app.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={notifAnchorEl}
          open={Boolean(notifAnchorEl)}
          onClose={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              width: 380,
              mt: 2,
              borderRadius: '28px',
              bgcolor: 'rgba(11, 9, 8, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundImage: 'none',
              color: 'white',
              p: 1
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              Intelligence Feed
            </Typography>
            {unreadCount > 0 && (
              <Typography
                variant="caption"
                onClick={() => { markAllAsRead(); handleClose(); }}
                sx={{ cursor: 'pointer', color: '#6366F1', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}
              >
                Clear all
              </Typography>
            )}
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', mb: 1 }} />
          <Box sx={{ maxHeight: 440, overflowY: 'auto', px: 1 }}>
            {notifications.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Clock size={40} color="rgba(255, 255, 255, 0.05)" style={{ marginBottom: 16, marginLeft: 'auto', marginRight: 'auto' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>
                  Silence in the void
                </Typography>
              </Box>
            ) : (
              notifications.slice(0, 10).map((notif) => {
                const isRead = !!localStorage.getItem(`read_notif_${notif.$id}`);
                return (
                  <MenuItem
                    key={notif.$id}
                    onClick={() => { markAsRead(notif.$id); handleClose(); }}
                    sx={{
                      py: 2.5,
                      px: 2,
                      mb: 1,
                      borderRadius: '16px',
                      borderLeft: isRead ? '1px solid rgba(255,255,255,0.05)' : '3px solid #6366F1',
                      backgroundColor: isRead
                        ? 'transparent'
                        : 'rgba(99, 102, 241, 0.02)',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                      <Box sx={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '12px', 
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        {notif.action.toLowerCase().includes('delete') ? (
                          <XCircle size={18} color="#FF4D4D" />
                        ) : (
                          <CheckCircle size={18} color="#6366F1" />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2, fontFamily: 'var(--font-satoshi)' }}>
                          {notif.action.toUpperCase()}
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.targetType}: {notif.details || notif.targetId}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', mt: 0.5, display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                          {new Date(notif.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })
            )}
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 1 }} />
          <MenuItem sx={{ justifyContent: 'center', py: 2, borderRadius: '16px', '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.05)' } }}>
            <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 800, letterSpacing: '0.05em' }}>
              REVEAL ALL ACTIVITY
            </Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
      <AICommandModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />
      <EcosystemPortal open={portalOpen} onClose={() => setPortalOpen(false)} />

      <Menu
        anchorEl={islandAnchorEl}
        open={Boolean(islandAnchorEl && islandNotification)}
        onClose={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            width: 420,
            mt: 2,
            borderRadius: '28px',
            bgcolor: 'rgba(11, 9, 8, 0.98)',
            border: `1px solid ${alpha(islandColor, 0.25)}`,
            backgroundImage: 'none',
            color: 'white',
            p: 1,
            boxShadow: `0 0 28px ${alpha(islandColor, 0.12)}`,
          },
        }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Logo size={28} variant="icon" app={islandApp as any} />
            <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              {islandNotification?.title || 'Notification'}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>
            {islandNotification?.message || 'No message provided.'}
          </Typography>
        </Box>
      </Menu>
    </MuiAppBar>
  );
}
