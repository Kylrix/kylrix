'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 

export function loadNostrActivity(bag: any) {
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

      setLoadingPosts(true);
      try {
        let hex = resolvedPubkey;
        if (!hex && resolvedNpub) {
          try {
            hex = bytesToHex(npubToBytes(resolvedNpub));
          } catch {
            hex = null;
          }
        }

        if (!hex) {
          setLoadingPosts(false);
          return;
        }

        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cachedFeed = await LocalEngine.cacheGet<NostrEvent[]>(`nostr_profile_feed_${hex}`).catch(() => null);
        if (Array.isArray(cachedFeed) && cachedFeed.length > 0 && !cancelled) {
          setNostrPosts(cachedFeed);
          setLoadingPosts(false);
        }

        const readRelays = await getNostrReadRelays().catch(() => DEFAULT_RELAYS);
        const targets = readRelays.length ? readRelays : DEFAULT_RELAYS;
        pool = new NostrRelayPool(targets);
        await pool.connect();

        const fetchedEvents: NostrEvent[] = cachedFeed ? [...cachedFeed] : [];
        const authorsToFetch: string[] = [];

        pool.addListener((ev) => {
          if (cancelled) return;
          if (ev.kind === 0) {
            try {
              const meta = JSON.parse(ev.content);
              setNostrMeta({
                name: meta.name,
                displayName: meta.display_name || meta.name,
                about: meta.about,
                picture: meta.picture,
                nip05: meta.nip05,
                lud16: meta.lud16 || meta.lud06,
                banner: meta.banner,
                relaysCount: targets.length,
              });
              if (meta.picture && !resolvedAvatarUrl) {
                setResolvedAvatarUrl(meta.picture);
              }
            } catch {}
          } else if ([1, 6, 7, 9735].includes(ev.kind)) {
            if (!fetchedEvents.some(e => e.id === ev.id)) {
              fetchedEvents.push(ev);
              fetchedEvents.sort((a, b) => b.created_at - a.created_at);
              setNostrPosts([...fetchedEvents]);
              void LocalEngine.cacheSet(`nostr_profile_feed_${hex}`, fetchedEvents).catch(() => {});
              if (ev.pubkey) authorsToFetch.push(ev.pubkey);
            }
          }
        });

        pool.subscribe('profile-feed', [{ kinds: [1, 6, 7, 9735], authors: [hex], limit: 60 }]);
        pool.subscribe('profile-meta', [{ kinds: [0], authors: [hex], limit: 1 }]);

        if (authorsToFetch.length > 0) {
          void queueNostrProfileFetch(Array.from(new Set(authorsToFetch)));
        }
      } catch (err) {
        console.warn('[UnifiedProfile] Failed to fetch Nostr activity:', err);
      } finally {
        setTimeout(() => { if (!cancelled) setLoadingPosts(false); }, 1500);
      }
}
