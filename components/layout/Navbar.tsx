"use client";

import Link from 'next/link';
import { useAppwriteVault } from '@/context/appwrite-context';
import { getTopbarLogoHref, getEcosystemUrl } from '@/lib/sdk';
import {
  GridViewOutlined as GripIcon,
  AutoAwesomeOutlined as SparklesIcon,
  VpnKeyOutlined as KeyIcon,
  SettingsOutlined as SettingsIcon,
  LockOutlined as LockIcon,
  LogoutOutlined as LogOutIcon,
} from '@mui/icons-material';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import { useState, useEffect } from 'react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useAI } from '@/context/AIContext';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import EcosystemPortal from '../common/EcosystemPortal';
import Logo from '../common/Logo';
import { getUserProfilePicId } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from '../common/IdentityBadge';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';

const PasswordGenerator = dynamic(() => import("@/components/ui/PasswordGenerator"), { 
  loading: () => <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>,
  ssr: false 
});

export function Navbar() {
  const { user, logout } = useAppwriteVault();
  const { openAIModal } = useAI();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isEcosystemPortalOpen, setIsEcosystemPortalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const profileUsername = String((user?.prefs as any)?.username || user?.name || '').trim();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const profilePicId = getUserProfilePicId(user);
    const cached = getCachedProfilePreview(profilePicId || undefined);
    if (cached !== undefined && mounted) {
      setTimeout(() => {
        if (mounted) setProfileUrl(cached ?? null);
      }, 0);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        setIsEcosystemPortalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfileRecord = async () => {
      if (!profileUsername) return;
      try {
        const results = await searchGlobalUsers(profileUsername, 1);
        if (!mounted) return;
        setProfileRecord(results[0] || null);
      } catch (error) {
        console.warn('[Vault Navbar] Failed to load profile record:', error);
      }
    };
    loadProfileRecord();
    return () => {
      mounted = false;
    };
  }, [profileUsername]);

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

  const isCorePage = [
    "/dashboard",
    "/credentials",
    "/totp",
    "/import",
    "/sharing",
    "/overview"
  ].some(path => pathname?.startsWith(path));

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'rgba(15, 13, 12, 0.8)',
        backdropFilter: 'blur(25px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'none',
        backgroundImage: 'none'
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 80, px: { xs: 2, md: 4 } }}>
        <Logo 
          size={32} 
          app="vault" 
          component={Link} 
          href={getTopbarLogoHref('vault')} 
          sx={{ 
            color: 'inherit',
            '&:hover': { opacity: 0.8 }
          }} 
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Kylrix Portal (Ctrl+Space)">
            <IconButton
              onClick={() => setIsEcosystemPortalOpen(true)}
              sx={{ 
                color: '#6366F1', 
                bgcolor: alpha('#6366F1', 0.05),
                borderRadius: '12px',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                width: 42,
                height: 42,
                animation: 'pulse-slow 4s infinite ease-in-out',
                '@keyframes pulse-slow': {
                  '0%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.2)' },
                  '70%': { boxShadow: '0 0 0 10px rgba(99, 102, 241, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
                },
                '&:hover': { 
                  bgcolor: alpha('#6366F1', 0.1), 
                  borderColor: '#6366F1',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)' 
                }
              }}
            >
              <GripIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          {user && isCorePage && (
            <Tooltip title="Cognitive Link (AI)">
              <IconButton
                onClick={openAIModal}
                sx={{ 
                  color: '#6366F1', 
                  bgcolor: alpha('#6366F1', 0.03),
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  width: 42,
                  height: 42,
                  '&:hover': { bgcolor: alpha('#6366F1', 0.08), boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)' } 
                }}
              >
                <SparklesIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}

          <DropdownMenu
            trigger={
              <Tooltip title="Password Generator">
                <IconButton sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: 42,
                  height: 42,
                  '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.2)' } 
                }}>
                  <KeyIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            }
            width="400px"
            align="right"
          >
            <Box sx={{ p: 3, bgcolor: 'rgba(11, 9, 8, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px' }}>
              <PasswordGenerator />
            </Box>
          </DropdownMenu>

          {!user ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                window.location.href = `https://accounts.kylrix.space/login?source=${encodeURIComponent(window.location.origin)}`;
              }}
              sx={{ 
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 800,
                borderRadius: '10px',
                px: 3,
                '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
              }}
            >
              Connect
            </Button>
          ) : (
            <Box>
              <IconButton 
                onClick={handleOpenMenu}
                sx={{ 
                  p: 0.5,
                  '&:hover': { transform: 'scale(1.05)' },
                  transition: 'transform 0.2s'
                }}
              >
                <IdentityAvatar
                  src={profileUrl || undefined}
                  alt={user?.name || user?.email || 'profile'}
                  fallback={user?.name ? user.name[0].toUpperCase() : 'U'}
                  verified={identitySignals.verified}
                  pro={identitySignals.pro}
                  size={38}
                  borderRadius="12px"
                />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
                PaperProps={{
                  sx: {
                    mt: 2,
                    minWidth: 260,
                    bgcolor: 'rgba(11, 9, 8, 0.98)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
                    backgroundImage: 'none',
                    color: 'white',
                    p: 1
                  }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <Box sx={{ px: 2.5, py: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                    {user.name || user.email}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                    {user.email}
                  </Typography>
                </Box>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 1 }} />
                <MenuItem 
                  onClick={() => {
                    if (profileUsername) {
                      window.location.href = `${getEcosystemUrl('CONNECT')}/u/${encodeURIComponent(profileUsername)}?transition=profile`;
                    }
                    handleCloseMenu();
                  }} 
                  sx={{ py: 1.8, px: 2.5, gap: 2, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
                >
                  <SettingsIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.6)" }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Profile</Typography>
                </MenuItem>
                <MenuItem 
                  onClick={() => {
                    window.location.href = `https://accounts.kylrix.space/settings?source=${encodeURIComponent(window.location.origin)}`;
                    handleCloseMenu();
                  }} 
                  sx={{ py: 1.8, px: 2.5, gap: 2, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
                >
                  <SettingsIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.6)" }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Account Settings</Typography>
                </MenuItem>
                <MenuItem
                  sx={{ py: 1.8, px: 2.5, gap: 2, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' } }}
                  onClick={() => {
                    import("@/lib/masterpass-crypto").then(({ masterPassCrypto }) => {
                      masterPassCrypto.lockNow();
                      sessionStorage.setItem("masterpass_return_to", window.location.pathname);
                      window.location.replace("/dashboard");
                    });
                    handleCloseMenu();
                  }}
                >
                  <LockIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.6)" }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Lock Vault</Typography>
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 1 }} />
                <MenuItem
                  onClick={async () => {
                    handleCloseMenu();
                    await logout();
                  }}
                  sx={{ py: 1.8, px: 2.5, gap: 2, borderRadius: '14px', color: '#FF4D4D', '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.05)' } }}
                >
                  <LogOutIcon sx={{ fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Logout</Typography>
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Box>
      </Toolbar>
      <EcosystemPortal 
        open={isEcosystemPortalOpen} 
        onClose={() => setIsEcosystemPortalOpen(false)} 
      />
    </AppBar>
  );
}
