'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 

export function loadStats(bag: any) {
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

      // Kylrix stats
      if (targetUid) {
        try {
          const { SocialService } = await import('@/lib/services/social');
          const [followers, following] = await Promise.all([
            SocialService.getFollowers(targetUid).catch(() => []),
            SocialService.getFollowing(targetUid).catch(() => []),
          ]);
          if (!cancelled) {
            setKylrixFollowersCount(Array.isArray(followers) ? followers.length : 0);
            setKylrixFollowingCount(Array.isArray(following) ? following.length : 0);
          }
        } catch {}
      }

      // Nostr stats
      const hex = resolvedPubkey;
      if (hex) {
        try {
          const [nFollowers, nFollowing] = await Promise.all([
            fetchNostrFollowers(hex, 3500).catch(() => []),
            fetchNostrFollowing(hex, 3500).catch(() => []),
          ]);
          if (!cancelled) {
            setNostrFollowersCount(nFollowers.length);
            setNostrFollowingCount(nFollowing.length);
          }
        } catch {}
      }
}
