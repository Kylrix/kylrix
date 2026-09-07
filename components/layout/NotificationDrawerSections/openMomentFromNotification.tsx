'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function openMomentFromNotification(bag: any) {
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

      const cleaned = String(rawId || '')
        .replace(/^\/moment\//, '')
        .split(/[?#]/)[0]
        .trim();
      if (!cleaned) return false;
      const { source, id } = parseMomentRouteId(cleaned);
      if (!id) return false;
      openMomentObjectDetail({
        momentId: id,
        source,
        preview: actor
          ? {
              authorName: actor.name,
              authorAvatar: actor.avatar,
            }
          : undefined,
        openSidebar,
        openOverlay,
        closeSidebar,
        closeOverlay,
      });
      return true;
}
