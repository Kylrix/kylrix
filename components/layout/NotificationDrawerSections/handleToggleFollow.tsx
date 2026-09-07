'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function handleToggleFollow(bag: any) {
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
  handleNostrEvent,
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

      // 1. LocalEngine 0ms persistence
      void LocalEngine.cacheSet('kylrix:follows', nextArr).catch(() => {});
      if (userId && userId !== 'guest') {
        void LocalEngine.cacheSet(`kylrix:follows_${userId}`, nextArr).catch(() => {});
      }

      // 2. Realtime local broadcast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: nextArr }));
      }
      return nextSet;
    });

    toast.success(currentlyFollowing ? `Unfollowed ${actor.name || 'user'}` : `Following ${actor.name || 'user'}`);

    // 3. Background remote dispatch (optimistic)
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

    if (actor.pubkey && userPubkeyHex && identity) {
      void (async () => {
        try {
          const { getNostrReadRelays } = await import('@/lib/connect/feed-settings');
          const relays = await getNostrReadRelays().catch(() => DEFAULT_NOTIFICATION_RELAYS);
          const activePool = poolRef.current || new NostrRelayPool(relays);
          if (!poolRef.current) {
            poolRef.current = activePool;
            activePool.connect();
          }
          const storedFollows = (await LocalEngine.cacheGet<string[]>('kylrix:follows')) || [];
          const followedPubkeys = storedFollows.filter((k) => /^[0-9a-f]{64}$/i.test(k));
          const tags = followedPubkeys.map((pk) => ['p', pk]);
          const { signEvent } = await import('@/lib/nostr/nostr');
          if (identity.privateKeyBytes) {
            const ev = signEvent(
              {
                kind: 3,
                pubkey: userPubkeyHex,
                created_at: Math.floor(Date.now() / 1000),
                tags,
                content: '',
              },
              identity.privateKeyBytes
            );
            await activePool.publish(ev);
          }
        } catch {}
      })();
    }
}
