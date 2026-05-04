'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  alpha,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ChevronDown,
  Wallet,
} from 'lucide-react';

import Logo from '@/components/common/Logo';
import { WalletSidebar } from '@/components/overlays/WalletSidebar';
import { useAuth } from '@/lib/auth';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { getUserProfilePicId } from '@/lib/user-utils';
import { getEcosystemUrl } from '@/lib/constants';
import { TOPBAR_LAYOUT, getAppTone } from '@/lib/sdk/design';
import { createEcosystemPanelItems, createTopbarPanelMotion, isTopbarScrollAtBottom, isTopbarScrollAtTop } from '@/lib/sdk/topbar';
import { createProfilePreviewManager, getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/sdk/appwrite';
import { stageProfileView } from '@/lib/profile-handoff';
import { getAppColor } from '@/lib/ecosystem-app-colors';

interface ConnectTopbarProps {
  className?: string;
}

function isRenderableImageSrc(value?: string | null) {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

export default function ConnectTopbar({
  className,
}: ConnectTopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);
  const tone = getAppTone('connect');
  const profileName = user?.name || user?.email || 'Connect user';
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

  const handleCloseAll = useCallback(() => {
    setProfileMenuAnchorEl(null);
    setAppMenuAnchorEl(null);
  }, []);

  const openAppMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const openProfileMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setProfileMenuAnchorEl(event.currentTarget);
  }, []);

  const connectApps = useMemo(
    () =>
      createEcosystemPanelItems('connect').map((item) => ({
        ...item,
        href: getEcosystemUrl(item.app),
      })),
    [],
  );

  const appPanelMotion = useMemo(() => createTopbarPanelMotion(), []);

  const activePanel = profileMenuAnchorEl ? 'profile' : appMenuAnchorEl ? 'ecosystem' : null;

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

  const renderProfilePanel = () => {
    if (!profileMenuAnchorEl || !user) return null;
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
              {connectApps.map((item) => {
                const appTone = getAppTone(item.app);
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
              <Logo app="connect" size={32} />
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

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
              {user && (
                <Tooltip title="Wallet">
                  <IconButton
                    onClick={() => setIsWalletOpen(true)}
                    sx={{
                      color: getAppColor('connect'),
                      bgcolor: alpha(getAppColor('connect'), 0.03),
                      border: '1px solid',
                      borderColor: alpha(getAppColor('connect'), 0.1),
                      borderRadius: '12px',
                      width: 42,
                      height: 42,
                      '&:hover': { bgcolor: alpha(getAppColor('connect'), 0.08) },
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
                    bgcolor: profileAvatarUrl ? 'rgba(255,255,255,0.04)' : tone.secondary,
                    color: '#fff',
                    fontWeight: 900,
                    borderRadius: '12px',
                  }}
                >
                  {user ? profileName.slice(0, 1).toUpperCase() : 'C'}
                </Avatar>
              </ButtonBase>
            </Stack>
          </Box>
        </Box>

        {renderAppPanel()}
        {renderProfilePanel()}
      </AppBar>
      {isWalletOpen ? <WalletSidebar isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} /> : null}
    </>
  );
}
