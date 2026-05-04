"use client";

import React, { useState, useEffect } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Box, 
  Typography, 
  IconButton, 
  Menu, 
  MenuItem, 
  Tooltip, 
  Divider,
  ListItemIcon,
  ListItemText,
  alpha,
  Button
} from '@mui/material';
import {
  Settings,
  LogOut,
  LayoutGrid,
  Bell,
  Clock
} from 'lucide-react';
import { account, AppwriteService } from '@/lib/appwrite';
import { useAuth } from '@/context/AuthContext';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { getUserProfilePicId } from '@/lib/user-utils';
import EcosystemPortal from '../EcosystemPortal';
import { ReferralInfoDrawer } from '../ReferralInfoDrawer';
import { IdentityAvatar, IdentityName, computeIdentityFlags } from '../IdentityBadge';
import Logo from '../Logo';
import { useRouter } from 'next/navigation';
import { getTopbarLogoHref } from '@/lib/sdk';

export const AppHeader = () => {
  const { user, refresh } = useAuth();
  const [anchorElAccount, setAnchorElAccount] = useState<null | HTMLElement>(null);
  const [anchorElNotifications, setAnchorElNotifications] = useState<null | HTMLElement>(null);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [referralDrawerOpen, setReferralDrawerOpen] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [referralHasLinked, setReferralHasLinked] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referralNote, setReferralNote] = useState<string | null>(null);
  const [referralUsername, setReferralUsername] = useState<string | null>(null);
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const router = useRouter();
  const REFERRAL_PENDING_KEY = 'kylrix_pending_referral_username';
  const REFERRAL_SUPPRESS_KEY = 'kylrix_referral_drawer_suppressed_until';
  const REFERRAL_SEEN_KEY = 'kylrix_referral_drawer_seen';

  useEffect(() => {
    let mounted = true;
    const profilePicId = getUserProfilePicId(user) || profileRecord?.profilePicId || null;
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
  }, [user, profileRecord?.profilePicId]);

  useEffect(() => {
    let mounted = true;
    const loadProfileRecord = async () => {
      if (!user?.$id) return;
      try {
        const status = await AppwriteService.getGlobalProfileStatus(user.$id);
        if (!mounted) return;
        setProfileRecord(status?.profile || null);
      } catch (error) {
        console.warn('[Referral] Failed to load live profile for identity badges:', error);
      }
    };

    loadProfileRecord();
    return () => {
      mounted = false;
    };
  }, [user?.$id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rawHash = window.location.hash.replace(/^#/, '');
    const match = rawHash.match(/(?:^|&)refer=([^&]+)/i);
    if (match?.[1]) {
      const username = decodeURIComponent(match[1]).trim();
      if (username) {
        window.localStorage.setItem(REFERRAL_PENDING_KEY, username);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapReferral = async () => {
      if (!user || typeof window === 'undefined') return;

      try {
        await AppwriteService.ensureGlobalProfile(user, false);
        const status = await AppwriteService.getReferralStatus();
        if (!mounted) return;

        setReferralLink(status?.referralLink || null);
        setReferralHasLinked(Boolean(status?.hasReferral));
        setReferrerName((status as any)?.referrer?.username ? `@${(status as any).referrer.username}` : null);
        setReferralUsername(status?.currentUsername || null);

        const pending = window.localStorage.getItem(REFERRAL_PENDING_KEY);
        if (pending) {
          if (!status?.hasReferral) {
            setReferralNote(`Applying referral from @${pending}...`);
            const applied = await AppwriteService.applyReferral(pending);
            if (!mounted) return;
            if (applied?.success) {
              setReferralHasLinked(true);
              setReferrerName((applied as any)?.referrer?.username ? `@${(applied as any).referrer.username}` : `@${pending}`);
              setReferralLink(applied?.referralLink || status?.referralLink || null);
              setReferralUsername(status?.currentUsername || null);
              setReferralNote(`Referral linked successfully from @${pending}.`);
              setReferralDrawerOpen(true);
              window.localStorage.removeItem(REFERRAL_PENDING_KEY);
              window.localStorage.setItem(REFERRAL_SEEN_KEY, '1');
            } else {
              setReferralNote(applied?.error || `Could not apply referral from @${pending}.`);
              setReferralDrawerOpen(true);
            }
          } else {
            window.localStorage.removeItem(REFERRAL_PENDING_KEY);
            setReferralNote(`You already have a referral record, so @${pending} was ignored.`);
            setReferralDrawerOpen(true);
            window.localStorage.setItem(REFERRAL_SEEN_KEY, '1');
          }
          return;
        }

        const suppressedUntil = Number(window.localStorage.getItem(REFERRAL_SUPPRESS_KEY) || '0');
        if (suppressedUntil > Date.now()) return;

        if (!status?.hasReferral && !window.localStorage.getItem(REFERRAL_SEEN_KEY)) {
          setReferralNote('Your referral link is ready. You can copy it now or set who referred you in Settings.');
          setReferralDrawerOpen(true);
          window.localStorage.setItem(REFERRAL_SEEN_KEY, '1');
        }
      } catch (error) {
        console.warn('[Referral] Bootstrap failed:', error);
      }
    };

    bootstrapReferral();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handleCloseReferralDrawer = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REFERRAL_SUPPRESS_KEY, String(Date.now() + 60_000));
    }
    setReferralDrawerOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        setIsPortalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setAnchorElAccount(null);
    try {
      await account.deleteSession('current');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REFERRAL_PENDING_KEY);
        window.localStorage.removeItem(REFERRAL_SEEN_KEY);
        window.localStorage.removeItem(REFERRAL_SUPPRESS_KEY);
      }
      setReferralDrawerOpen(false);
      setReferralNote(null);
      await refresh();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const identitySignals = computeIdentityFlags({
    createdAt: (user as any)?.$createdAt || (user as any)?.createdAt,
    lastUsernameEdit: profileRecord?.last_username_edit || (user?.prefs as any)?.last_username_edit,
    profilePicId: profileRecord?.profilePicId || getUserProfilePicId(user) || null,
    username: profileRecord?.username || (user?.prefs as any)?.username || user?.name || null,
    bio: profileRecord?.bio || (user?.prefs as any)?.bio || null,
    tier: profileRecord?.tier || (user?.prefs as any)?.tier || null,
    publicKey: profileRecord?.publicKey || null,
    emailVerified: Boolean((user as any)?.emailVerification),
  });

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: 1201,
        bgcolor: '#161514',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundImage: 'none'
      }}
    >
      <Toolbar sx={{ 
        justifyContent: 'space-between',
        px: { xs: 2, md: 4 }, 
        minHeight: '88px' 
      }}>
        {/* Left: Logo */}
        <Logo 
          app="accounts" 
          size={32} 
          sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          component="a"
            href={getTopbarLogoHref('accounts')}
        />

        {/* Right: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
          <Tooltip title="activity (Coming Soon)">
            <IconButton 
              onClick={(e) => setAnchorElNotifications(e.currentTarget)}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.4)',
                bgcolor: '#1F1D1B',
                border: '1px solid',
                borderColor: alpha('#F43F5E', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                '&:hover': { 
                  bgcolor: '#1F1D1B', 
                  boxShadow: '0 0 15px rgba(244, 63, 94, 0.2)' 
                }
              }}
            >
              <Bell size={18} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Kylrix Portal (Ctrl+Space)">
            <IconButton 
              onClick={() => setIsPortalOpen(true)}
              sx={{ 
                color: '#6366F1',
                bgcolor: '#1F1D1B',
                border: '1px solid',
                borderColor: alpha('#6366F1', 0.1),
                borderRadius: '12px',
                width: { xs: 36, sm: 42 },
                height: { xs: 36, sm: 42 },
                animation: 'pulse-slow 4s infinite ease-in-out',
                '@keyframes pulse-slow': {
                  '0%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.2)' },
                  '70%': { boxShadow: '0 0 0 10px rgba(99, 102, 241, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
                },
                '&:hover': { 
                  bgcolor: '#1F1D1B', 
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
              href="/login"
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
              bgcolor: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              backgroundImage: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ px: 3, py: 2.5, bgcolor: '#161514' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Account Identity
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <IdentityName verified={identitySignals.verified} sx={{ fontWeight: 700, color: 'white', opacity: 0.9 }}>
                {user?.name || user?.email}
              </IdentityName>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', mt: 0.5, opacity: 0.65 }}>
              {user?.email}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <Box sx={{ py: 1 }}>
            <MenuItem 
              onClick={() => {
                const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
                const idSubdomain = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN || 'accounts';
                window.location.href = `https://${idSubdomain}.${domain}/settings?source=${encodeURIComponent(window.location.origin)}&tab=profile`;
                setAnchorElAccount(null);
              }}
              sx={{ py: 1.5, px: 3, '&:hover': { bgcolor: '#1F1D1B' } }}
            >
              <ListItemIcon><Settings size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.4)" /></ListItemIcon>
              <ListItemText primary="Settings" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white' }} />
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
              bgcolor: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              backgroundImage: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#161514' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              activity
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Clock size={32} color="rgba(255, 255, 255, 0.1)" style={{ marginBottom: 12, marginLeft: 'auto', marginRight: 'auto' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
              No recent activity detected
            </Typography>
          </Box>
        </Menu>

        <ReferralInfoDrawer
          open={referralDrawerOpen}
          onClose={handleCloseReferralDrawer}
          referralLink={referralLink}
          currentUsername={referralUsername || (user?.prefs as any)?.username || user?.name || null}
          hasReferral={referralHasLinked}
          referrerName={referrerName}
          note={referralNote}
          onOpenSettings={() => {
            setReferralDrawerOpen(false);
            router.push('/settings/profile');
          }}
          onCopyLink={async () => {
            if (!referralLink) return;
            await navigator.clipboard.writeText(referralLink);
            setReferralNote('Referral link copied.');
          }}
        />

        <EcosystemPortal 
          open={isPortalOpen} 
          onClose={() => setIsPortalOpen(false)} 
        />
      </Toolbar>
    </AppBar>
  );
};
