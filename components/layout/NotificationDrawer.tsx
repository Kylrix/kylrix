'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  alpha,
  Drawer,
} from '@/lib/openbricks/primitives';
import {
  Bell,
  MessageSquare,
  Heart,
  UserPlus,
  ShieldCheck,
  CheckCheck,
  ChevronRight,
  Trash2,
  X as CloseIcon,
  Sparkles,
  Layers,
  Activity,
  Zap,
} from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { isTopbarScrollAtTop } from '@/sdk/topbar';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { IdentityAvatar } from '@/components/common/IdentityBadge';

export type NotificationCategory = 'all' | 'replies' | 'likes' | 'follows' | 'system';

export interface KylrixNotification {
  id: string;
  category: 'replies' | 'likes' | 'follows' | 'system';
  title: string;
  message: string;
  time: string;
  timestamp: number;
  read: boolean;
  accent: string;
  actionHref?: string;
  actor?: {
    name: string;
    username?: string;
    avatarId?: string;
    isNostr?: boolean;
    npub?: string;
  };
  source?: 'nostr' | 'kylrix' | 'system';
  meta?: Record<string, any>;
}

// Default initial notifications across categories
const DEFAULT_NOTIFICATIONS: KylrixNotification[] = [
  // ── Replies (Moments, Nostr, Threads) ──────────────────────────
  {
    id: 'reply-1',
    category: 'replies',
    title: 'New reply to your moment',
    message: '“The tactile OpenBricks 4.0 surfaces look extremely crisp. Great work on the dark wells!”',
    time: '4m ago',
    timestamp: Date.now() - 4 * 60 * 1000,
    read: false,
    accent: '#6366F1',
    actionHref: '/connect',
    actor: {
      name: 'Elena Rostova',
      username: 'elena',
      isNostr: true,
      npub: 'npub1elena899x9...',
    },
    source: 'nostr',
  },
  {
    id: 'reply-2',
    category: 'replies',
    title: 'Reply on your moment "Shipping High-Leverage Systems"',
    message: '“How are you handling the local-first conflicts in RxDB?”',
    time: '28m ago',
    timestamp: Date.now() - 28 * 60 * 1000,
    read: false,
    accent: '#6366F1',
    actionHref: '/connect',
    actor: {
      name: 'Marcus Vance',
      username: 'marcus_v',
    },
    source: 'kylrix',
  },
  {
    id: 'reply-3',
    category: 'replies',
    title: 'Thread response in "Decentralized Architecture"',
    message: '“Merged the database read optimization patch. Performance score is at 100%.”',
    time: '1h ago',
    timestamp: Date.now() - 65 * 60 * 1000,
    read: true,
    accent: '#6366F1',
    actionHref: '/app',
    actor: {
      name: 'Agent Hermes',
      username: 'agent_hermes',
    },
    source: 'kylrix',
  },

  // ── Likes (Moments & Notes) ───────────────────────────────────
  {
    id: 'like-1',
    category: 'likes',
    title: 'Liked your moment',
    message: 'DevRel team and 3 others liked “WebMCP: W3C in-browser tools integration”.',
    time: '15m ago',
    timestamp: Date.now() - 15 * 60 * 1000,
    read: false,
    accent: '#EC4899',
    actionHref: '/connect',
    actor: {
      name: 'Satoshi Guild',
      username: 'satoshiguild',
      isNostr: true,
    },
    source: 'nostr',
  },
  {
    id: 'like-2',
    category: 'likes',
    title: 'Liked your note "Encrypted Identity & Vault Proofs"',
    message: 'Ayrton and 5 other collaborators reacted with 🔥.',
    time: '3h ago',
    timestamp: Date.now() - 3 * 3600 * 1000,
    read: true,
    accent: '#EC4899',
    actionHref: '/app',
    actor: {
      name: 'Ayrton Senna',
      username: 'ayrton',
    },
    source: 'kylrix',
  },

  // ── Follows & Social ──────────────────────────────────────────
  {
    id: 'follow-1',
    category: 'follows',
    title: 'New follower on Nostr & Kylrix Connect',
    message: 'builder_0x started following your public profile and moments feed.',
    time: '45m ago',
    timestamp: Date.now() - 45 * 60 * 1000,
    read: false,
    accent: '#8B5CF6',
    actionHref: '/connect',
    actor: {
      name: '0xBuilder',
      username: 'builder_0x',
      isNostr: true,
      npub: 'npub10xbuild992x...',
    },
    source: 'nostr',
  },
  {
    id: 'follow-2',
    category: 'follows',
    title: 'Collaborator joined workspace',
    message: 'Nath Favour added you to workspace "Ecosystem Alpha".',
    time: '2h ago',
    timestamp: Date.now() - 2 * 3600 * 1000,
    read: true,
    accent: '#8B5CF6',
    actionHref: '/workspaces',
    actor: {
      name: 'Nath Favour',
      username: 'nathfavour',
    },
    source: 'kylrix',
  },

  // ── System & Workspace ────────────────────────────────────────
  {
    id: 'sys-1',
    category: 'system',
    title: 'Workspace Sync Complete',
    message: 'All local action workflows and workspace logs successfully synchronized with deterministic sync engine.',
    time: 'Just now',
    timestamp: Date.now() - 1 * 60 * 1000,
    read: false,
    accent: '#10B981',
    actionHref: '/app',
    source: 'system',
  },
  {
    id: 'sys-2',
    category: 'system',
    title: 'WebMCP Browser Standard Active',
    message: '16 workspace tools exposed to browser agents via navigator.modelContext.',
    time: '1h ago',
    timestamp: Date.now() - 60 * 60 * 1000,
    read: false,
    accent: '#10B981',
    actionHref: '/settings?tab=developers',
    source: 'system',
  },
  {
    id: 'sys-3',
    category: 'system',
    title: 'Secure Keychain Audited',
    message: 'Local master credentials checked. Cryptographic integrity score 100%.',
    time: '1d ago',
    timestamp: Date.now() - 24 * 3600 * 1000,
    read: true,
    accent: '#F59E0B',
    actionHref: '/vault',
    source: 'system',
  },
];

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  appAccent: string;
  isDesktop: boolean;
  nativeSidebar?: boolean;
}

export function NotificationDrawer({
  isOpen,
  onClose,
  appAccent,
  isDesktop,
  nativeSidebar,
}: NotificationDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<KylrixNotification[]>([]);

  // Initialize notifications from cache / defaults
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem('kylrix_notifications_v3');
    if (cached) {
      try {
        setNotifications(JSON.parse(cached));
        return;
      } catch {}
    }
    setNotifications(DEFAULT_NOTIFICATIONS);
  }, []);

  const saveNotifications = useCallback((updated: KylrixNotification[]) => {
    setNotifications(updated);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('kylrix_notifications_v3', JSON.stringify(updated));
      } catch {}
    }
  }, []);

  const markNotificationRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
  };

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    saveNotifications([]);
  };

  const handleNotificationClick = (notif: KylrixNotification) => {
    markNotificationRead(notif.id);
    onClose();
    if (notif.actionHref) {
      router.push(notif.actionHref);
    }
  };

  // Category counts and unread counts
  const unreadCounts = useMemo(() => {
    const counts = {
      all: 0,
      replies: 0,
      likes: 0,
      follows: 0,
      system: 0,
    };
    for (const n of notifications) {
      if (!n.read) {
        counts.all++;
        if (counts[n.category] !== undefined) {
          counts[n.category]++;
        }
      }
    }
    return counts;
  }, [notifications]);

  // Filtered notifications sorted by timestamp descending, capped at 100 items
  const filteredNotifications = useMemo(() => {
    let items = notifications;
    if (activeTab !== 'all') {
      items = items.filter((n) => n.category === activeTab);
    }
    return items
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100);
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  const renderCategoryIcon = (category: KylrixNotification['category'], accent: string) => {
    switch (category) {
      case 'replies':
        return <MessageSquare size={16} strokeWidth={2.4} />;
      case 'likes':
        return <Heart size={16} strokeWidth={2.4} />;
      case 'follows':
        return <UserPlus size={16} strokeWidth={2.4} />;
      case 'system':
      default:
        return <ShieldCheck size={16} strokeWidth={2.4} />;
    }
  };

  const tabs: Array<{ id: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Layers size={13} /> },
    { id: 'replies', label: 'Replies', icon: <MessageSquare size={13} /> },
    { id: 'likes', label: 'Likes', icon: <Heart size={13} /> },
    { id: 'follows', label: 'Follows', icon: <UserPlus size={13} /> },
    { id: 'system', label: 'System', icon: <ShieldCheck size={13} /> },
  ];

  const content = (
    <Box
      onWheel={(event: React.WheelEvent) => {
        if (isDesktop) return;
        const node = event.currentTarget;
        if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
          event.preventDefault();
          onClose();
        }
      }}
      sx={{
        px: { xs: 2, md: 3 },
        py: 1.5,
        maxHeight: isDesktop ? '100vh' : '82vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          borderRadius: '24px',
          bgcolor: '#161412',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, pb: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  color: appAccent,
                  bgcolor: alpha(appAccent, 0.1),
                  border: `1px solid ${alpha(appAccent, 0.2)}`,
                  flexShrink: 0,
                }}
              >
                <Bell size={18} strokeWidth={2.5} />
              </Box>
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                <Typography
                  component="span"
                  sx={{
                    color: 'white',
                    fontWeight: 900,
                    fontSize: '0.98rem',
                    lineHeight: 1.2,
                    fontFamily: 'var(--font-clash)',
                  }}
                >
                  Activity & Notifications
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: 'rgba(255,255,255,0.45)',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {unreadCounts.all > 0 ? `${unreadCounts.all} unread updates` : 'All caught up'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {notifications.length > 0 && (
                <IconButton
                  onClick={markAllRead}
                  title="Mark all as read"
                  size="small"
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '999px',
                    color: 'rgba(255,255,255,0.6)',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
                  }}
                >
                  <CheckCheck size={14} />
                </IconButton>
              )}
              <IconButton
                onClick={onClose}
                size="small"
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '999px',
                  color: alpha('#fff', 0.7),
                  bgcolor: alpha('#fff', 0.05),
                  border: '1px solid rgba(255,255,255,0.06)',
                  flexShrink: 0,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
                }}
              >
                <CloseIcon size={14} />
              </IconButton>
            </Box>
          </Box>

          {/* Segmented Category Pill Tabs (OpenBricks 4.0 Standard) */}
          <Box
            sx={{
              mt: 2,
              p: 0.5,
              borderRadius: '16px',
              bgcolor: '#0A0908',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 0.5,
            }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = unreadCounts[tab.id] || 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 4px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: isActive ? 800 : 600,
                    fontFamily: 'inherit',
                    color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                    backgroundColor: isActive ? '#1F1D1A' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                    minWidth: 0,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.7 }}>
                    {tab.icon}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.label}
                  </span>
                  {count > 0 && (
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '999px',
                        fontSize: '9px',
                        fontWeight: 900,
                        backgroundColor: isActive ? appAccent : 'rgba(255,255,255,0.15)',
                        color: '#FFFFFF',
                        lineHeight: 1.2,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </Box>
        </Box>

        {/* Notifications List Well */}
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, maxHeight: isDesktop ? 'calc(100vh - 180px)' : '55vh', overflowY: 'auto' }}>
          {filteredNotifications.map((notif) => (
            <Box
              key={notif.id}
              component="button"
              onClick={() => handleNotificationClick(notif)}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.75,
                borderRadius: '18px',
                bgcolor: notif.read ? '#0E0D0C' : '#1C1A18',
                border: '1px solid',
                borderColor: notif.read ? 'rgba(255,255,255,0.05)' : alpha(notif.accent, 0.22),
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': {
                  bgcolor: '#242220',
                  borderColor: alpha(notif.accent, 0.35),
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                },
              }}
            >
              {/* Avatar or Category Icon */}
              <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.25 }}>
                {notif.actor?.username ? (
                  <IdentityAvatar
                    username={notif.actor.username}
                    displayName={notif.actor.name}
                    size={38}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '12px',
                      bgcolor: alpha(notif.accent, 0.12),
                      color: notif.accent,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {renderCategoryIcon(notif.category, notif.accent)}
                  </Box>
                )}

                {/* Source Badge (Nostr / Kylrix) */}
                {notif.source === 'nostr' && (
                  <Box
                    title="Nostr event"
                    sx={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      bgcolor: '#8B5CF6',
                      color: 'white',
                      fontSize: '8px',
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1.5px solid #161412',
                    }}
                  >
                    ⚡
                  </Box>
                )}
              </Box>

              {/* Stacked Content Column (Strict No-Wrap Truncation) */}
              <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography
                    component="span"
                    sx={{
                      color: notif.read ? 'rgba(255,255,255,0.85)' : 'white',
                      fontWeight: notif.read ? 700 : 800,
                      fontSize: '0.86rem',
                      lineHeight: 1.25,
                    }}
                    noWrap
                  >
                    {notif.actor?.name ? `${notif.actor.name} · ${notif.title}` : notif.title}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: 'rgba(255,255,255,0.38)',
                      fontWeight: 600,
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {notif.time}
                  </Typography>
                </Box>

                <Typography
                  component="span"
                  sx={{
                    color: notif.read ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.72)',
                    fontWeight: 500,
                    fontSize: '0.76rem',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {notif.message}
                </Typography>
              </Box>

              {/* Dismiss / Action icon */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mt: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={(e) => dismissNotification(notif.id, e)}
                  title="Dismiss"
                  sx={{
                    width: 24,
                    height: 24,
                    color: 'rgba(255,255,255,0.2)',
                    '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' },
                  }}
                >
                  <CloseIcon size={12} />
                </IconButton>
                <ChevronRight size={15} style={{ color: 'rgba(255,255,255,0.25)' }} />
              </Box>
            </Box>
          ))}

          {/* Empty State */}
          {filteredNotifications.length === 0 && (
            <Box
              sx={{
                py: 6,
                px: 3,
                textAlign: 'center',
                display: 'grid',
                placeItems: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(255,255,255,0.2)',
                }}
              >
                {activeTab === 'replies' ? (
                  <MessageSquare size={22} />
                ) : activeTab === 'likes' ? (
                  <Heart size={22} />
                ) : activeTab === 'follows' ? (
                  <UserPlus size={22} />
                ) : (
                  <Bell size={22} />
                )}
              </Box>
              <Typography
                component="span"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                No {activeTab === 'all' ? '' : activeTab} notifications
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '0.74rem',
                  maxWidth: 240,
                  lineHeight: 1.4,
                }}
              >
                {activeTab === 'replies'
                  ? 'Replies and moment comments from Nostr and Kylrix will show up here.'
                  : activeTab === 'likes'
                  ? 'Reactions and likes on your shared moments and notes.'
                  : activeTab === 'follows'
                  ? 'New followers and workspace invitations.'
                  : 'You are completely caught up on all activity.'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <Box
            sx={{
              p: 1.5,
              px: 2,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: '#121110',
            }}
          >
            <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              Showing {filteredNotifications.length} of {notifications.length} updates
            </Typography>
            <button
              onClick={clearAllNotifications}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '8px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              <Trash2 size={12} />
              Clear all
            </button>
          </Box>
        )}
      </Paper>
    </Box>
  );

  if (isDesktop) {
    if (nativeSidebar) {
      return (
        <NativeSidebarMount
          active={isOpen}
          sidebarKey="topbar-notifications"
          width={440}
          title="Notifications"
        >
          {content}
        </NativeSidebarMount>
      );
    }
    return (
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={onClose}
        keepMounted={false}
        disablePortal={true}
        slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
        PaperProps={{
          sx: {
            bgcolor: '#161412',
            backgroundImage: 'none',
            width: 440,
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            height: '100vh',
            borderRadius: 0,
            p: 0,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      anchor="top"
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          p: 0,
        },
      }}
    >
      {content}
    </Drawer>
  );
}
