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
  UserPlus,
  ShieldCheck,
  CheckCheck,
  ChevronRight,
  Trash2,
  X as CloseIcon,
  RotateCw,
} from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { isTopbarScrollAtTop } from '@/sdk/topbar';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { npubToBytes, bytesToHex, bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
import { queueNostrProfileFetch, getCachedNostrProfile } from '@/lib/nostr/metadata';
import { getNostrReadRelays } from '@/lib/connect/feed-settings';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';

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
    userId?: string;
    name: string;
    username?: string;
    avatar?: string;
    avatarId?: string;
    isNostr?: boolean;
    npub?: string;
    pubkey?: string;
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

const DEFAULT_NOTIFICATION_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
];

function formatTimeAgo(ts: number): string {
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
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
  const { identity } = useNostrIdentity();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<KylrixNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const poolRef = useRef<NostrRelayPool | null>(null);
  const notificationsRef = useRef<KylrixNotification[]>([]);
  const lastHarvestAtRef = useRef<number>(0);
  const isHarvestingRef = useRef<boolean>(false);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // 1. Extract user pubkey (Hex and Npub)
  const userPubkeyHex = useMemo(() => {
    if (!identity?.npub) return null;
    try {
      const bytes = npubToBytes(identity.npub);
      return bytesToHex(bytes);
    } catch {
      return null;
    }
  }, [identity?.npub]);

  const userId = user?.$id || 'guest';
  const notifPartitionKey = `${userId}_${userPubkeyHex ? userPubkeyHex.slice(0, 16) : 'default'}`;
  const cacheKey = `kylrix_activity_notifications_${notifPartitionKey}`;
  const readStorageKey = `kylrix_notif_read_${notifPartitionKey}`;
  const dismissedStorageKey = `kylrix_notif_dismissed_${notifPartitionKey}`;

  // 2. Load persisted read/dismissed state for this specific account/identity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedRead = window.localStorage.getItem(readStorageKey);
      setReadIds(savedRead ? new Set(JSON.parse(savedRead)) : new Set());

      const savedDismissed = window.localStorage.getItem(dismissedStorageKey);
      setDismissedIds(savedDismissed ? new Set(JSON.parse(savedDismissed)) : new Set());
    } catch {}
  }, [readStorageKey, dismissedStorageKey]);

  // 3. 0ms Initial Cache Hydration from LocalEngine for this partition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    void (async () => {
      const cached = await LocalEngine.cacheGet<KylrixNotification[]>(cacheKey, 600_000).catch(() => null);
      if (Array.isArray(cached)) {
        setNotifications(cached);
      } else {
        setNotifications([]);
      }
    })();
  }, [cacheKey]);

  // 4. Stable Activity Harvesting from LocalEngine & Nostr (Throttled, 0 loop)
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

      // Preserve existing valid cached items first
      for (const n of notificationsRef.current) {
        itemsMap.set(n.id, n);
      }

      // A. Real Appwrite Security & Session Logs (Cached with 30-min TTL in LocalEngine)
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

      // B. Real Moments Discussions & Reactions from Local Engine (0 network round-trips)
      try {
        const moments =
          (await LocalEngine.cacheGet<any[]>('f_unified_moments_feed')) ||
          (await LocalEngine.cacheGet<any[]>('f_moments_list')) ||
          [];

        for (const m of moments.slice(0, 30)) {
          const ts = new Date(m.$createdAt || m.createdAt || Date.now()).getTime();
          const timeStr = formatTimeAgo(ts);

          if (m.commentsCount && m.commentsCount > 0) {
            const id = `rep_moment_${m.$id || m.id}`;
            itemsMap.set(id, {
              id,
              category: 'replies',
              title: `Discussion on "${(m.caption || m.content || 'Moment').slice(0, 45)}"`,
              message: `${m.commentsCount} active replies and comments on your moment.`,
              time: timeStr,
              timestamp: ts + 1000,
              read: false,
              accent: '#6366F1',
              actionHref: `/moment/${m.$id || m.id}`,
              actor: {
                name: m.userName || m.username || 'Community Member',
                username: m.username,
                isNostr: !!m.isNostr,
              },
              source: m.isNostr ? 'nostr' : 'kylrix',
            });
          }

          if (m.likesCount && m.likesCount > 0) {
            const id = `like_moment_${m.$id || m.id}`;
            itemsMap.set(id, {
              id,
              category: 'likes',
              title: 'Reactions on your post',
              message: `${m.likesCount} people liked your moment "${(m.caption || m.content || '').slice(0, 45)}"`,
              time: timeStr,
              timestamp: ts + 500,
              read: false,
              accent: '#EC4899',
              actionHref: `/moment/${m.$id || m.id}`,
              source: m.isNostr ? 'nostr' : 'kylrix',
            });
          }
        }
      } catch {}

      // C. Live Nostr Relays Notification Harvesting (`#p` targeted query)
      if (userPubkeyHex) {
        try {
          const configuredRelays = await getNostrReadRelays().catch(() => DEFAULT_NOTIFICATION_RELAYS);
          const relayUrls = Array.from(new Set([...DEFAULT_NOTIFICATION_RELAYS, ...configuredRelays]));

          if (!poolRef.current) {
            poolRef.current = new NostrRelayPool(relayUrls);
            poolRef.current.connect();
          }

          const subId = `kylrix_notif_sub_${Date.now()}`;
          const authorsToFetch: string[] = [];

          // Query Nostr relays for events tagging the user's pubkey
          poolRef.current.subscribe(subId, [
            {
              '#p': [userPubkeyHex],
              kinds: [1, 3, 6, 7, 9735],
              limit: 50,
            },
          ]);

          const handleNostrEvent = (event: NostrEvent) => {
            if (!event || !event.id) return;
            const ts = (event.created_at || Date.now() / 1000) * 1000;
            const timeStr = formatTimeAgo(ts);
            const cachedAuthor = getCachedNostrProfile(event.pubkey);
            const authorDisplayName = cachedAuthor?.name || cachedAuthor?.displayName || `npub…${event.pubkey.slice(-6)}`;
            let npubStr: string | undefined;
            try {
              npubStr = bytesToNpub(hexToBytes(event.pubkey));
            } catch {}

            const actorMetadata = {
              name: authorDisplayName,
              username: cachedAuthor?.nip05 || (cachedAuthor?.name ? `@${cachedAuthor.name}` : undefined),
              avatar: cachedAuthor?.picture,
              isNostr: true,
              npub: npubStr,
              pubkey: event.pubkey,
            };

            authorsToFetch.push(event.pubkey);

            if (event.kind === 1) {
              const notifId = `nostr_reply_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'replies',
                title: `${authorDisplayName} replied to your post`,
                message: (event.content || '').slice(0, 140),
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#8B5CF6',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 3) {
              const notifId = `nostr_follow_${event.pubkey}`;
              itemsMap.set(notifId, {
                id: notifId,
                category: 'follows',
                title: `${authorDisplayName} followed you`,
                message: `Started following your Nostr profile.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#3B82F6',
                actionHref: `/connect`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 7) {
              const notifId = `nostr_like_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;
              const emoji = event.content && event.content !== '+' ? event.content : '❤️';

              itemsMap.set(notifId, {
                id: notifId,
                category: 'likes',
                title: `${authorDisplayName} reacted ${emoji}`,
                message: `Liked your Nostr note.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#EC4899',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 6) {
              const notifId = `nostr_repost_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'replies',
                title: `${authorDisplayName} boosted your post`,
                message: `Shared your Nostr note with their followers.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#10B981',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 9735) {
              const notifId = `nostr_zap_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : undefined;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'likes',
                title: `⚡ Lightning Zap received!`,
                message: `${authorDisplayName} sent you a Lightning Zap on Nostr.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#F59E0B',
                actionHref: targetId ? `/moment/nostr_${targetId}` : `/connect`,
                actor: actorMetadata,
                source: 'nostr',
              });
            }
          };

          (poolRef.current as any).listeners.add(handleNostrEvent);

          setTimeout(() => {
            if (poolRef.current) {
              (poolRef.current as any).listeners.delete(handleNostrEvent);
              poolRef.current.unsubscribe(subId);
            }
            if (authorsToFetch.length) {
              void queueNostrProfileFetch(Array.from(new Set(authorsToFetch)));
            }
            const finalSorted = Array.from(itemsMap.values())
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, 100);
            setNotifications(finalSorted);
            void LocalEngine.cacheSet(cacheKey, finalSorted);
            setSyncing(false);
            isHarvestingRef.current = false;
          }, 1500);
        } catch (err) {
          console.warn('[NotificationDrawer] Nostr harvest warning:', err);
        }
      }

      const sorted = Array.from(itemsMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
      setNotifications(sorted);
      await LocalEngine.cacheSet(cacheKey, sorted).catch(() => {});
    } finally {
      if (!userPubkeyHex) {
        setSyncing(false);
        isHarvestingRef.current = false;
      }
    }
  }, [user?.$id, userPubkeyHex, cacheKey]);

  useEffect(() => {
    if (isOpen) {
      void harvestLiveActivity(false);
    }
  }, [isOpen, harvestLiveActivity]);

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

  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();

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
        source: notif.actor.isNostr ? 'nostr' : 'ecosystem',
      });
      return;
    }

    if (notif.actionHref) {
      router.push(notif.actionHref);
      return;
    }

    if (notif.id.includes('moment')) {
      const parts = notif.id.split('_');
      const momentId = parts[parts.length - 1];
      if (momentId) {
        router.push(`/moment/${momentId}`);
      }
    }
  };

  // Filter visible items
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

  // Active tab items
  const filteredNotifications = useMemo(() => {
    let list = visibleNotifications;
    if (activeTab !== 'all') {
      list = list.filter((n) => n.category === activeTab);
    }
    return list.slice(0, 100);
  }, [visibleNotifications, activeTab]);

  if (!isOpen) return null;

  const tabs: Array<{ id: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All', icon: <Bell size={13} /> },
    { id: 'replies', label: 'Replies', icon: <MessageSquare size={13} /> },
    { id: 'likes', label: 'Likes', icon: <Heart size={13} /> },
    { id: 'follows', label: 'Follows', icon: <UserPlus size={13} /> },
    { id: 'system', label: 'System', icon: <ShieldCheck size={13} /> },
  ];

  const renderCategoryIcon = (category: KylrixNotification['category']) => {
    switch (category) {
      case 'replies':
        return <MessageSquare size={17} strokeWidth={2.4} />;
      case 'likes':
        return <Heart size={17} strokeWidth={2.4} />;
      case 'follows':
        return <UserPlus size={17} strokeWidth={2.4} />;
      case 'system':
      default:
        return <ShieldCheck size={17} strokeWidth={2.4} />;
    }
  };

  // OpenBricks 4.0 Tactile Content Architecture (1:1 with renderProfilePanel)
  const notificationBody = (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. Header Identity Tile (Generous padding, avatar/icon slot, title, and close button) */}
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
          bgcolor: 'rgba(255,255,255,0.03)',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Left Icon Slot */}
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

        {/* Stacked Copy Column */}
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

            {identity?.npub ? (
              <Typography
                component="span"
                sx={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.45)',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                  fontFamily: 'monospace',
                }}
              >
                {identity.npub.slice(0, 10)}…{identity.npub.slice(-4)}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {/* Action Controls & Close */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <IconButton
            onClick={() => harvestLiveActivity()}
            disabled={syncing}
            size="small"
            title="Sync Nostr relays & activity"
            sx={{
              width: 32,
              height: 32,
              borderRadius: '999px',
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' },
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
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' },
            }}
          >
            <CloseIcon size={15} />
          </IconButton>
        </Box>
      </Box>

      {/* 2. OpenBricks 4.0 Tactile Category Tabs */}
      <Box
        sx={{
          p: 0.75,
          borderRadius: '18px',
          bgcolor: '#0A0908',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 0.75,
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
                gap: '5px',
                padding: '8px 4px',
                borderRadius: '12px',
                fontSize: '11.5px',
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
                    fontSize: '9.5px',
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

      {/* 3. Notifications List Column (ui.tailwind-fix standard) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          maxHeight: isDesktop ? 'calc(100vh - 310px)' : '45vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          pr: 0.5,
          width: '100%',
          boxSizing: 'border-box',
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
              bgcolor: notif.read ? 'rgba(255,255,255,0.02)' : '#1C1A18',
              border: '1px solid',
              borderColor: notif.read ? 'rgba(255,255,255,0.06)' : alpha(notif.accent, 0.26),
              color: 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              minWidth: 0,
              boxSizing: 'border-box',
              '&:hover': {
                bgcolor: '#242220',
                borderColor: alpha(notif.accent, 0.4),
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* 1. Fixed Icon Slot */}
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

              {notif.source === 'nostr' && (
                <Box
                  title="Nostr event"
                  sx={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
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

            {/* 2. Structured Stacked Copy Column */}
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4, pr: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    color: notif.read ? 'rgba(255,255,255,0.85)' : 'white',
                    fontWeight: notif.read ? 700 : 800,
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
                    color: 'rgba(255,255,255,0.4)',
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
                  color: notif.read ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.76)',
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
            </Box>

            {/* 3. Dismiss & Right Action */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mt: 0.4 }}>
              <IconButton
                size="small"
                onClick={(e: React.MouseEvent) => dismissNotification(notif.id, e)}
                title="Dismiss"
                sx={{
                  width: 26,
                  height: 26,
                  color: 'rgba(255,255,255,0.25)',
                  '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' },
                }}
              >
                <CloseIcon size={13} />
              </IconButton>
              <ChevronRight size={15} style={{ color: 'rgba(255,255,255,0.25)' }} />
            </Box>
          </Box>
        ))}

        {/* Clean Empty State */}
        {filteredNotifications.length === 0 && (
          <Box
            sx={{
              py: 6,
              px: 3,
              textAlign: 'center',
              display: 'grid',
              placeItems: 'center',
              gap: 1.5,
              borderRadius: '20px',
              border: '1px dashed rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.01)',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'grid',
                placeItems: 'center',
                color: 'rgba(255,255,255,0.3)',
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
                fontSize: '0.86rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1.2,
              }}
            >
              No {activeTab === 'all' ? '' : activeTab} notifications
            </Typography>
            <Typography
              component="span"
              sx={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.76rem',
                maxWidth: 240,
                lineHeight: 1.35,
              }}
            >
              {activeTab === 'replies'
                ? 'Nostr replies and moment discussions will appear here.'
                : activeTab === 'likes'
                ? 'Likes and reactions on your posts.'
                : activeTab === 'follows'
                ? 'New followers and workspace invites.'
                : 'All caught up across ecosystem and Nostr relays.'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 4. Action Buttons (Mark All Read & Clear Side-by-Side matching Profile Panel) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, minWidth: 0, width: '100%', pt: 0.5 }}>
        <Button
          onClick={markAllRead}
          disabled={visibleNotifications.length === 0}
          sx={{
            minHeight: 44,
            borderRadius: '16px',
            bgcolor: alpha(appAccent, 0.08),
            border: `1px solid ${alpha(appAccent, 0.16)}`,
            color: appAccent,
            px: 2,
            py: 1.2,
            fontSize: '0.84rem',
            textTransform: 'none',
            fontWeight: 800,
            minWidth: 0,
            overflow: 'hidden',
            '&:hover': { bgcolor: alpha(appAccent, 0.15) },
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
            bgcolor: 'rgba(255,77,77,0.06)',
            color: '#FF4D4D',
            border: '1px solid rgba(255,77,77,0.14)',
            px: 2,
            py: 1.2,
            fontSize: '0.84rem',
            textTransform: 'none',
            fontWeight: 800,
            minWidth: 0,
            overflow: 'hidden',
            '&:hover': { bgcolor: 'rgba(255,77,77,0.12)' },
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

  // Desktop View (Matching Native Sidebar & Right Drawer)
  if (isDesktop) {
    if (nativeSidebar) {
      return (
        <NativeSidebarMount
          active={isOpen}
          sidebarKey="topbar-notifications"
          width={400}
          title="Notifications"
        >
          <Box sx={{ p: { xs: 1.5, sm: 2.25 }, overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
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
          <Box sx={{ p: { xs: 1.5, sm: 2.25 }, overflowY: 'auto', overflowX: 'hidden', flex: 1, boxSizing: 'border-box' }}>
            {notificationBody}
          </Box>
        </Paper>
      </Drawer>
    );
  }

  // Mobile Topbar Dropdown Panel (Exact 1:1 match with renderProfilePanel)
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
            border: `1px solid ${alpha(appAccent, 0.22)}`,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2.25 }, overflowX: 'hidden', boxSizing: 'border-box' }}>
            {notificationBody}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
