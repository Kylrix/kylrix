'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function isFollowingActor(bag: any) {
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

      if (!actor) return false;
      const keys = [
        actor.pubkey?.toLowerCase(),
        actor.npub?.toLowerCase(),
        actor.userId?.toLowerCase(),
        actor.username?.toLowerCase()?.replace(/^@/, ''),
      ].filter(Boolean) as string[];
      return keys.some((k) => followingKeys.has(k));
}
