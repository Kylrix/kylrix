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
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS}.rows`,
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.rows`,
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGES}.documents`,
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS}.documents`,
                    `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS}.documents`,
                ],
                async (response) => {
                    const payload = response.payload as any;
                    const convTable = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
                    if (
                        payload &&
                        (payload.$id === conversationId || payload.id === conversationId) &&
                        response.events.some(
                            (event) =>
                                event.includes(convTable) ||
                                event.includes('conversations'),
                        )
                    ) {
                        startTransition(() => {
                            setConversation((prev: any) =>
                                applyDisplayName({ ...(prev || {}), ...payload }),
                            );
                        });
                        return;
                    }
                    // Handle Message Reactions realtime updates
                    if (payload?.conversationId === conversationId && (response.events.some(e => e.includes('message_reactions')) || payload.emoji)) {
                        void loadReactions();
                        return;
                    }
                    if (payload?.conversationId === conversationId) {
                        if (response.events.some(e => e.includes('.create')) || response.events.some(e => e.includes('.update'))) {
                            if (user && payload.senderId === user.$id && response.events.some(e => e.includes('.create'))) return;

                            const isEncrypted = ecosystemSecurity.status.isUnlocked && (
                                (payload.type === MessagesType.TEXT && payload.content && payload.content.length > 40)
                            );

                            if (isEncrypted) {
                                try {
                                    const decrypt = async (val: string) => {
                                        return await ecosystemSecurity.decrypt(val);
                                    };

                                    if (payload.type === MessagesType.TEXT && payload.content && payload.content.length > 40) {
                                        payload.content = await decrypt(payload.content);
                                    }
                                } catch (_e: unknown) { }
                            }

                            if (response.events.some(e => e.includes('.create'))) {
                                startTransition(() => {
                                    setMessages(prev => {
                                        const withoutOptimistic = prev.filter(m => {
                                            const isOptimistic = m.$id && String(m.$id).startsWith('optimistic-');
                                            if (isOptimistic) return m.content !== payload.content;
                                            return true;
                                        });
                                        if (withoutOptimistic.some(m => m.$id === payload.$id)) return withoutOptimistic;
                                        return [...withoutOptimistic, payload];
                                    });
                                });
                                setTimeout(() => scrollToBottom(), 100);
                            } else {
                                startTransition(() => {
                                    setMessages(prev => prev.map(m => m.$id === payload.$id ? payload : m));
                                });
                            }
                        } else if (response.events.some(e => e.includes('.delete'))) {
                            startTransition(() => {
                                setMessages(prev => prev.filter(m => m.$id === payload.$id));
                            });
                        }
                    }
                }
            );
}
