"use client";

import { useRouter } from 'next/navigation';
import { 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  Box, 
  alpha,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  InputBase,
  Button
} from '@mui/material';
import { 
  Bell, 
  Sparkles, 
  LayoutGrid, 
  Settings, 
  LogOut, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock,
  Menu as MenuIcon,
  Search,
  Wallet
} from 'lucide-react';
import { SubscriptionBadge } from '@/context/subscription';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useAI } from '@/context/AIContext';
import { useNotifications } from '@/context/NotificationContext';
import { useState, useEffect } from 'react';
import EcosystemPortal from '../common/EcosystemPortal';
import { getEcosystemUrl } from '@/lib/constants/ecosystem';
import Logo from '../common/Logo';
import { getUserProfilePicId } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from '../common/IdentityBadge';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

// Pages that should use the simplified layout (no sidebar/header)
const SIMPLIFIED_LAYOUT_PATHS = ["/"];

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAppwriteVault();
  const { openAIModal } = useAI();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const { openWallet } = useWalletOverlay();

  const [anchorElAccount, setAnchorElAccount] = useState<null | HTMLElement>(null);
  const [anchorElNotifications, setAnchorElNotifications] = useState<null | HTMLElement>(null);
  const [isEcosystemPortalOpen, setIsEcosystemPortalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const profileUsername = String((user?.prefs as any)?.username || user?.name || '').trim();

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
    let mounted = true;
    const loadProfileRecord = async () => {
      if (!profileUsername) return;
      try {
        const results = await searchGlobalUsers(profileUsername, 1);
        if (!mounted) return;
        setProfileRecord(results[0] || null);
      } catch (error) {
        console.warn('[Vault Header] Failed to load profile record:', error);
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

  if (SIMPLIFIED_LAYOUT_PATHS.includes(pathname)) {
    return null;
  }

  const handleLogout = async () => {
    setAnchorElAccount(null);
    await logout();
  };

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: 1201,
        bgcolor: 'var(--color-surface)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundImage: 'none'
      }}
    >
      <Toolbar sx={{ 
        gap: 2, 
        '@media (min-width: 900px)': { gap: 4 },
        px: { xs: 2, md: 4 }, 
        minHeight: '88px' 
      }}>
        {/* Left: Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <IconButton
            onClick={onMenuClick}
            sx={{ 
              display: { lg: 'none' },
              color: 'rgba(255, 255, 255, 0.6)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            <MenuIcon size={20} strokeWidth={1.5} />
          </IconButton>
          <Logo 
            app="vault" 
            size={32} 
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
            component="a"
            href="/"
          />
        </Box>

        {/* Center: Search */}
        <Box sx={{ flexGrow: 1, maxWidth: 700, display: { xs: 'none', md: 'block' } }}>
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              px: 2,
              py: 0.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: alpha('#6366F1', 0.4),
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
              },
              '&:focus-within': {
                borderColor: '#6366F1',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
              }
            }}
          >
            <Search size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.4)" />
            <Box sx={{ width: 12 }} />
            <InputBase
              placeholder="Search vault, credentials, folders..."
              fullWidth
              sx={{
                color: 'text.primary',
                fontSize: '0.9375rem',
                fontWeight: 500,
                '& .MuiInputBase-input::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.5,
                },
              }}
            />
          </Box>
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
          <Tooltip title="Intelligence Feed">
            <IconButton 
              onClick={(e) => setAnchorElNotifications(e.currentTarget)}
              sx={{ 
                color: unreadCount > 0 ? '#6366F1' : 'rgba(255, 255, 255, 0.4)',
                bgcolor: alpha('#6366F1', 0.03),
                border: '1px solid',
                borderColor: unreadCount > 0 ? alpha('#6366F1', 0.3) : alpha('#6366F1', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                position: 'relative',
                '&:hover': { 
                  bgcolor: alpha('#6366F1', 0.08), 
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)' 
                }
              }}
            >
              <Bell size={18} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <Box sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  bgcolor: '#FF4D4D',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0A0A0A',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Box>
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Cognitive Link (AI)">
            <IconButton 
              onClick={openAIModal}
              sx={{ 
                color: '#6366F1',
                bgcolor: alpha('#6366F1', 0.03),
                border: '1px solid',
                borderColor: alpha('#6366F1', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                '&:hover': { 
                  bgcolor: alpha('#6366F1', 0.08), 
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)' 
                }
              }}
            >
              <Sparkles size={18} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Secure Wallet">
            <IconButton 
              onClick={openWallet}
              sx={{ 
                color: '#10B981',
                bgcolor: alpha('#10B981', 0.03),
                border: '1px solid',
                borderColor: alpha('#10B981', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                '&:hover': { 
                  bgcolor: alpha('#10B981', 0.08), 
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' 
                }
              }}
            >
              <Wallet size={18} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Kylrix Portal (Ctrl+Space)">
            <IconButton 
              onClick={() => setIsEcosystemPortalOpen(true)}
              sx={{ 
                color: '#6366F1',
                bgcolor: alpha('#6366F1', 0.05),
                border: '1px solid',
                borderColor: alpha('#6366F1', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                animation: 'pulse-slow 4s infinite ease-in-out',
                display: { xs: 'none', sm: 'flex' },
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
              <LayoutGrid size={20} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          {user ? (
            <IconButton 
              onClick={(e) => setAnchorElAccount(e.currentTarget)}
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
          ) : (
            <Button
              href={`${getEcosystemUrl('accounts')}/login?source=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`}
              variant="contained"
              size="small"
              sx={{
                ml: 1,
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 800,
                borderRadius: '10px',
                '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
              }}
            >
              Connect
            </Button>
          )}
        </Box>

        {/* Account Menu */}
        <Menu
          anchorEl={anchorElAccount}
          open={Boolean(anchorElAccount)}
          onClose={() => setAnchorElAccount(null)}
          PaperProps={{
            sx: {
              mt: 1.5,
              width: 280,
              bgcolor: 'rgba(11, 9, 8, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              backgroundImage: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ px: 3, py: 2.5, bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Account Identity
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', mt: 0.5, opacity: 0.9 }}>
              {user?.email}
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <SubscriptionBadge showFree />
            </Box>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <Box sx={{ py: 1 }}>
            <MenuItem 
              onClick={() => {
                setAnchorElAccount(null);
                const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
                const idSubdomain = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN || 'accounts';
                router.push(`/accounts/settings?source=${encodeURIComponent(window.location.origin)}&tab=profile`);
              }}
              sx={{ py: 1.5, px: 3, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
            >
              <ListItemIcon><Settings size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.4)" /></ListItemIcon>
              <ListItemText primary="Settings" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white' }} />
            </MenuItem>
            <MenuItem 
              onClick={() => {
                setAnchorElAccount(null);
              }}
              sx={{ py: 1.5, px: 3, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
            >
              <ListItemIcon><Download size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.4)" /></ListItemIcon>
              <ListItemText primary="Export Data" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white' }} />
            </MenuItem>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <MenuItem onClick={handleLogout} sx={{ py: 2, px: 3, color: '#FF4D4D', '&:hover': { bgcolor: alpha('#FF4D4D', 0.05) } }}>
            <ListItemIcon><LogOut size={18} strokeWidth={1.5} color="#FF4D4D" /></ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
          </MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={anchorElNotifications}
          open={Boolean(anchorElNotifications)}
          onClose={() => setAnchorElNotifications(null)}
          PaperProps={{
            sx: {
              mt: 1.5,
              width: 360,
              bgcolor: 'rgba(11, 9, 8, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              backgroundImage: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Intelligence Feed
            </Typography>
            {unreadCount > 0 && (
              <Typography 
                variant="caption" 
                onClick={() => { markAllAsRead(); setAnchorElNotifications(null); }}
                sx={{ cursor: 'pointer', fontWeight: 800, color: '#6366F1', '&:hover': { textDecoration: 'underline' } }}
              >
                MARK ALL READ
              </Typography>
            )}
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Clock size={32} color="rgba(255, 255, 255, 0.1)" style={{ marginBottom: 12, marginLeft: 'auto', marginRight: 'auto' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                  No recent activity detected
                </Typography>
              </Box>
            ) : (
              notifications.slice(0, 10).map((notif) => {
                const detailsParsed = (() => {
                  try { return JSON.parse(notif.details || '{}'); } catch { return { read: false }; }
                })();
                const isRead = detailsParsed.read;
                return (
                  <MenuItem 
                    key={notif.$id} 
                    onClick={() => { markAsRead(notif.$id); setAnchorElNotifications(null); }}
                    sx={{ 
                      py: 2, 
                      px: 3, 
                      gap: 2,
                      borderLeft: isRead ? 'none' : '3px solid #6366F1',
                      bgcolor: isRead ? 'transparent' : alpha('#6366F1', 0.03),
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } 
                    }}
                  >
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '12px', 
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {notif.action.toLowerCase().includes('delete') ? (
                        <XCircle size={20} color="#FF4D4D" />
                      ) : (
                        <CheckCircle size={20} color="#6366F1" />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', display: 'block' }}>
                        {notif.action.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" noWrap sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {notif.targetType}: {notif.targetId}
                      </Typography>
                    </Box>
                  </MenuItem>
                );
              })
            )}
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <MenuItem sx={{ py: 2, justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em' }}>
              VIEW ALL ACTIVITY
            </Typography>
          </MenuItem>
        </Menu>

        <EcosystemPortal 
          open={isEcosystemPortalOpen} 
          onClose={() => setIsEcosystemPortalOpen(false)} 
        />

        </Toolbar>
        </AppBar>
        );
        }
