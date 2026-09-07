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

export function initRealtime(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

            unsub = await realtime.subscribe(
                [
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.rows`,
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`
                ],
                async (response) => {
                    const payload = response.payload as Partial<ChatReaction>;
                    if (payload?.conversationId !== conversationId) return;

                    if (response.events.some((event) => event.includes('.delete'))) {
                        if (!payload.messageId) return;
                        startTransition(() => {
                            setMessageReactions((prev) => {
                                const next = { ...prev };
                                const existing = next[payload.messageId || ''] || [];
                                const filtered = existing.filter((reaction) => reaction.$id !== payload.$id);
                                if (filtered.length) next[payload.messageId || ''] = filtered;
                                else delete next[payload.messageId || ''];
                                return next;
                            });
                        });
                        return;
                    }

                    if (!payload.messageId || !payload.$id) return;
                    startTransition(() => {
                        setMessageReactions((prev) => {
                            const next = { ...prev };
                            const existing = next[payload.messageId as string] || [];
                            const filtered = existing.filter((reaction) => reaction.$id !== payload.$id);
                            next[payload.messageId as string] = [...filtered, payload as ChatReaction];
                            return next;
                        });
                    });
                }
            );
}
