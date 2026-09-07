'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {

export function handleNostrEvent(bag: any) {
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

            if (!event || !event.id) return;
            const ts = (event.created_at || Date.now() / 1000) * 1000;
            const timeStr = formatTimeAgo(ts);
            const cachedAuthor = getCachedNostrProfile(event.pubkey);
            const authorDisplayName = cachedAuthor?.name || cachedAuthor?.displayName || `npub…${event.pubkey.slice(-6)}`;
            let npubStr: string | undefined;
            try {
              npubStr = bytesToNpub(hexToBytes(event.pubkey));
            } catch {}

            const actorMetadata = {
              name: authorDisplayName,
              username: cachedAuthor?.nip05 || (cachedAuthor?.name ? `@${cachedAuthor.name}` : undefined),
              avatar: cachedAuthor?.picture,
              isNostr: true,
              npub: npubStr,
              pubkey: event.pubkey,
            };

            authorsToFetch.push(event.pubkey);

            if (event.kind === 1) {
              const notifId = `nostr_reply_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'replies',
                title: `${authorDisplayName} replied to your post`,
                message: (event.content || '').slice(0, 140),
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#8B5CF6',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 3) {
              const notifId = `nostr_follow_${event.pubkey}`;
              itemsMap.set(notifId, {
                id: notifId,
                category: 'follows',
                title: `${authorDisplayName} followed you`,
                message: `Started following your Nostr profile.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#3B82F6',
                actionHref: `/connect`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 7) {
              const notifId = `nostr_like_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;
              const emoji = event.content && event.content !== '+' ? event.content : '❤️';

              itemsMap.set(notifId, {
                id: notifId,
                category: 'likes',
                title: `${authorDisplayName} reacted ${emoji}`,
                message: `Liked your Nostr note.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#EC4899',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 6) {
              const notifId = `nostr_repost_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : event.id;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'replies',
                title: `${authorDisplayName} boosted your post`,
                message: `Shared your Nostr note with their followers.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#10B981',
                actionHref: `/moment/nostr_${targetId}`,
                actor: actorMetadata,
                source: 'nostr',
              });
            } else if (event.kind === 9735) {
              const notifId = `nostr_zap_${event.id}`;
              const targetNoteTag = event.tags?.find((t) => t[0] === 'e');
              const targetId = targetNoteTag ? targetNoteTag[1] : undefined;

              itemsMap.set(notifId, {
                id: notifId,
                category: 'zaps',
                title: `⚡ Lightning Zap received!`,
                message: `${authorDisplayName} sent you a Lightning Zap on Nostr.`,
                time: timeStr,
                timestamp: ts,
                read: false,
                accent: '#F59E0B',
                actionHref: targetId ? `/moment/nostr_${targetId}` : `/connect`,
                actor: actorMetadata,
                source: 'nostr',
              });
            }
}
