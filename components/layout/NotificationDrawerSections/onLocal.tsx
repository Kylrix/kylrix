'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function onLocal(bag: any) {
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
  onLocal,
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
}
