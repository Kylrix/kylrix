'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 

export function unpackNostrEvent(bag: any) {
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

  const isRepost = item.kind === 6;
  let targetId = item.id;
  let rawContent = item.content || '';
  let authorPubkey = item.pubkey;
  let createdAt = item.created_at;
  let reactionEmoji: string | undefined;
  let zapAmount: string | undefined;

  // Handle Reposts (NIP-18 kind 6)
  if (isRepost) {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          targetId = parsed.id || item.tags?.find(t => t[0] === 'e')?.[1] || item.id;
          rawContent = parsed.content || '';
          authorPubkey = parsed.pubkey || item.pubkey;
          if (parsed.created_at) createdAt = parsed.created_at;
        }
      } catch {}
    } else {
      const eTag = item.tags?.find(t => t[0] === 'e');
      if (eTag) targetId = eTag[1];
      const pTag = item.tags?.find(t => t[0] === 'p');
      if (pTag) authorPubkey = pTag[1];
    }
  }

  // Handle Reactions (kind 7)
  if (item.kind === 7) {
    reactionEmoji = rawContent && rawContent !== '+' ? rawContent : '❤️';
    const eTag = item.tags?.find(t => t[0] === 'e');
    if (eTag) targetId = eTag[1];
    rawContent = '';
  }

  // Handle Zaps (kind 9735)
  if (item.kind === 9735) {
    const eTag = item.tags?.find(t => t[0] === 'e');
    if (eTag) targetId = eTag[1];
    const descTag = item.tags?.find(t => t[0] === 'description');
    if (descTag?.[1]) {
      try {
        const descObj = JSON.parse(descTag[1]);
        if (descObj.content) rawContent = descObj.content;
      } catch {}
    }
  }

  // Fallback: If content is stringified JSON, unpack the text
  const trimmedFinal = rawContent.trim();
  if (trimmedFinal.startsWith('{') && trimmedFinal.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmedFinal);
      if (parsed.content) rawContent = parsed.content;
    } catch {}
  }

  const { text: cleanText, images } = extractPostImages(rawContent, item.tags);

  return {
    id: item.id,
    targetId: targetId || item.id,
    isRepost,
    repostAuthor: isRepost ? reposterName : undefined,
    authorPubkey,
    content: cleanText,
    createdAt,
    images,
    kind: item.kind,
    reactionEmoji,
    zapAmount,
  };
}
