'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 

export function resolveAvatar(bag: any) {
  const {
  activeBio,
  activeDisplayName,
  activeHandle,
  activeTab,
  badges,
  copiedKey,
  copyToClipboard,
  currentUserId,
  day,
  diff,
  engagement,
  handleToggleFollow,
  hr,
  isEditModalOpen,
  isFollowing,
  isNostrMode,
  isOwnCheck,
  isOwnProfile,
  isRepost,
  kylrixFollowersCount,
  kylrixFollowingCount,
  loadNostrActivity,
  loadStats,
  loadingPosts,
  lookup,
  min,
  nostrFollowersCount,
  nostrFollowingCount,
  nostrMeta,
  nostrPosts,
  parentEvents,
  rawUsername,
  resolveAvatar,
  resolvedAvatarUrl,
  resolvedNpub,
  resolvedProfile,
  resolvedPubkey,
  router,
  sec,
  setActiveTab,
  setBadges,
  setCopiedKey,
  setEngagement,
  setIsEditModalOpen,
  setIsFollowing,
  setKylrixFollowersCount,
  setKylrixFollowingCount,
  setLoadingPosts,
  setNostrFollowersCount,
  setNostrFollowingCount,
  setNostrMeta,
  setNostrPosts,
  setParentEvents,
  setResolvedAvatarUrl,
  setResolvedNpub,
  setResolvedProfile,
  setResolvedPubkey,
  setViewMode,
  targetUid,
  timeMs,
  totalFollowers,
  totalFollowing,
  trimmedFinal,
  unpackNostrEvent,
  unpackedLikes,
  unpackedPosts,
  unpackedReplies,
  unpackedZaps,
  viewMode
  } = bag as any;

      const raw = resolvedProfile.avatar || (isOwnProfile ? (user?.prefs?.avatar || user?.prefs?.profilePicId) : null);
      if (!raw) {
        if (targetUid) {
          const cachedPreview = getCachedProfilePreview(targetUid);
          if (cachedPreview && !cancelled) {
            setResolvedAvatarUrl(cachedPreview);
            return;
          }
        }
        if (nostrMeta.picture && !cancelled) {
          setResolvedAvatarUrl(nostrMeta.picture);
        }
        return;
      }

      if (raw.startsWith('http')) {
        if (!cancelled) setResolvedAvatarUrl(raw);
        return;
      }

      // It's a file ID — load from cache or fetch preview
      const cached = getCachedProfilePreview(raw);
      if (cached && !cancelled) {
        setResolvedAvatarUrl(cached);
        return;
      }

      try {
        const url = await fetchProfilePreview(raw, 160, 160);
        if (!cancelled && typeof url === 'string') {
          setResolvedAvatarUrl(url);
        }
      } catch {}
}
