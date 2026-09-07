'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function harvestLiveActivity(bag: any) {
  const {
  activeTab,
  cacheKey,
  clearAllNotifications,
  diffMin,
  dismissNotification,
  dismissedIds,
  dismissedStorageKey,
  filteredNotifications,
  followingKeys,
  handleNotificationClick,
  handleToggleFollow,
  harvestLiveActivity,
  isFollowingActor,
  isHarvestingRef,
  lastHarvestAtRef,
  markAllRead,
  markNotificationRead,
  notifPartitionKey,
  notificationBody,
  notifications,
  notificationsRef,
  openMomentFromNotification,
  poolRef,
  readIds,
  readStorageKey,
  renderCategoryIcon,
  router,
  setActiveTab,
  setDismissedIds,
  setFollowingKeys,
  setNotifications,
  setReadIds,
  setSyncing,
  syncing,
  unreadCounts,
  userId,
  userPubkeyHex,
  visibleNotifications
  } = bag as any;

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

      // A0. Workspace ambient tips from LocalEngine (never remote)
      try {
        const { listWorkspaceIntelNotifications } = await import('@/lib/agentic/local-notifications');
        const intel = await listWorkspaceIntelNotifications(userId);
        for (const n of intel) {
          itemsMap.set(n.id, { ...n, time: formatTimeAgo(n.timestamp || Date.now()) });
        }
      } catch {}

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

          const handleNostrEvent = (..._args: any[]) => handleNostrEvent_ext({ activeTab, cacheKey, clearAllNotifications, diffMin, dismissNotification, dismissedIds, dismissedStorageKey, filteredNotifications, followingKeys, handleNostrEvent, handleNotificationClick, handleToggleFollow, harvestLiveActivity, isFollowingActor, isHarvestingRef, lastHarvestAtRef, markAllRead, markNotificationRead, notifPartitionKey, notificationBody, notifications, notificationsRef, openMomentFromNotification, poolRef, readIds, readStorageKey, renderCategoryIcon, router, setActiveTab, setDismissedIds, setFollowingKeys, setNotifications, setReadIds, setSyncing, syncing, unreadCounts, userId, userPubkeyHex, visibleNotifications });

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
            void LocalEngine.cacheSet(`kylrix_activity_notifications_${userId}`, finalSorted);
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
      await LocalEngine.cacheSet(`kylrix_activity_notifications_${userId}`, sorted).catch(() => {});
    } finally {
      if (!userPubkeyHex) {
        setSyncing(false);
        isHarvestingRef.current = false;
      }
    }
}
