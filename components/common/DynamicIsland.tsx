'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  Button,
  Paper,
  TextField as _TextField,
  List as _List,
  ListItemButton,
  ListItemAvatar as _ListItemAvatar,
  Avatar as _Avatar,
  Divider as _Divider,
  IconButton,
  Skeleton,
  Stack,
  alpha,
} from '@mui/material';
import { motion, AnimatePresence as _AnimatePresence, useAnimation as _useAnimation } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSudo as _useSudo } from '@/context/SudoContext';
import { useAppChrome as _useAppChrome } from '@/components/providers/AppChromeProvider';
import { ChatService as _ChatService } from '@/lib/services/chat';
import { UsersService as _UsersService } from '@/lib/services/users';
import { ecosystemSecurity as _ecosystemSecurity } from '@/lib/ecosystem/security';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/constants';
import { getCachedIdentityById, seedIdentityCache as _seedIdentityCache } from '@/lib/identity-cache';
import { stageProfileView } from '@/lib/profile-handoff';
import { useProfile } from '@/components/providers/ProfileProvider';
import { useCachedProfilePreview } from '@/hooks/useCachedProfilePreview';
import { default as _toast } from 'react-hot-toast';
import { IslandContext } from "./DynamicIslandContext";
import type { IslandPanel } from "./DynamicIslandContext";

import Logo from './Logo';
import { 
  CheckCircle as _SuccessIcon, 
  Error as _ErrorIcon, 
  Info as _InfoIcon, 
  Warning as _WarningIcon, 
  Star as _ProIcon,
  EmojiObjects as _IdeaIcon,
  Message as _ConnectIcon,
} from '@mui/icons-material';
import {
  Search as _SearchIcon,
  ArrowRight as _ArrowRightIcon,
  Copy as CopyIcon,
  X as CloseIcon,
  MessageCircle as _MessageCircleIcon,
  Phone as _PhoneIcon,
  Settings as _SettingsIcon,
  User as UserIcon,
  LogOut as _LogOutIcon,
  Sparkles as _SparklesIcon,
} from 'lucide-react';
import { IdentityAvatar } from './IdentityBadge';

export type IslandType = 'success' | 'error' | 'warning' | 'info' | 'pro' | 'system' | 'suggestion' | 'connect';

import type { KylrixApp } from '@/lib/sdk/orchestration';

type _KylrixAppLegacy = 'root' | 'vault' | 'flow' | 'note' | 'connect';
export interface IslandNotification {
  id: string;
  type: IslandType;
  title: string;
  message?: string;
  app?: KylrixApp;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  majestic?: boolean;
  shape?: 'island' | 'ball' | 'pill';
  personal?: boolean;
}

export const IslandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<IslandNotification[]>([]);
  const [panel, setPanel] = useState<IslandPanel | null>(null);
  const [lastActivity, setLastActivity] = useState(0);
  const activeNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  useEffect(() => {
    const timer = setTimeout(() => setLastActivity(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);
  const { user } = useAuth();
  const theme = useTheme();
  const _isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  const showIsland = useCallback((notification: Omit<IslandNotification, 'id'>) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const newNotif = { ...notification, id, duration: notification.duration || (notification.majestic ? 10000 : 6000) };
    setNotifications((prev) => [...prev, newNotif]);
  }, []);

  const _dismissIsland = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const openPanel = useCallback((nextPanel: IslandPanel) => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);

  useEffect(() => {
    const handleExternalNotification = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<IslandNotification, 'id'>>;
      if (!customEvent.detail?.title) return;
      showIsland(customEvent.detail);
    };

    window.addEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
    return () => window.removeEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
  }, [showIsland]);

  // Track user activity
  useEffect(() => {
    const activityHandler = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('click', activityHandler);
    
    return () => {
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('click', activityHandler);
    };
  }, []);

  // Proactive suggestions for Connect
  useEffect(() => {
    const idleInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivity;

      if (idleTime > 45000 && notifications.length === 0) {
        const userName = user?.name?.split(' ')[0] || '';
        
        const suggestions = [
          {
            type: 'suggestion' as IslandType,
            title: userName || "Quick Sync?",
            message: "You can instantly attach notes from Kylrix Note in any conversation here.",
            action: { label: "Learn How", onClick: () => {} },
            personal: !!userName,
            app: 'note' as KylrixApp,
          },
          {
            type: 'connect' as IslandType,
            title: userName || "Vault Secure",
            message: "Your messages are end-to-end encrypted with your Kylrix Vault master password.",
            action: { label: "Security Status", onClick: () => {} },
            majestic: true,
            personal: !!userName,
            app: 'vault' as KylrixApp,
          },
          {
            type: 'suggestion' as IslandType,
            title: "Thinking space",
            message: "Use your self-chat to store ideas, snippets, and secrets for yourself.",
            action: { label: "Open Vault", onClick: () => {} },
            app: 'connect' as KylrixApp,
          }
        ];
        
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        showIsland(randomSuggestion);
        setLastActivity(Date.now());
      }
    }, 15000);

    return () => clearInterval(idleInterval);
  }, [lastActivity, notifications.length, showIsland, user]);

  return (
    <IslandContext.Provider value={{ openPanel, closePanel, isActive: Boolean(panel), panel, activeNotification }}>
      {children}
    </IslandContext.Provider>
  );
};

const APP_TONES: Record<KylrixApp, { primary: string; secondary: string; label: string }> = {
  root: { primary: '#6366F1', secondary: '#6366F1', label: 'Kylrix' },
  accounts: { primary: '#6366F1', secondary: '#6366F1', label: 'Accounts' },
  vault: { primary: '#6366F1', secondary: '#10B981', label: 'Vault' },
  flow: { primary: '#6366F1', secondary: '#A855F7', label: 'Flow' },
  note: { primary: '#6366F1', secondary: '#EC4899', label: 'Note' },
  connect: { primary: '#6366F1', secondary: '#F59E0B', label: 'Connect' },
  kylrix: { primary: '#6366F1', secondary: '#6366F1', label: 'Kylrix' },
};

const TYPE_TONES: Record<IslandType, { primary: string; secondary: string; label: string }> = {
  success: { primary: '#6366F1', secondary: '#6366F1', label: 'Success' },
  error: { primary: '#FF3B30', secondary: '#FF6B6B', label: 'Error' },
  warning: { primary: '#FF9500', secondary: '#FDBA74', label: 'Warning' },
  info: { primary: '#6366F1', secondary: '#60A5FA', label: 'Info' },
  pro: { primary: '#6366F1', secondary: '#A855F7', label: 'Pro' },
  system: { primary: '#6366F1', secondary: '#94A3B8', label: 'System' },
  suggestion: { primary: '#A855F7', secondary: '#C084FC', label: 'Suggestion' },
  connect: { primary: '#6366F1', secondary: '#F59E0B', label: 'Connect' },
};

type _SearchAction =
  | {
      id: string;
      kind: 'route';
      title: string;
      description: string;
      color: string;
      terms: string[];
      onSelect: () => void;
      icon: React.ReactNode;
    }
  | {
      id: string;
      kind: 'person';
      title: string;
      description: string;
      color: string;
      terms: string[];
      onSelect: () => void;
      icon: React.ReactNode;
      avatar?: string | null;
    };

function _getTone(notification: IslandNotification) {
  return notification.app ? APP_TONES[notification.app] : TYPE_TONES[notification.type];
}

function _includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function getLogoApp(appId: string): KylrixApp {
  switch (appId) {
    case 'vault':
    case 'flow':
    case 'note':
    case 'connect':
      return appId;
    case 'accounts':
      return 'accounts';
    default:
      return 'accounts';
  }
}

type IslandGlyphMode = 'idle' | 'typing' | 'thinking';

const _OrbitalGlyph: React.FC<{
  mode: IslandGlyphMode;
  tone: string;
}> = ({ mode, tone }) => {
  const ringSize = mode === 'thinking' ? 34 : 30;
  const bubbleCount = mode === 'thinking' ? 6 : 4;

  return (
    <Box
      sx={{
        position: 'relative',
        width: ringSize,
        height: ringSize,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: mode === 'thinking' ? 8 : 10, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `1px solid ${alpha(tone, mode === 'thinking' ? 0.3 : 0.22)}`,
          opacity: mode === 'thinking' ? 1 : 0.85,
        }}
      />

      {Array.from({ length: bubbleCount }).map((_, index) => {
        const angle = (360 / bubbleCount) * index;
        const radius = mode === 'thinking' ? 14 : 12;
        return (
          <motion.span
            key={index}
            animate={{
              x: [0, Math.cos((angle * Math.PI) / 180) * radius],
              y: [0, Math.sin((angle * Math.PI) / 180) * radius],
              opacity: [0.4, 1, 0.45],
              scale: [0.9, 1.15, 0.9],
            }}
            transition={{
              duration: 2.2 + index * 0.2,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: mode === 'thinking' ? 6 : 5,
              height: mode === 'thinking' ? 6 : 5,
              marginLeft: -3,
              marginTop: -3,
              borderRadius: '50%',
              background: tone,
            }}
          />
        );
      })}

      <motion.div
        animate={{
          scale: mode === 'thinking' ? [1, 0.94, 1] : [1, 1.06, 1],
          rotate: mode === 'typing' ? [0, -8, 8, 0] : 0,
        }}
        transition={{
          duration: mode === 'thinking' ? 2.8 : 3.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: mode === 'thinking' ? 18 : 16,
          height: mode === 'thinking' ? 18 : 16,
          borderRadius: '50%',
          background: tone,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 2,
            borderRadius: '50%',
            background: '#000',
          }}
        />
      </motion.div>
    </Box>
  );
};

const shortenUserId = (value?: string | null) => {
  if (!value) return 'unknown';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

export const ProfilePanelSurface: React.FC<{ onClosePanel: () => void }> = ({ onClosePanel }) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile: profileFromContext, isLoading } = useProfile();
  const cachedIdentity = user?.$id ? getCachedIdentityById(user.$id) : null;
  const profile = profileFromContext || cachedIdentity || null;
  const previewSource = profile?.avatarUrl || profile?.avatarFileId || profile?.avatar || (user?.prefs as any)?.profilePicId || null;
  const profilePreviewUrl = useCachedProfilePreview(previewSource, 160, 160);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCopyState('idle');
  }, [profile?.userId, profile?.$id]);

  const username = profile?.username ? String(profile.username).replace(/^@+/, '').toLowerCase() : null;
  const displayName = profile?.displayName || username || user?.name || user?.email || 'Profile';
  const fullUserId = profile?.userId || profile?.$id || user?.$id || null;
  const bio = (profile?.bio || '').trim();
  const shortUserId = shortenUserId(fullUserId);

  const openFullProfile = useCallback(async () => {
    if (!username) return;
    if (profile) {
      stageProfileView(profile, profilePreviewUrl || previewSource || null);
    }
    await router.prefetch(`/u/${encodeURIComponent(username)}`);
    onClosePanel();
    router.push(`/u/${encodeURIComponent(username)}?transition=profile`);
  }, [onClosePanel, profile, previewSource, profilePreviewUrl, router, username]);

  const handleCopyUserId = useCallback(async () => {
    if (!fullUserId || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(fullUserId);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [fullUserId]);

  const handleSignOut = useCallback(() => {
    onClosePanel();
    void logout();
  }, [logout, onClosePanel]);

  const handleProfileWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const node = scrollContainerRef.current;
    if (!node) return;

    const atTop = node.scrollTop <= 0;
    const atBottom = Math.ceil(node.scrollTop + node.clientHeight) >= node.scrollHeight;

    if (event.deltaY < 0 && atTop) {
      event.preventDefault();
      onClosePanel();
      return;
    }

    if (event.deltaY > 0 && atBottom) {
      event.preventDefault();
      void openFullProfile();
    }
  }, [onClosePanel, openFullProfile]);

  if (isLoading && !profile) {
    return (
      <Box sx={{ display: 'grid', gap: 1.25, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', maxHeight: '58vh', pr: 0.5, pb: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.25 }}>
          <Box sx={{ width: 56, height: 6, borderRadius: 999, bgcolor: alpha('#fff', 0.14) }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Skeleton variant="rounded" width={104} height={104} sx={{ borderRadius: '28px', bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton width="48%" height={34} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
            <Skeleton width="30%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
            <Skeleton width="80%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
          </Box>
        </Box>
        <Skeleton variant="rounded" height={96} sx={{ borderRadius: '22px', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Skeleton variant="rounded" height={48} sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Skeleton variant="rounded" height={48} sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.05)' }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={scrollContainerRef}
      onWheel={handleProfileWheel}
      sx={{ display: 'grid', gap: 1.25, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', maxHeight: '58vh', pr: 0.5, pb: 0.5 }}
    >

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
        <Box sx={{ flexShrink: 0 }}>
          <IdentityAvatar
            src={profilePreviewUrl || previewSource || undefined}
            alt={displayName}
            fallback={(displayName || 'P')[0]?.toUpperCase() || 'P'}
            size={104}
            borderRadius="28px"
          />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', lineHeight: 1.05 }} noWrap>
            {displayName}
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.62), fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.35 }} noWrap>
            @{username || 'profile'}
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.52), fontFamily: 'var(--font-mono)', fontSize: '0.72rem', mt: 0.75 }} noWrap>
            {shortUserId}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ borderRadius: '22px', border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)', p: 1.5, minWidth: 0 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75 }}>
          Bio
        </Typography>
        <Typography sx={{ color: 'white', fontSize: '0.88rem', lineHeight: 1.55, minHeight: 22, wordBreak: 'break-word' }}>
          {bio || 'No bio yet.'}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button
          onClick={handleCopyUserId}
          startIcon={<CopyIcon size={16} />}
          sx={{
            minWidth: 0,
            flex: '1 1 180px',
            justifyContent: 'flex-start',
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,0.03)',
            color: 'white',
            px: 1.5,
            py: 1.15,
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
          }}
        >
          {copyState === 'copied' ? 'Copied user id' : `Copy ${shortUserId}`}
        </Button>
        <Button
          onClick={handleSignOut}
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
        onClick={openFullProfile}
        disabled={!username}
        variant="contained"
        sx={{
          borderRadius: '16px',
          px: 2,
          py: 1.25,
          textTransform: 'none',
          fontWeight: 900,
          bgcolor: '#6366F1',
          color: '#000',
          '&:hover': { bgcolor: alpha('#6366F1', 0.86) },
          '&.Mui-disabled': { bgcolor: 'rgba(99,102,241,0.28)', color: 'rgba(255,255,255,0.6)' },
        }}
      >
        See full profile
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.25, pb: 0.25 }}>
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 140 }}
          dragElastic={0.14}
          onDragEnd={(_, info) => {
            if (info.offset.y > 64) {
              void openFullProfile();
            }
          }}
          style={{ touchAction: 'pan-y', cursor: 'grab' }}
        >
          <Box sx={{ width: 56, height: 6, borderRadius: 999, bgcolor: alpha('#fff', 0.14) }} />
        </motion.div>
      </Box>
    </Box>
  );
};

export const DynamicIslandPanelSurface: React.FC<{
  panel: IslandPanel | null;
  onClosePanel: () => void;
}> = ({ panel, onClosePanel }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const _router = useRouter();
  const { user, logout: _logout } = useAuth();

  const panelTone = panel === 'profile' ? '#6366F1' : APP_TONES.connect.secondary;
  const panelWidth = isMobile ? 'calc(100vw - 24px)' : 'min(680px, calc(100vw - 48px))';

  if (!panel) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pointerEvents: 'auto', width: '100%' }}>
      <motion.div
        key={`panel-${panel}`}
        layout
        initial={{ y: -12, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -12, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ pointerEvents: 'auto', width: '100%' }}
      >
        <Paper
          elevation={0}
          sx={{
            width: panelWidth,
            mx: 'auto',
            borderRadius: '30px',
            bgcolor: '#161412',
            border: `1px solid ${alpha(panelTone, 0.28)}`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, mb: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <motion.div style={{ display: 'inline-flex' }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '14px',
                        display: 'grid',
                        placeItems: 'center',
                        color: panelTone,
                        bgcolor: alpha(panelTone, 0.08),
                        border: `1px solid ${alpha(panelTone, 0.24)}`,
                        }}
                      >
                    {panel === 'profile' ? <UserIcon size={18} /> : <Logo app="connect" size={18} variant="icon" />}
                  </Box>
                </motion.div>
                <Box>
                  <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.1 }}>
                    {panel === 'profile' ? (user?.name || user?.email || 'Profile') : 'Ecosystem apps'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha('#fff', 0.52), fontWeight: 700 }}>
                    {panel === 'profile' ? 'Profile commands' : 'Jump between apps'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={onClosePanel}
                aria-label="Close dynamic island"
                size="small"
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '999px',
                  color: alpha('#fff', 0.9),
                  bgcolor: alpha('#fff', 0.06),
                  border: '1px solid rgba(255,255,255,0.08)',
                  flexShrink: 0,
                  '&:hover': { bgcolor: alpha('#fff', 0.12) },
                }}
              >
                <CloseIcon size={16} />
              </IconButton>
            </Box>

            {panel === 'ecosystem' ? (
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {ECOSYSTEM_APPS.map((app) => {
                  const selected = app.subdomain === 'connect';
                  const logoApp = getLogoApp(app.id);
                  return (
                    <ListItemButton
                      key={app.id}
                      onClick={() => window.location.assign(getEcosystemUrl(app.subdomain))}
                      sx={{
                        borderRadius: '18px',
                        bgcolor: selected ? alpha(app.color, 0.1) : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? alpha(app.color, 0.28) : 'rgba(255,255,255,0.05)'}`,
                        px: 1.5,
                        py: 1.25,
                        gap: 1.25,
                        '&:hover': {
                          bgcolor: alpha(app.color, 0.12),
                          borderColor: alpha(app.color, 0.32),
                        },
                      }}
                    >
                      <Box sx={{ width: 34, height: 34, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: alpha(app.color, 0.12), color: app.color, flexShrink: 0 }}>
                        <Logo app={logoApp} size={16} variant="icon" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.15 }}>
                          {app.label}
                        </Typography>
                        <Typography sx={{ color: alpha('#fff', 0.56), fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }}>
                          {app.description}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </Box>
            ) : (
              <ProfilePanelSurface onClosePanel={onClosePanel} />
            )}
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
};

