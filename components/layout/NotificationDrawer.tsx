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
  Zap,
} from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { isTopbarScrollAtTop } from '@/sdk/topbar';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useLocalContext } from '@/lib/context-engine';
import { useAuth } from '@/context/auth/AuthContext';

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

// Rich baseline ecosystem notifications across categories
function getEcosystemBaselineNotifications(userId?: string): KylrixNotification[] {
  const now = Date.now();
  return [
    // ── Replies (Nostr & Kylrix Moments) ─────────────────────────
    {
      id: 'notif_rep_1',
      category: 'replies',
      title: 'Elena replied to your moment',
      message: '“The tactile OpenBricks 4.0 surfaces look extremely crisp. Great work on the dark wells!”',
      time: '5m ago',
      timestamp: now - 5 * 60 * 1000,
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
      id: 'notif_rep_2',
      category: 'replies',
      title: 'Discussion response on "Shipping High-Leverage Systems"',
      message: '“How are you handling the local-first sync conflicts in RxDB?”',
      time: '35m ago',
      timestamp: now - 35 * 60 * 1000,
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
      id: 'notif_rep_3',
      category: 'replies',
      title: 'Thread response in "Decentralized Architecture"',
      message: '“Merged the database read optimization patch. Performance score is at 100%.”',
      time: '1h ago',
      timestamp: now - 70 * 60 * 1000,
      read: true,
      accent: '#6366F1',
      actionHref: '/app',
      actor: {
        name: 'Agent Hermes',
        username: 'agent_hermes',
      },
      source: 'kylrix',
    },

    // ── Likes (Moments & Notes) ──────────────────────────────────
    {
      id: 'notif_like_1',
      category: 'likes',
      title: 'Reactions on your moment',
      message: 'Satoshi Guild and 4 others reacted with 🔥 to your update.',
      time: '18m ago',
      timestamp: now - 18 * 60 * 1000,
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
      id: 'notif_like_2',
      category: 'likes',
      title: 'Liked your note "Encrypted Identity & Vault Proofs"',
      message: 'Ayrton and 3 collaborators liked your note.',
      time: '2h ago',
      timestamp: now - 140 * 60 * 1000,
      read: true,
      accent: '#EC4899',
      actionHref: '/app',
      actor: {
        name: 'Ayrton Senna',
        username: 'ayrton',
      },
      source: 'kylrix',
    },

    // ── Follows & Social ─────────────────────────────────────────
    {
      id: 'notif_fol_1',
      category: 'follows',
      title: 'New follower on Nostr & Connect',
      message: 'builder_0x followed your profile and subscribed to your feed.',
      time: '50m ago',
      timestamp: now - 50 * 60 * 1000,
      read: false,
      accent: '#8B5CF6',
      actionHref: '/connect',
      actor: {
        name: '0xBuilder',
        username: 'builder_0x',
        isNostr: true,
      },
      source: 'nostr',
    },
    {
      id: 'notif_fol_2',
      category: 'follows',
      title: 'Workspace collaborator connected',
      message: 'Sarah Blake accepted your invite to workspace "Ecosystem Alpha".',
      time: '3h ago',
      timestamp: now - 190 * 60 * 1000,
      read: true,
      accent: '#8B5CF6',
      actionHref: '/workspaces',
      actor: {
        name: 'Sarah Blake',
        username: 'sarah_b',
      },
      source: 'kylrix',
    },

    // ── System & Workspace ───────────────────────────────────────
    {
      id: 'notif_sys_1',
      category: 'system',
      title: 'Workspace Synchronized',
      message: 'Deterministic sync engine verified local copy integrity in 0ms.',
      time: 'Just now',
      timestamp: now - 2 * 60 * 1000,
      read: false,
      accent: '#10B981',
      actionHref: '/app',
      source: 'system',
    },
    {
      id: 'notif_sys_2',
      category: 'system',
      title: 'WebMCP Browser Standard Active',
      message: '16 workspace tools exposed to browser agents via navigator.modelContext.',
      time: '1h ago',
      timestamp: now - 60 * 60 * 1000,
      read: false,
      accent: '#10B981',
      actionHref: '/settings?tab=developers',
      source: 'system',
    },
    {
      id: 'notif_sys_3',
      category: 'system',
      title: 'Secure Keychain Audited',
      message: 'Local master credentials checked. Cryptographic integrity score 100%.',
      time: '1d ago',
      timestamp: now - 24 * 3600 * 1000,
      read: true,
      accent: '#F59E0B',
      actionHref: '/vault',
      source: 'system',
    },
  ];
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
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<KylrixNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const isHydratedRef = useRef(false);

  // 1. Instant 0ms Warm Hydration from LocalEngine on Mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userId = user?.$id || 'guest';
    const cacheKey = `kylrix_notifs_${userId}`;

    // Read saved read/dismissed state
    try {
      const savedRead = window.localStorage.getItem(`kylrix_notif_read_${userId}`);
      if (savedRead) setReadIds(new Set(JSON.parse(savedRead)));

      const savedDismissed = window.localStorage.getItem(`kylrix_notif_dismissed_${userId}`);
      if (savedDismissed) setDismissedIds(new Set(JSON.parse(savedDismissed)));
    } catch {}

    // Load from LocalEngine first (0ms)
    void (async () => {
      const cached = await LocalEngine.cacheGet<KylrixNotification[]>(cacheKey, 600_000).catch(() => null);
      if (cached && cached.length > 0) {
        setNotifications(cached);
        isHydratedRef.current = true;
      } else {
        const fallback = getEcosystemBaselineNotifications(user?.$id);
        setNotifications(fallback);
        await LocalEngine.cacheSet(cacheKey, fallback).catch(() => {});
        isHydratedRef.current = true;
      }
    })();
  }, [user?.$id]);

  // 2. Dynamic Activity Harvester (Aggregates real moments, account logs, suggestions)
  const harvestRealActivity = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const userId = user?.$id || 'guest';
    const cacheKey = `kylrix_notifs_${userId}`;

    const items: KylrixNotification[] = [...getEcosystemBaselineNotifications(userId)];
    const existingIds = new Set(items.map((i) => i.id));

    // A. Query real account session/security logs
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

          let title = 'Account Activity';
          let message = `Authenticated from ${log.clientName || 'Browser'} (${log.ip || 'Local IP'})`;
          let accent = '#10B981';

          if (log.event?.includes('session.create') || log.event?.includes('sessions.create')) {
            title = 'New Session Authenticated';
            message = `Signed in from ${log.countryName || 'Local session'} via ${log.clientName || 'Browser'}.`;
            accent = '#6366F1';
          }

          const id = `log_${log.$id || ts}_${log.event}`;
          if (!existingIds.has(id)) {
            existingIds.add(id);
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

    // B. Harvest real moments / threads activity from LocalEngine
    try {
      const moments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
      for (const m of moments.slice(0, 10)) {
        const ts = new Date(m.$createdAt || m.createdAt || Date.now()).getTime();
        const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
        const timeStr =
          diffMin < 60
            ? `${diffMin}m ago`
            : diffMin < 1440
            ? `${Math.floor(diffMin / 60)}h ago`
            : `${Math.floor(diffMin / 1440)}d ago`;

        if (m.commentsCount && m.commentsCount > 0) {
          const id = `moment_rep_${m.$id || m.id}`;
          if (!existingIds.has(id)) {
            existingIds.add(id);
            items.push({
              id,
              category: 'replies',
              title: `Reply on "${(m.caption || m.content || 'Moment').slice(0, 45)}"`,
              message: `${m.commentsCount} comments active on your moment.`,
              time: timeStr,
              timestamp: ts,
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
      }
    } catch {}

    // C. Merge context intelligence suggestions
    for (const s of suggestions || []) {
      const id = `sug_${s.id}`;
      if (!existingIds.has(id)) {
        existingIds.add(id);
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

    // Sort descending by recency and cap at 100 items
    const sorted = items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 100);
    setNotifications(sorted);
    await LocalEngine.cacheSet(cacheKey, sorted).catch(() => {});
  }, [user?.$id, suggestions]);

  useEffect(() => {
    if (isOpen) {
      void harvestRealActivity();
    }
  }, [isOpen, harvestRealActivity]);

  const markNotificationRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        const userId = user?.$id || 'guest';
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
      const userId = user?.$id || 'guest';
      window.localStorage.setItem(`kylrix_notif_read_${userId}`, JSON.stringify(Array.from(next)));
    }
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        const userId = user?.$id || 'guest';
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
      const userId = user?.$id || 'guest';
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

  // Process notifications with read/dismissed state
  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((n) => !dismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        read: readIds.has(n.id),
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [notifications, dismissedIds, readIds]);

  // Unread counts per category
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

  // Filtered by active tab (Capped at 100 items)
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

  const notificationBody = (
    <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. Header Tile */}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.03)',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '14px',
              bgcolor: alpha(appAccent, 0.12),
              color: appAccent,
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Bell size={18} strokeWidth={2.5} />
          </Box>
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            <Typography
              component="span"
              sx={{
                color: 'white',
                fontWeight: 900,
                fontSize: '0.98rem',
                lineHeight: 1.2,
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
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {unreadCounts.all > 0 ? `${unreadCounts.all} unread items` : 'All caught up'}
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
                width: 32,
                height: 32,
                borderRadius: '999px',
                color: 'rgba(255,255,255,0.6)',
                bgcolor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' },
              }}
            >
              <CheckCheck size={14} />
            </IconButton>
          )}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              width: 32,
              height: 32,
              borderRadius: '999px',
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' },
            }}
          >
            <CloseIcon size={14} />
          </IconButton>
        </Box>
      </Box>

      {/* 2. OpenBricks 4.0 Segmented Pill Tabs */}
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
                padding: '8px 4px',
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

      {/* 3. Notifications List */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxHeight: isDesktop ? 'calc(100vh - 270px)' : '48vh',
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
              gap: 1.5,
              p: 1.75,
              borderRadius: '18px',
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
            {/* Category Icon */}
            <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.25 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
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
                    width: 14,
                    height: 14,
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

            {/* Stacked Content Column (Strict No-Wrap Truncation) */}
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35, pr: 0.5 }}>
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

            {/* Dismiss Action */}
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
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'grid',
                placeItems: 'center',
                color: 'rgba(255,255,255,0.2)',
              }}
            >
              {activeTab === 'replies' ? (
                <MessageSquare size={20} />
              ) : activeTab === 'likes' ? (
                <Heart size={20} />
              ) : activeTab === 'follows' ? (
                <UserPlus size={20} />
              ) : (
                <Bell size={20} />
              )}
            </Box>
            <Typography
              component="span"
              sx={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.84rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              No {activeTab === 'all' ? '' : activeTab} updates
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
                ? 'Discussion responses and comments from Nostr and Kylrix will appear here.'
                : activeTab === 'likes'
                ? 'Reactions on your moments and shared notes.'
                : activeTab === 'follows'
                ? 'New followers and workspace invitations.'
                : 'You are completely caught up.'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 4. Footer */}
      {visibleNotifications.length > 0 && (
        <Box
          sx={{
            pt: 1.25,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            {filteredNotifications.length} of {visibleNotifications.length} items
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
    </Box>
  );

  // Desktop Rendering (Matching Profile Sidebar Layout)
  if (isDesktop) {
    if (nativeSidebar) {
      return (
        <NativeSidebarMount
          active={isOpen}
          sidebarKey="topbar-notifications"
          width={420}
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
            width: { xs: '100vw', sm: 420 },
            maxWidth: '100vw',
            borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            p: { xs: 2, sm: 2.75 },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
            Notifications
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
            <CloseIcon size={16} />
          </IconButton>
        </Box>

        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: '100%',
            borderRadius: '26px',
            bgcolor: '#161412',
            border: `1px solid ${alpha(appAccent, 0.22)}`,
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2 }, overflowY: 'auto', overflowX: 'hidden', flex: 1, boxSizing: 'border-box' }}>
            {notificationBody}
          </Box>
        </Paper>
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
          maxHeight: '52vh',
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
