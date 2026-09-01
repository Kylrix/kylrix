'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  RotateCw,
} from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { isTopbarScrollAtTop } from '@/sdk/topbar';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useLocalContext } from '@/lib/context-engine';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { SocialService } from '@/lib/services/social';

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
}

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
  const { user } = useAuth();
  const { suggestions, dismissSuggestion } = useLocalContext();
  const { feed: nostrFeed } = useNostrFeed();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<KylrixNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const userId = user?.$id || 'guest';
  const cacheKey = `kylrix_notifs_${userId}`;

  // 1. Load persisted read/dismissed state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedRead = window.localStorage.getItem(`kylrix_notif_read_${userId}`);
      if (savedRead) setReadIds(new Set(JSON.parse(savedRead)));

      const savedDismissed = window.localStorage.getItem(`kylrix_notif_dismissed_${userId}`);
      if (savedDismissed) setDismissedIds(new Set(JSON.parse(savedDismissed)));
    } catch {}
  }, [userId]);

  // 2. Hydrate cached notifications from LocalEngine on mount (0ms)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    void (async () => {
      const cached = await LocalEngine.cacheGet<KylrixNotification[]>(cacheKey, 600_000).catch(() => null);
      if (Array.isArray(cached) && cached.length > 0) {
        setNotifications(cached);
      }
    })();
  }, [cacheKey]);

  // 3. Harvest 100% REAL dynamic activity (Account sessions, moments, comments, Nostr, suggestions)
  const harvestRealActivity = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setLoading(true);

    try {
      const items: KylrixNotification[] = [];
      const seenIds = new Set<string>();

      // A. Real account security and session logs
      if (user?.$id) {
        try {
          const logsRes = await account.listLogs().catch(() => ({ logs: [] }));
          for (const log of logsRes.logs || []) {
            const ts = new Date(log.time).getTime();
            const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
            const timeStr =
              diffMin < 60
                ? `${diffMin}m ago`
                : diffMin < 1440
                ? `${Math.floor(diffMin / 60)}h ago`
                : `${Math.floor(diffMin / 1440)}d ago`;

            let title = 'Account Session Active';
            let message = `Signed in from ${log.countryName || 'Local Session'} via ${log.clientName || 'Web Browser'}.`;
            let accent = '#10B981';

            if (log.event?.includes('password') || log.event?.includes('mfa')) {
              title = 'Security Credential Updated';
              message = `Security settings updated for user from IP ${log.ip}.`;
              accent = '#F59E0B';
            }

            const id = `log_${log.$id || ts}_${log.event}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              items.push({
                id,
                category: 'system',
                title,
                message,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent,
                actionHref: '/settings',
                source: 'system',
              });
            }
          }
        } catch {}
      }

      // B. Real moments discussions and reactions from LocalEngine & SocialService
      try {
        let moments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
        if (!moments.length && user?.$id) {
          const liveRes = await SocialService.getFeed(user.$id).catch(() => []);
          moments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
        }

        for (const m of moments.slice(0, 20)) {
          const ts = new Date(m.$createdAt || m.createdAt || Date.now()).getTime();
          const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
          const timeStr =
            diffMin < 60
              ? `${diffMin}m ago`
              : diffMin < 1440
              ? `${Math.floor(diffMin / 60)}h ago`
              : `${Math.floor(diffMin / 1440)}d ago`;

          // Replies tab: moments with discussions
          if (m.commentsCount && m.commentsCount > 0) {
            const id = `rep_moment_${m.$id || m.id}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              items.push({
                id,
                category: 'replies',
                title: `Discussion on "${(m.caption || m.content || 'Moment').slice(0, 45)}"`,
                message: `${m.commentsCount} comments active on your moment.`,
                time: timeStr,
                timestamp: ts + 1000,
                read: false,
                accent: '#6366F1',
                actionHref: `/connect/post/${m.$id || m.id}`,
                actor: {
                  name: m.userName || m.username || 'Community Member',
                  username: m.username,
                  isNostr: !!m.isNostr,
                },
                source: m.isNostr ? 'nostr' : 'kylrix',
              });
            }
          }

          // Likes tab: moments with peer likes
          if (m.likesCount && m.likesCount > 0) {
            const id = `like_moment_${m.$id || m.id}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              items.push({
                id,
                category: 'likes',
                title: 'Reactions on your post',
                message: `${m.likesCount} people liked your moment "${(m.caption || m.content || '').slice(0, 45)}"`,
                time: timeStr,
                timestamp: ts + 500,
                read: false,
                accent: '#EC4899',
                actionHref: `/connect/post/${m.$id || m.id}`,
                source: m.isNostr ? 'nostr' : 'kylrix',
              });
            }
          }
        }
      } catch {}

      // C. Real Nostr reply events from active relays
      if (Array.isArray(nostrFeed)) {
        for (const event of nostrFeed.slice(0, 15)) {
          const isReply = event.tags?.some((t: string[]) => t[0] === 'e');
          if (isReply) {
            const id = `nostr_rep_${event.id}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              const ts = (event.created_at || Date.now() / 1000) * 1000;
              const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
              const timeStr =
                diffMin < 60
                  ? `${diffMin}m ago`
                  : diffMin < 1440
                  ? `${Math.floor(diffMin / 60)}h ago`
                  : `${Math.floor(diffMin / 1440)}d ago`;

              items.push({
                id,
                category: 'replies',
                title: 'Nostr Relay Response',
                message: (event.content || '').slice(0, 120),
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#8B5CF6',
                actionHref: `/connect/post/nostr_${event.id}`,
                actor: {
                  name: `npub…${event.pubkey.slice(-8)}`,
                  isNostr: true,
                },
                source: 'nostr',
              });
            }
          }
        }
      }

      // D. Context intelligence active pulses
      for (const s of suggestions || []) {
        const id = `sug_${s.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          items.push({
            id,
            category: 'system',
            title: s.title,
            message: s.description,
            time: 'Active',
            timestamp: Date.now(),
            read: false,
            accent: s.niche === 'intelligence' ? '#6366F1' : '#10B981',
            actionHref: s.actionHref || '/app',
            source: 'system',
          });
        }
      }

      // Sort strictly by recency and cap at 100 items
      const sorted = items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 100);
      setNotifications(sorted);
      await LocalEngine.cacheSet(cacheKey, sorted).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [user?.$id, nostrFeed, suggestions, cacheKey]);

  useEffect(() => {
    if (isOpen) {
      void harvestRealActivity();
    }
  }, [isOpen, harvestRealActivity]);

  const markNotificationRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`kylrix_notif_read_${userId}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set([...Array.from(readIds), ...allIds]);
    setReadIds(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`kylrix_notif_read_${userId}`, JSON.stringify(Array.from(next)));
    }
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`kylrix_notif_dismissed_${userId}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
    if (id.startsWith('sug_')) {
      dismissSuggestion(id.replace('sug_', ''));
    }
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set([...Array.from(dismissedIds), ...allIds]);
    setDismissedIds(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`kylrix_notif_dismissed_${userId}`, JSON.stringify(Array.from(next)));
    }
  };

  const handleNotificationClick = (notif: KylrixNotification) => {
    markNotificationRead(notif.id);
    onClose();
    if (notif.actionHref) {
      router.push(notif.actionHref);
    }
  };

  // Filter visible items with read and dismissed status
  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((n) => !dismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        read: readIds.has(n.id),
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [notifications, dismissedIds, readIds]);

  // Category unread counters
  const unreadCounts = useMemo(() => {
    const counts = { all: 0, replies: 0, likes: 0, follows: 0, system: 0 };
    for (const n of visibleNotifications) {
      if (!n.read) {
        counts.all++;
        if (counts[n.category] !== undefined) {
          counts[n.category]++;
        }
      }
    }
    return counts;
  }, [visibleNotifications]);

  // Tab items (capped at 100 for All)
  const filteredNotifications = useMemo(() => {
    let list = visibleNotifications;
    if (activeTab !== 'all') {
      list = list.filter((n) => n.category === activeTab);
    }
    return list.slice(0, 100);
  }, [visibleNotifications, activeTab]);

  if (!isOpen) return null;

  const tabs: Array<{ id: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Layers size={13} /> },
    { id: 'replies', label: 'Replies', icon: <MessageSquare size={13} /> },
    { id: 'likes', label: 'Likes', icon: <Heart size={13} /> },
    { id: 'follows', label: 'Follows', icon: <UserPlus size={13} /> },
    { id: 'system', label: 'System', icon: <ShieldCheck size={13} /> },
  ];

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

  // OpenBricks 4.0 Tactile Content Structure (Single Continuous Ash Surface)
  const notificationBody = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* 1. Header Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '12px',
              bgcolor: alpha(appAccent, 0.12),
              color: appAccent,
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Bell size={17} strokeWidth={2.5} />
          </Box>
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
            <Typography
              component="span"
              sx={{
                color: 'white',
                fontWeight: 900,
                fontSize: '0.94rem',
                lineHeight: 1.25,
                fontFamily: 'var(--font-clash)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Activity & Notifications
            </Typography>
            <Typography
              component="span"
              sx={{
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 700,
                fontSize: '0.66rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                lineHeight: 1.2,
              }}
            >
              {unreadCounts.all > 0 ? `${unreadCounts.all} unread updates` : 'All caught up'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {visibleNotifications.length > 0 && (
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
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
            }}
          >
            <CloseIcon size={14} />
          </IconButton>
        </Box>
      </Box>

      {/* 2. OpenBricks 4.0 Segmented Category Pill Tabs */}
      <Box
        sx={{
          p: 0.5,
          borderRadius: '16px',
          bgcolor: '#0A0908',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 0.5,
          width: '100%',
          boxSizing: 'border-box',
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
                padding: '7px 3px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: isActive ? 800 : 600,
                fontFamily: 'inherit',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                backgroundColor: isActive ? '#1F1D1A' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
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
                    padding: '1px 4.5px',
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

      {/* 3. Notifications List Column */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.85,
          maxHeight: isDesktop ? 'calc(100vh - 230px)' : '46vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          pr: 0.25,
        }}
      >
        {filteredNotifications.map((notif) => (
          <Box
            key={notif.id}
            component="button"
            onClick={() => handleNotificationClick(notif)}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
              px: 2,
              py: 1.5,
              borderRadius: '16px',
              bgcolor: notif.read ? 'rgba(255,255,255,0.015)' : '#1C1A18',
              border: '1px solid',
              borderColor: notif.read ? 'rgba(255,255,255,0.05)' : alpha(notif.accent, 0.22),
              color: 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              minWidth: 0,
              boxSizing: 'border-box',
              '&:hover': {
                bgcolor: '#242220',
                borderColor: alpha(notif.accent, 0.35),
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* 1. Fixed Icon Slot */}
            <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '12px',
                  bgcolor: alpha(notif.accent, 0.12),
                  color: notif.accent,
                  border: `1px solid ${alpha(notif.accent, 0.2)}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {renderCategoryIcon(notif.category, notif.accent)}
              </Box>

              {notif.source === 'nostr' && (
                <Box
                  title="Nostr event"
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    bgcolor: '#8B5CF6',
                    color: 'white',
                    fontSize: '7px',
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

            {/* 2. Structured Stacked Copy Column (ui.tailwind-fix standard) */}
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.3, pr: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    color: notif.read ? 'rgba(255,255,255,0.85)' : 'white',
                    fontWeight: notif.read ? 700 : 800,
                    fontSize: '0.84rem',
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
                    fontSize: '0.66rem',
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
                  color: notif.read ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.72)',
                  fontWeight: 500,
                  fontSize: '0.74rem',
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

            {/* 3. Dismiss & Right Action */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, mt: 0.4 }}>
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
              <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.22)' }} />
            </Box>
          </Box>
        ))}

        {/* Clean Empty State */}
        {filteredNotifications.length === 0 && (
          <Box
            sx={{
              py: 5,
              px: 3,
              textAlign: 'center',
              display: 'grid',
              placeItems: 'center',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'grid',
                placeItems: 'center',
                color: 'rgba(255,255,255,0.2)',
              }}
            >
              {activeTab === 'replies' ? (
                <MessageSquare size={18} />
              ) : activeTab === 'likes' ? (
                <Heart size={18} />
              ) : activeTab === 'follows' ? (
                <UserPlus size={18} />
              ) : (
                <Bell size={18} />
              )}
            </Box>
            <Typography
              component="span"
              sx={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.82rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1.2,
              }}
            >
              No {activeTab === 'all' ? '' : activeTab} updates
            </Typography>
            <Typography
              component="span"
              sx={{
                color: 'rgba(255,255,255,0.28)',
                fontSize: '0.72rem',
                maxWidth: 220,
                lineHeight: 1.35,
              }}
            >
              {activeTab === 'replies'
                ? 'Discussion responses and moment comments will appear here.'
                : activeTab === 'likes'
                ? 'Reactions on your moments and notes.'
                : activeTab === 'follows'
                ? 'New followers and workspace invitations.'
                : 'You are completely caught up.'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 4. Lightweight Clean Footer */}
      {visibleNotifications.length > 0 && (
        <Box
          sx={{
            pt: 1,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
            {filteredNotifications.length} of {visibleNotifications.length} updates
          </Typography>
          <button
            onClick={clearAllNotifications}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 6px',
              borderRadius: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </Box>
      )}
    </Box>
  );

  // Desktop View (Matching Native Sidebar / Right Drawer)
  if (isDesktop) {
    if (nativeSidebar) {
      return (
        <NativeSidebarMount
          active={isOpen}
          sidebarKey="topbar-notifications"
          width={400}
          title="Notifications"
        >
          <Box sx={{ p: 2, overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            {notificationBody}
          </Box>
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
            width: { xs: '100vw', sm: 400 },
            maxWidth: '100vw',
            borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            p: { xs: 2, sm: 2.5 },
          },
        }}
      >
        {notificationBody}
      </Drawer>
    );
  }

  // Mobile Topbar Dropdown Panel (Exact Matching `renderProfilePanel` standard)
  return (
    <Box
      data-kylrix-topbar-panel
      sx={{
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '0 0 28px 28px',
        bgcolor: '#161412',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
      }}
    >
      <Box
        onWheel={(event: React.WheelEvent) => {
          const node = event.currentTarget;
          if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
            event.preventDefault();
            onClose();
          }
        }}
        sx={{
          px: { xs: 1.5, sm: 2.25, md: 4 },
          py: { xs: 1.5, sm: 2 },
          maxHeight: '50vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: '100%',
            borderRadius: '24px',
            bgcolor: '#161412',
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            p: { xs: 1.5, sm: 2 },
            boxSizing: 'border-box',
          }}
        >
          {notificationBody}
        </Paper>
      </Box>
    </Box>
  );
}
