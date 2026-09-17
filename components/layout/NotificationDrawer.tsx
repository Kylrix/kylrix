'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
  alpha,
  Drawer,
} from '@/lib/openbricks/primitives';
import {
  Bell,
  MessageSquare,
  Heart,
  Zap,
  UserPlus,
  UserCheck,
  ShieldCheck,
  CheckCheck,
  ChevronRight,
  Trash2,
  X as CloseIcon,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { sanitizeInAppHref } from '@/lib/routing/app-paths';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export type NotificationCategory = 'all' | 'replies' | 'likes' | 'zaps' | 'follows' | 'system';

export interface KylrixNotification {
  id: string;
  category: 'replies' | 'likes' | 'zaps' | 'follows' | 'system';
  title: string;
  message: string;
  time: string;
  timestamp: number;
  read: boolean;
  accent: string;
  actionHref?: string;
  actor?: {
    userId?: string;
    name: string;
    username?: string;
    avatar?: string;
    avatarId?: string;
    isNostr?: boolean;
    npub?: string;
    pubkey?: string;
  };
  source?: 'kylrix' | 'system';
}

function formatTimeAgo(ts: number): string {
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

export interface NotificationContentProps {
  onClose: () => void;
  appAccent?: string;
  isDesktop?: boolean;
}

/**
 * Core Notification Presentation Component.
 * Pure presentation & activity stream component integrated across mobile top-drawer and desktop right-sidebar.
 */
export function NotificationContent({
  onClose,
  appAccent = '#6366F1',
  isDesktop = false,
}: NotificationContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<KylrixNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const notificationsRef = useRef<KylrixNotification[]>([]);
  const lastHarvestAtRef = useRef<number>(0);
  const isHarvestingRef = useRef<boolean>(false);

  const [followingKeys, setFollowingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const userId = user?.$id || 'guest';
  const notifPartitionKey = `${userId}_default`;
  const cacheKey = `kylrix_activity_notifications_${notifPartitionKey}`;
  const readStorageKey = `kylrix_notif_read_${notifPartitionKey}`;
  const dismissedStorageKey = `kylrix_notif_dismissed_${notifPartitionKey}`;

  // Load persisted read/dismissed state for this specific account/identity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedRead = window.localStorage.getItem(readStorageKey);
      setReadIds(savedRead ? new Set(JSON.parse(savedRead)) : new Set());

      const savedDismissed = window.localStorage.getItem(dismissedStorageKey);
      setDismissedIds(savedDismissed ? new Set(JSON.parse(savedDismissed)) : new Set());
    } catch {}
  }, [readStorageKey, dismissedStorageKey]);

  // Initial Cache Hydration from LocalEngine for this partition & Follows
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    void (async () => {
      let cached = await LocalEngine.cacheGet<KylrixNotification[]>(cacheKey).catch(() => null);
      
      if (!Array.isArray(cached) || cached.length === 0) {
        cached = await LocalEngine.cacheGet<KylrixNotification[]>(`kylrix_activity_notifications_${userId}`).catch(() => null);
      }

      if (!Array.isArray(cached) || cached.length === 0) {
        cached = await LocalEngine.cacheGet<KylrixNotification[]>('kylrix_activity_notifications_global').catch(() => null);
      }

      if (!Array.isArray(cached) || cached.length === 0) {
        const rawLogs = await LocalEngine.cacheGet<any[]>(`f_notifications_${userId}`).catch(() => null);
        if (Array.isArray(rawLogs) && rawLogs.length > 0) {
          cached = rawLogs.map((log: any) => ({
            id: log.$id || log.id || `notif_${Math.random()}`,
            category: 'system' as any,
            title: log.action || 'Activity Notification',
            message: log.details || 'New activity on your account.',
            time: formatTimeAgo(new Date(log.$createdAt || log.createdAt || Date.now()).getTime()),
            timestamp: new Date(log.$createdAt || log.createdAt || Date.now()).getTime(),
            read: false,
            accent: '#6366F1',
            source: 'system' as const,
          }));
        }
      }

      if (Array.isArray(cached) && cached.length > 0 && !cancelled) {
        setNotifications(cached);
      }

      try {
        const { listWorkspaceIntelNotifications } = await import('@/lib/agentic/local-notifications');
        const intel = await listWorkspaceIntelNotifications(userId);
        if (!cancelled && intel.length) {
          setNotifications((prev) => {
            const map = new Map<string, KylrixNotification>();
            for (const n of [...intel, ...prev]) map.set(n.id, n);
            return Array.from(map.values())
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, 100);
          });
        }
      } catch {}

      const localGlobalFollows = (await LocalEngine.cacheGet<string[]>('kylrix:follows')) || [];
      const localUserFollows = userId && userId !== 'guest' ? ((await LocalEngine.cacheGet<string[]>(`kylrix:follows_${userId}`)) || []) : [];
      const merged = new Set<string>([...localGlobalFollows, ...localUserFollows].map((k) => k.toLowerCase()));
      if (!cancelled && merged.size > 0) {
        setFollowingKeys(merged);
      }
    })();

    const handleFollowsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (Array.isArray(customEvent.detail)) {
        setFollowingKeys(new Set(customEvent.detail.map((k) => String(k).toLowerCase())));
      }
    };

    window.addEventListener('kylrix:follows-updated', handleFollowsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('kylrix:follows-updated', handleFollowsUpdated);
    };
  }, [cacheKey, userId]);

  // Stable Activity Harvesting from LocalEngine
  const harvestLiveActivity = useCallback(async (force: boolean = false) => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (!force && now - lastHarvestAtRef.current < 60_000) {
      return;
    }
    if (isHarvestingRef.current) return;
    isHarvestingRef.current = true;
    lastHarvestAtRef.current = now;
    setSyncing(true);

    try {
      const itemsMap = new Map<string, KylrixNotification>();

      for (const n of notificationsRef.current) {
        itemsMap.set(n.id, n);
      }

      try {
        const { listWorkspaceIntelNotifications } = await import('@/lib/agentic/local-notifications');
        const intel = await listWorkspaceIntelNotifications(userId);
        for (const n of intel) {
          itemsMap.set(n.id, { ...n, time: formatTimeAgo(n.timestamp || Date.now()) });
        }
      } catch {}

      if (user?.$id) {
        try {
          const cachedLogs = await LocalEngine.cacheGet<{ logs: any[]; at: number }>('kylrix_session_logs_cache', 30 * 60 * 1000).catch(() => null);
          let logs: any[] = cachedLogs?.logs || [];
          if (!logs.length && navigator.onLine) {
            const logsRes = await account.listLogs().catch(() => ({ logs: [] }));
            logs = logsRes.logs || [];
            if (logs.length) {
              void LocalEngine.cacheSet('kylrix_session_logs_cache', { logs, at: now }).catch(() => {});
            }
          }
          for (const log of logs) {
            const ts = new Date(log.time).getTime();
            const timeStr = formatTimeAgo(ts);

            let title = 'Account Session Active';
            let message = `Signed in from ${log.countryName || 'Local Session'} via ${log.clientName || 'Web Browser'}.`;
            let accent = '#10B981';

            if (log.event?.includes('password') || log.event?.includes('mfa')) {
              title = 'Security Updated';
              message = `Security credentials modified for user from IP ${log.ip}.`;
              accent = '#F59E0B';
            }

            const id = `sys_log_${log.$id || ts}_${log.event}`;
            itemsMap.set(id, {
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
        } catch {}
      }

      const sorted = Array.from(itemsMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
      setNotifications(sorted);
      await LocalEngine.cacheSet(cacheKey, sorted).catch(() => {});
      await LocalEngine.cacheSet(`kylrix_activity_notifications_${userId}`, sorted).catch(() => {});
    } finally {
      setSyncing(false);
      isHarvestingRef.current = false;
    }
  }, [user?.$id, cacheKey, userId]);

  useEffect(() => {
    void harvestLiveActivity(false);
  }, [harvestLiveActivity]);

  // Live merge when ambient workspace tip lands in LocalEngine
  useEffect(() => {
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { userId?: string; notification?: KylrixNotification }
        | undefined;
      if (detail?.userId && detail.userId !== userId) return;
      const row = detail?.notification;
      if (!row) return;
      setNotifications((prev) => {
        const map = new Map<string, KylrixNotification>();
        map.set(row.id, { ...row, time: formatTimeAgo(row.timestamp || Date.now()) });
        for (const n of prev) map.set(n.id, n);
        return Array.from(map.values())
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 100);
      });
    };
    window.addEventListener('kylrix:local-notifications', onLocal as EventListener);
    return () => window.removeEventListener('kylrix:local-notifications', onLocal as EventListener);
  }, [userId]);

  const markNotificationRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(readStorageKey, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set([...Array.from(readIds), ...allIds]);
    setReadIds(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(readStorageKey, JSON.stringify(Array.from(next)));
    }
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(dismissedStorageKey, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set([...Array.from(dismissedIds), ...allIds]);
    setDismissedIds(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`kylrix_notif_dismissed_${userId}`, JSON.stringify(Array.from(next)));
    }
  };

  const { open: openUnifiedDrawer } = useUnifiedDrawer();

  const isFollowingActor = useCallback(
    (actor?: KylrixNotification['actor']) => {
      if (!actor) return false;
      const keys = [
        actor.pubkey?.toLowerCase(),
        actor.npub?.toLowerCase(),
        actor.userId?.toLowerCase(),
        actor.username?.toLowerCase()?.replace(/^@/, ''),
      ].filter(Boolean) as string[];

      return keys.some((k) => followingKeys.has(k));
    },
    [followingKeys]
  );

  const handleToggleFollow = async (
    actor: NonNullable<KylrixNotification['actor']>,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const primaryKey = actor.pubkey || actor.npub || actor.userId || actor.username;
    if (!primaryKey) return;

    const currentlyFollowing = isFollowingActor(actor);
    const allKeysToToggle = [
      actor.pubkey?.toLowerCase(),
      actor.npub?.toLowerCase(),
      actor.userId?.toLowerCase(),
      actor.username?.toLowerCase()?.replace(/^@/, ''),
    ].filter(Boolean) as string[];

    setFollowingKeys((prev) => {
      const nextSet = new Set(prev);
      if (currentlyFollowing) {
        allKeysToToggle.forEach((k) => nextSet.delete(k));
      } else {
        allKeysToToggle.forEach((k) => nextSet.add(k));
      }
      const nextArr = Array.from(nextSet);

      void LocalEngine.cacheSet('kylrix:follows', nextArr).catch(() => {});
      if (userId && userId !== 'guest') {
        void LocalEngine.cacheSet(`kylrix:follows_${userId}`, nextArr).catch(() => {});
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: nextArr }));
      }
      return nextSet;
    });

    toast.success(currentlyFollowing ? `Unfollowed ${actor.name || 'user'}` : `Following ${actor.name || 'user'}`);

    if (actor.userId && userId && userId !== 'guest') {
      void (async () => {
        try {
          const { SocialService } = await import('@/lib/services/social');
          if (currentlyFollowing) {
            await SocialService.unfollowUser(userId, actor.userId!);
          } else {
            await SocialService.followUser(userId, actor.userId!);
          }
        } catch {}
      })();
    }
  };

  const handleNotificationClick = (notif: KylrixNotification) => {
    markNotificationRead(notif.id);
    onClose();

    if (notif.category === 'follows' && notif.actor) {
      openUnifiedDrawer('profile-preview', {
        userId: notif.actor.userId,
        username: notif.actor.username || notif.actor.name,
        name: notif.actor.name,
        avatar: notif.actor.avatar,
        npub: notif.actor.npub,
        pubkey: notif.actor.pubkey,
        source: 'ecosystem',
      });
      return;
    }

    const href = notif.actionHref ? sanitizeInAppHref(notif.actionHref) : '';
    if (href) {
      router.push(href);
    }
  };

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((n) => !dismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        read: readIds.has(n.id),
        actionHref: n.actionHref ? sanitizeInAppHref(n.actionHref) : n.actionHref,
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [notifications, dismissedIds, readIds]);

  const unreadCounts = useMemo(() => {
    const counts = { all: 0, replies: 0, likes: 0, zaps: 0, follows: 0, system: 0 };
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

  const filteredNotifications = useMemo(() => {
    let list = visibleNotifications;
    if (activeTab !== 'all') {
      list = list.filter((n) => n.category === activeTab);
    }
    return list.slice(0, 100);
  }, [visibleNotifications, activeTab]);

  const tabs: Array<{ id: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Bell size={13} /> },
    { id: 'replies', label: 'Replies', icon: <MessageSquare size={13} /> },
    { id: 'likes', label: 'Likes', icon: <Heart size={13} /> },
    { id: 'zaps', label: 'Zaps', icon: <Zap size={13} /> },
    { id: 'follows', label: 'Follows', icon: <UserPlus size={13} /> },
    { id: 'system', label: 'System', icon: <ShieldCheck size={13} /> },
  ];

  const renderCategoryIcon = (category: KylrixNotification['category']) => {
    switch (category) {
      case 'replies':
        return <MessageSquare size={17} strokeWidth={2.4} />;
      case 'likes':
        return <Heart size={17} strokeWidth={2.4} />;
      case 'zaps':
        return <Zap size={17} strokeWidth={2.4} />;
      case 'follows':
        return <UserPlus size={17} strokeWidth={2.4} />;
      case 'system':
      default:
        return <ShieldCheck size={17} strokeWidth={2.4} />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, width: '100%', maxWidth: '100%', height: '100%', flex: 1, boxSizing: 'border-box', px: 0.5 }}>
      {/* 1. Header Identity Tile */}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.75,
          px: 2.25,
          py: 1.75,
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#161412',
          minWidth: 0,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: '14px',
            bgcolor: alpha(appAccent, 0.12),
            color: appAccent,
            border: `1px solid ${alpha(appAccent, 0.22)}`,
          }}
        >
          <Bell size={20} strokeWidth={2.5} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4, pr: 0.5 }}>
          <Typography
            component="span"
            sx={{
              color: 'white',
              fontWeight: 900,
              fontSize: '0.98rem',
              lineHeight: 1.25,
              fontFamily: 'var(--font-clash)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Activity & Notifications
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, overflow: 'hidden' }}>
            <Box
              component="span"
              sx={{
                fontSize: '9px',
                fontFamily: 'monospace',
                px: 1.25,
                py: 0.3,
                borderRadius: '999px',
                bgcolor: unreadCounts.all > 0 ? alpha(appAccent, 0.18) : 'rgba(255,255,255,0.08)',
                color: unreadCounts.all > 0 ? appAccent : 'rgba(255,255,255,0.5)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                flexShrink: 0,
                lineHeight: 1.2,
              }}
            >
              {unreadCounts.all > 0 ? `${unreadCounts.all} UNREAD` : 'CAUGHT UP'}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <IconButton
            onClick={() => harvestLiveActivity(true)}
            disabled={syncing}
            size="small"
            title="Sync activity"
            sx={{
              width: 32,
              height: 32,
              borderRadius: '999px',
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: '#1C1917', color: 'white' },
            }}
          >
            <RotateCw size={14} className={syncing ? 'animate-spin text-[#F59E0B]' : ''} />
          </IconButton>

          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              width: 32,
              height: 32,
              borderRadius: '999px',
              color: 'rgba(255,255,255,0.4)',
              bgcolor: 'rgba(255,255,255,0.03)',
              '&:hover': { bgcolor: '#1C1917', color: 'white' },
            }}
          >
            <CloseIcon size={14} />
          </IconButton>
        </Box>
      </Box>

      {/* 2. Horizontal Filter Pill Tabs */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          flexShrink: 0,
          width: '100%',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = unreadCounts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 13px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: isActive ? 800 : 600,
                border: isActive
                  ? `1px solid ${appAccent}`
                  : '1px solid rgba(255,255,255,0.08)',
                backgroundColor: isActive
                  ? alpha(appAccent, 0.22)
                  : '#161412',
                color: '#FFFFFF',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                minWidth: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.85 }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '9px',
                    fontWeight: 900,
                    backgroundColor: isActive ? appAccent : 'rgba(255,255,255,0.15)',
                    color: '#FFFFFF',
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
          gap: 1.25,
          maxHeight: isDesktop ? 'calc(100vh - 270px)' : 'calc(60dvh - 180px)',
          minHeight: '120px',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          px: 0.5,
          pb: 1,
          width: '100%',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
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
              gap: 1.75,
              px: 2.25,
              py: 1.75,
              borderRadius: '18px',
              bgcolor: notif.read ? '#161412' : '#1C1917',
              border: '1px solid',
              borderColor: notif.read ? 'rgba(255,255,255,0.08)' : alpha(notif.accent, 0.35),
              color: '#FFFFFF',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              minWidth: 0,
              boxSizing: 'border-box',
              '&:hover': {
                bgcolor: '#1C1917',
                borderColor: alpha(notif.accent, 0.5),
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* Fixed Icon Slot */}
            <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.25 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '13px',
                  bgcolor: alpha(notif.accent, 0.14),
                  color: notif.accent,
                  border: `1px solid ${alpha(notif.accent, 0.24)}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {renderCategoryIcon(notif.category)}
              </Box>
            </Box>

            {/* Structured Copy Column */}
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4, pr: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    color: '#FFFFFF',
                    fontWeight: notif.read ? 700 : 900,
                    fontSize: '0.88rem',
                    lineHeight: 1.25,
                  }}
                  noWrap
                >
                  {notif.actor?.name ? `${notif.actor.name} · ${notif.title}` : notif.title}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: '#FFFFFF',
                    opacity: 0.65,
                    fontWeight: 600,
                    fontSize: '0.7rem',
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
                  color: '#FFFFFF',
                  opacity: notif.read ? 0.75 : 0.95,
                  fontWeight: 500,
                  fontSize: '0.78rem',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notif.message}
              </Typography>

              {/* Follow / Mutual Sub-Card */}
              {notif.category === 'follows' && notif.actor && (
                <Box
                  onClick={(e: React.MouseEvent) => handleToggleFollow(notif.actor!, e)}
                  sx={{
                    mt: 1,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.25,
                    px: 1.25,
                    py: 1,
                    borderRadius: '13px',
                    bgcolor: isFollowingActor(notif.actor) ? 'rgba(255,255,255,0.06)' : alpha(appAccent, 0.12),
                    border: '1px solid',
                    borderColor: isFollowingActor(notif.actor)
                      ? 'rgba(255,255,255,0.12)'
                      : alpha(appAccent, 0.35),
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    '&:hover': {
                      bgcolor: isFollowingActor(notif.actor)
                        ? '#1C1917'
                        : alpha(appAccent, 0.2),
                      borderColor: isFollowingActor(notif.actor)
                        ? 'rgba(255,255,255,0.2)'
                        : alpha(appAccent, 0.5),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '7px',
                        bgcolor: isFollowingActor(notif.actor) ? 'rgba(255,255,255,0.08)' : alpha(appAccent, 0.2),
                        color: isFollowingActor(notif.actor) ? '#FFFFFF' : appAccent,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isFollowingActor(notif.actor) ? (
                        <UserCheck size={13} strokeWidth={2.4} />
                      ) : (
                        <UserPlus size={13} strokeWidth={2.4} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <Typography
                        component="span"
                        sx={{
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '0.76rem',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isFollowingActor(notif.actor) ? 'Mutual Connection' : 'Follows you'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      px: 1.25,
                      py: 0.35,
                      borderRadius: '999px',
                      bgcolor: isFollowingActor(notif.actor) ? 'rgba(255,255,255,0.1)' : appAccent,
                      color: isFollowingActor(notif.actor) ? '#FFFFFF' : '#000000',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      letterSpacing: '0.02em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isFollowingActor(notif.actor) ? (
                      <>
                        <UserCheck size={11} strokeWidth={2.5} />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={11} strokeWidth={2.5} />
                        <span>Follow back</span>
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Dismiss & Action */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mt: 0.4 }}>
              <IconButton
                size="small"
                onClick={(e: React.MouseEvent) => dismissNotification(notif.id, e)}
                title="Dismiss"
                sx={{
                  width: 26,
                  height: 26,
                  color: '#FFFFFF',
                  opacity: 0.5,
                  '&:hover': { opacity: 1, color: '#EF4444', bgcolor: 'rgba(239,68,68,0.15)' },
                }}
              >
                <CloseIcon size={13} />
              </IconButton>
              <ChevronRight size={15} style={{ color: '#FFFFFF', opacity: 0.4 }} />
            </Box>
          </Box>
        ))}

        {filteredNotifications.length === 0 && (
          <Box
            sx={{
              py: 6,
              px: 3,
              textAlign: 'center',
              display: 'grid',
              placeItems: 'center',
              bgcolor: '#161412',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              my: 1,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.06)',
                color: '#FFFFFF',
                display: 'grid',
                placeItems: 'center',
                mb: 1.5,
              }}
            >
              <Bell size={22} strokeWidth={2} />
            </Box>
            <Typography sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.92rem', mb: 0.5 }}>
              No Notifications
            </Typography>
            <Typography
              sx={{
                color: '#FFFFFF',
                opacity: 0.65,
                fontSize: '0.78rem',
                maxWidth: 240,
                lineHeight: 1.35,
              }}
            >
              All caught up across ecosystem activity.
            </Typography>
          </Box>
        )}
      </Box>

      {/* 4. Action Controls */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, minWidth: 0, width: '100%', pt: 0.5 }}>
        <Button
          onClick={markAllRead}
          disabled={visibleNotifications.length === 0}
          sx={{
            minHeight: 44,
            borderRadius: '16px',
            bgcolor: '#161412',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#FFFFFF',
            px: 2,
            py: 1.2,
            fontSize: '0.84rem',
            textTransform: 'none',
            fontWeight: 800,
            minWidth: 0,
            overflow: 'hidden',
            '&:hover': { bgcolor: '#1C1917', borderColor: 'rgba(255,255,255,0.2)' },
            '&:disabled': { opacity: 0.35 },
          }}
          startIcon={<CheckCheck size={14} style={{ flexShrink: 0 }} />}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>
            Mark all read
          </span>
        </Button>

        <Button
          onClick={clearAllNotifications}
          disabled={visibleNotifications.length === 0}
          sx={{
            minHeight: 44,
            borderRadius: '16px',
            bgcolor: '#161412',
            color: '#FF4D4D',
            border: '1px solid rgba(255, 77, 77, 0.25)',
            px: 2,
            py: 1.2,
            fontSize: '0.84rem',
            textTransform: 'none',
            fontWeight: 800,
            minWidth: 0,
            overflow: 'hidden',
            '&:hover': { bgcolor: 'rgba(255,77,77,0.15)' },
            '&:disabled': { opacity: 0.35 },
          }}
          startIcon={<Trash2 size={14} style={{ flexShrink: 0 }} />}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>
            Clear all
          </span>
        </Button>
      </Box>
    </Box>
  );
}

export interface CompactNotificationPillProps {
  notification: KylrixNotification;
  onExpand: () => void;
  onDismiss: () => void;
  onApply?: () => void;
  appAccent?: string;
  isDesktop?: boolean;
}

/**
 * Compact Pill Banner Component for Passive / Unprompted Notifications.
 * Strictly adheres to OpenBricks design tokens:
 * - Canvas: Pitch-Black (#000000)
 * - Container: Ash (#161412) with #1C1917 hover state
 * - Geometry: Pill (999px radius)
 * - Compact typography with truncated single-line copy preview and quick inline action controls.
 */
export function CompactNotificationPill({
  notification,
  onExpand,
  onDismiss,
  onApply,
  appAccent = '#6366F1',
}: CompactNotificationPillProps) {
  const router = useRouter();

  const handlePillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand();
  };

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApply) {
      onApply();
    } else if (notification.actionHref) {
      const href = sanitizeInAppHref(notification.actionHref);
      if (href) router.push(href);
      onDismiss();
    } else {
      onExpand();
    }
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <Box
      onClick={handlePillClick}
      sx={{
        height: 44,
        maxHeight: 44,
        px: 1.5,
        borderRadius: '999px',
        bgcolor: '#161412',
        border: '1px solid',
        borderColor: alpha(notification.accent || appAccent, 0.35),
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        color: '#FFFFFF',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 10,
        '&:hover': {
          bgcolor: '#1C1917',
          borderColor: alpha(notification.accent || appAccent, 0.55),
          boxShadow: `0 0 20px ${alpha(notification.accent || appAccent, 0.2)}`,
        },
      }}
    >
      {/* Icon Badge */}
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '999px',
          bgcolor: alpha(notification.accent || appAccent, 0.2),
          color: notification.accent || appAccent,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={14} strokeWidth={2.4} />
      </Box>

      {/* Single-line Truncated Copy */}
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-satoshi)',
            fontWeight: 800,
            fontSize: '0.8rem',
            color: '#FFFFFF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}
        >
          {notification.title}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-satoshi)',
            fontWeight: 500,
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.7)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
            display: { xs: 'none', sm: 'inline' },
          }}
        >
          — {notification.message}
        </Typography>
      </Box>

      {/* Quick Action Controls: Open/Apply + Dismiss */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <Button
          size="small"
          onClick={handleApplyClick}
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.4,
            height: 26,
            borderRadius: '999px',
            bgcolor: alpha(appAccent, 0.2),
            color: appAccent,
            border: `1px solid ${alpha(appAccent, 0.35)}`,
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'none',
            lineHeight: 1,
            '&:hover': {
              bgcolor: alpha(appAccent, 0.35),
            },
          }}
        >
          {notification.actionHref ? 'Open' : 'View'}
        </Button>

        <IconButton
          size="small"
          onClick={handleDismissClick}
          sx={{
            width: 26,
            height: 26,
            color: 'rgba(255,255,255,0.5)',
            '&:hover': { color: '#FF4D4D', bgcolor: 'rgba(255,77,77,0.15)' },
          }}
        >
          <CloseIcon size={13} />
        </IconButton>
      </Box>
    </Box>
  );
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
  if (!isOpen) return null;

  // Desktop View (Matching Native Sidebar & Right Drawer)
  if (isDesktop) {
    if (nativeSidebar) {
      return (
        <NativeSidebarMount
          active={isOpen}
          sidebarKey="topbar-notifications"
          width={440}
          title="Notifications"
        >
          <Box sx={{ p: 3, overflowX: 'hidden', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', bgcolor: '#000000' }}>
            <NotificationContent onClose={onClose} appAccent={appAccent} isDesktop={true} />
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
            bgcolor: '#000000',
            backgroundImage: 'none',
            width: { xs: '100vw', sm: 440 },
            maxWidth: '100vw',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            p: { xs: 2, sm: 3 },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem' }}>
            Notifications
          </Typography>
          <IconButton onClick={onClose} sx={{ color: '#FFFFFF', opacity: 0.6, '&:hover': { opacity: 1, color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.08)' }, width: 32, height: 32 }}>
            <CloseIcon size={16} />
          </IconButton>
        </Box>

        <NotificationContent onClose={onClose} appAccent={appAccent} isDesktop={true} />
      </Drawer>
    );
  }

  // Mobile Topbar Dropdown Panel
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
        bgcolor: '#000000',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, sm: 2.25, md: 4 },
          py: { xs: 1.5, sm: 2 },
          maxHeight: '60dvh',
          display: 'flex',
          flexDirection: 'column',
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
            bgcolor: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2.25 }, boxSizing: 'border-box' }}>
            <NotificationContent onClose={onClose} appAccent={appAccent} isDesktop={false} />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
