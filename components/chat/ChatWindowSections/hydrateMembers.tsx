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

export function hydrateMembers(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

            const resolved = await Promise.all(missingIds.map(async (participantId) => {
                try {
                    const profile = await UsersService.getProfileById(participantId);
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
                        participantId,
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
            startTransition(() => {
                setSenderProfiles((prev) => {
                    const next = { ...prev };
                    resolved.forEach((entry) => {
                        if (entry?.profile) {
                            next[entry.participantId] = entry.profile;
                        }
                    });
                    return next;
                });
            });
            });
}
