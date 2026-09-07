'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function renderCategoryIcon(bag: any) {
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
}
