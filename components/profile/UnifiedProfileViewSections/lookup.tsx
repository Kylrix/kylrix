'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 

export function lookup(bag: any) {
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

      try {
        const uid = targetUid;
        if (uid) {
          // Instant Identity cache hit
          const cachedIdentity = getCachedIdentityById(uid);
          if (cachedIdentity && !cancelled) {
            const storedNpub = (cachedIdentity as any).nostrNpub || (cachedIdentity as any).npub || (cachedIdentity.publicKey?.startsWith('npub') ? cachedIdentity.publicKey : undefined);
            const storedPubkey = (cachedIdentity as any).nostrPubkey || (cachedIdentity as any).pubkey || (cachedIdentity.publicKey && !cachedIdentity.publicKey.startsWith('npub') ? cachedIdentity.publicKey : undefined);
            if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
            if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
            setResolvedProfile(prev => ({
              ...prev,
              name: (prev.name || cachedIdentity.displayName || (cachedIdentity as any).name) || undefined,
              username: (prev.username || cachedIdentity.username) || undefined,
              avatar: (prev.avatar || cachedIdentity.avatar || (cachedIdentity as any).avatarUrl) || undefined,
              bio: (prev.bio || cachedIdentity.bio) || undefined,
              links: prev.links?.length ? prev.links : (cachedIdentity as any).links || [],
              createdAt: (prev.createdAt || (cachedIdentity as any).createdAt) || undefined,
            }));
          }

          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const localIdentity = await LocalEngine.cacheGet<any>(`identity:${uid}`).catch(() => null);
          if (localIdentity && !cancelled) {
            const storedNpub = localIdentity.nostrNpub || localIdentity.npub || (localIdentity.publicKey?.startsWith('npub') ? localIdentity.publicKey : undefined);
            const storedPubkey = localIdentity.nostrPubkey || localIdentity.pubkey || (localIdentity.publicKey && !localIdentity.publicKey.startsWith('npub') ? localIdentity.publicKey : undefined);
            if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
            if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
            setResolvedProfile(prev => ({
              name: prev.name || localIdentity.displayName || localIdentity.name,
              username: prev.username || localIdentity.username,
              avatar: prev.avatar || localIdentity.avatar || localIdentity.avatarUrl,
              bio: prev.bio || localIdentity.bio,
              links: prev.links?.length ? prev.links : localIdentity.links || [],
              createdAt: prev.createdAt || localIdentity.createdAt,
            }));
          }

          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfileById(uid).catch(() => null);
          if (cancelled || !prof) return;
          const storedNpub = (prof as any).nostrNpub || (prof as any).npub;
          const storedPubkey = (prof as any).nostrPubkey || (prof as any).pubkey;
          if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
          if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
          setResolvedProfile(prev => ({
            name: prev.name || prof.displayName || prof.name,
            username: prev.username || prof.username,
            avatar: prev.avatar || prof.avatar || prof.avatarUrl,
            bio: prev.bio || prof.bio,
            links: prev.links?.length ? prev.links : (prof as any).preferences?.links || (prof as any).links || [],
            createdAt: prev.createdAt || (prof as any).$createdAt,
          }));
        } else if (username && !resolvedPubkey && !resolvedNpub) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfile(username).catch(() => null);
          if (cancelled || !prof) return;
          const storedNpub = (prof as any).nostrNpub || (prof as any).npub;
          const storedPubkey = (prof as any).nostrPubkey || (prof as any).pubkey;
          if (storedNpub) setResolvedNpub(storedNpub);
          if (storedPubkey) setResolvedPubkey(storedPubkey);
          setResolvedProfile(prev => ({
            name: prev.name || prof.displayName || prof.name,
            username: prev.username || prof.username,
            avatar: prev.avatar || prof.avatar || prof.avatarUrl,
            bio: prev.bio || prof.bio,
            links: prev.links?.length ? prev.links : (prof as any).preferences?.links || (prof as any).links || [],
            createdAt: prev.createdAt || (prof as any).$createdAt,
          }));
        }
      } catch {}
}
