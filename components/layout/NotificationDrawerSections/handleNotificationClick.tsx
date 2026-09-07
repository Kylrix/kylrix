'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function handleNotificationClick(bag: any) {
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

    const href = notif.actionHref ? sanitizeInAppHref(notif.actionHref) : '';
    if (href.startsWith('/moment/')) {
      openMomentFromNotification(href, notif.actor);
      return;
    }

    if (notif.id.includes('moment')) {
      const parts = notif.id.split('_');
      const momentId = parts[parts.length - 1];
      if (momentId && openMomentFromNotification(momentId, notif.actor)) {
        return;
      }
    }

    if (href) {
      router.push(href);
    }
}
