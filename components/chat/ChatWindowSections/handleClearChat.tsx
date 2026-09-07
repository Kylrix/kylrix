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

export function handleClearChat(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

        if (!conversationId) return;
        const currentUserId = user?.$id;
        if (!currentUserId) return;
        setClearOptionsOpen(false);
        setAnchorEl(null);

        const confirmData = {
            me: {
                title: 'Clear chat for yourself?',
                description: 'This will remove the chat history from your local view only. The other participant will still see the messages.',
                confirmLabel: 'Clear for Me'
            },
            everyone: {
                title: 'Clear chat for everyone?',
                description: 'This will remove your messages and reactions for everyone in this chat. This action is permanent.',
                confirmLabel: 'Wipe Footprint'
            },
            nuclear: {
                title: 'Permanently delete conversation for everyone?',
                description: 'Critical: This will permanently delete the conversation, members, encryption keys, messages and reactions for all participants. This cascade cannot be undone.',
                confirmLabel: 'Permanently delete'
            }
        }[mode];

        openUnified('delete-confirm', {
            ...confirmData,
            resourceName: 'this conversation',
            onConfirm: async () => {
                setLoading(true);
                try {
                    if (mode === 'me') {
                        await ChatService.clearChatForMe(conversationId, currentUserId);
                        toast.success("Chat cleared for you");
                    } else if (mode === 'everyone') {
                        const res = await ChatService.wipeMyFootprint(conversationId, currentUserId);
                        toast.success(`Removed ${res.count} messages and ${res.reactionsDeleted || 0} reactions for everyone`);
                    } else if (mode === 'nuclear') {
                        const wipeRes: any = await ChatService.nuclearWipe(conversationId);
                        const newId = wipeRes?.regeneratedConversationId;
                        if (newId) {
                          toast.success("Self-chat wiped & fresh room regenerated");
                          try {
                            const { LocalEngine } = await import('@/lib/services/LocalEngine');
                            const { chatConversationCacheKey, chatMessagesCacheKey } = await import('@/lib/chat/local-chat-cache');
                            await LocalEngine.cacheSet(chatConversationCacheKey(conversationId), null as any).catch(() => null);
                            await LocalEngine.cacheSet(chatMessagesCacheKey(conversationId), []).catch(() => null);
                          } catch {}
                          onBack?.();
                        } else {
                          toast.success("Conversation permanently wiped");
                          try {
                            const { LocalEngine } = await import('@/lib/services/LocalEngine');
                            const { chatConversationCacheKey, chatMessagesCacheKey } = await import('@/lib/chat/local-chat-cache');
                            await LocalEngine.cacheSet(chatConversationCacheKey(conversationId), null as any).catch(() => null);
                            await LocalEngine.cacheSet(chatMessagesCacheKey(conversationId), []).catch(() => null);
                          } catch {}
                          onBack?.();
                        }
                        return;
                    }
                    await loadMessages();
                } catch (error) {
                    console.error('Clear chat failed:', error);
                    toast.error("Failed to clear chat");
                } finally {
                    setLoading(false);
                }
            }
        });
}
