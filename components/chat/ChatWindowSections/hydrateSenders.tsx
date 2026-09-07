'use client';

import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useRouter, useSearchParams } from 'next/navigation';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {

export function hydrateSenders(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

            const missingIds = messageSenderIds.filter((senderId) => {
                const cached = senderProfiles[senderId] || getCachedIdentityById(senderId);
                const hasRenderableAvatar = Boolean(
                    senderProfiles[senderId]?.avatarUrl ||
                    (cached?.avatar && cached.avatar.startsWith?.('http'))
                );

                return !cached || !hasRenderableAvatar;
            });
            if (!missingIds.length) return;

            const resolved = await Promise.all(missingIds.map(async (senderId) => {
                try {
                    const profile = await UsersService.getProfileById(senderId);
                    if (!profile) return null;

                    let avatarUrl: string | null = null;
                    if (profile?.avatar?.startsWith?.('http')) {
                        avatarUrl = profile.avatar;
                    } else if (profile?.avatar) {
                        try {
                            const url = await fetchProfilePreview(profile.avatar, 48, 48);
                            avatarUrl = url as unknown as string;
                        } catch (_e) {}
                    }

                    const normalized = seedIdentityCache({ ...profile, avatar: profile?.avatar || avatarUrl });
                    if (!normalized) return null;

                    return {
                        senderId,
                        profile: {
                            displayName: normalized.displayName,
                            username: normalized.username,
                            avatar: normalized.avatar,
                            avatarUrl,
                            preferences: normalized.preferences} as SenderProfile};
                } catch (_e) {
                    return null;
                }
            }));

            if (cancelled) return;

            startTransition(() => {
                setSenderProfiles((prev) => {
                    const next = { ...prev };
                    resolved.forEach((entry) => {
                        if (entry?.profile) {
                            next[entry.senderId] = entry.profile;
                        }
                    });
                    return next;
                });
            });
}
