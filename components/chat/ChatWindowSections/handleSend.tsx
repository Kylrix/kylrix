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

export function handleSend(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

        if ((!text.trim() && !attachment && !pendingObject) || !user || sending) return false;

        // Ensure vault is unlocked before sending in an encrypted conversation
        if (conversation?.isEncrypted && !isUnlocked) {
            setUnlockModalOpen(true);
            return false;
        }

        const file = attachment;
        const objectAttach = pendingObject;
        const finalText = composeChatMessageText(text, objectAttach);
        const replyToId = replyingTo?.$id;
        const previousReplyingTo = replyingTo;

        setAttachment(null);
        setPendingObject(null);
        setReplyingTo(null);
        setSending(true);

        let type: any = MessagesType.TEXT;
        const initialAttachments: string[] = [];
        if (file) {
            if (file.type.startsWith('image/')) type = MessagesType.IMAGE;
            else if (file.type.startsWith('video/')) type = MessagesType.VIDEO;
            else if (file.type.startsWith('audio/')) type = MessagesType.AUDIO;
            else type = MessagesType.FILE;
        }

        // Optimistic UI Update: Add the plaintext message to the local state immediately
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMessage: any = {
            $id: optimisticId,
            conversationId,
            senderId: user.$id,
            content: finalText,
            type,
            attachments: initialAttachments,
            $createdAt: new Date().toISOString(),
            status: 'sending'
        };

        startTransition(() => {
            setMessages(prev => [...prev, optimisticMessage]);
        });
        setTimeout(() => scrollToBottom(), 50);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        try {
            const isThreadHangout = !!(conversation as any)?.isThreadFallback || (conversation as any)?.type === 'thread' || !!(conversation as any)?.isthreadChat || !!(conversation as any)?.isSelfBookmarks || (()=>{ try { const mem:any[]=(require('@/lib/chat/local-chat-cache') as any).peekThreadsListMemory?.()||[]; return !!mem.find((c:any)=>c.$id===conversationId||c.id===conversationId); } catch { return false; } })() || !conversation;
            if (isThreadHangout) {
                // Thread/discussion hangout — NOT conversations/messages table.
                // Underlying substrate is notes/idea → threads/thread_messages (canonical) with legacy comments fallback.
                // Mirrors project discussion: ensure thread then post (bottom-up: thread_messages, not conversations).
                let actualAttachments = initialAttachments;
                if (file) {
                    const bucketId = StorageService.getBucketForType(type);
                    const uploaded = await StorageService.uploadFile(file, bucketId);
                    actualAttachments = [uploaded.$id];
                }
                const { getOrCreateThread, postThreadMessage } = await import('@/lib/actions/client-ops');
                let threadId = conversationId;
                try {
                    const isSelfForSend = !!(conversation as any)?.isSelfBookmarks || (()=>{ try { const mem:any[]=(require('@/lib/chat/local-chat-cache') as any).peekThreadsListMemory?.()||[]; const hit=mem.find((c:any)=>c.$id===conversationId||c.id===conversationId); return !!hit?.isSelfBookmarks; } catch { return false; } })();
                    const parentKind: any = isSelfForSend ? 'user' : 'chat';
                    const parentId: any = isSelfForSend ? user.$id : conversationId;
                    const channel: any = isSelfForSend ? 'bookmarks' : 'general';
                    const ensured: any = await getOrCreateThread({
                        parentKind,
                        parentId,
                        channel,
                        title: (conversation as any)?.name || (conversation as any)?.title || (isSelfForSend ? 'Bookmarks' : 'Huddle'),
                        legacyNoteId: conversationId,
                    } as any);
                    threadId = ensured?.thread?.id || threadId;
                } catch {}
                const sent: any = await postThreadMessage({ threadId, content: finalText });
                const messageForState = {
                    $id: sent.id || sent.$id,
                    id: sent.id || sent.$id,
                    conversationId,
                    senderId: user.$id,
                    content: finalText,
                    type,
                    attachments: actualAttachments,
                    $createdAt: sent.createdAt || sent.$createdAt || new Date().toISOString(),
                    createdAt: sent.createdAt || sent.$createdAt || new Date().toISOString(),
                    status: 'sent',
                } as unknown as ChatMessage;
                startTransition(() => {
                    setMessages(prev => prev.map(m => m.$id === optimisticId ? messageForState : m));
                });
                // also persist to thread_messages cache if needed via loadMessages refresh
                void loadMessages();
                return true;
            }

            let actualAttachments = initialAttachments;
            if (file) {
                const bucketId = StorageService.getBucketForType(type);
                const uploaded = await StorageService.uploadFile(file, bucketId);
                actualAttachments = [uploaded.$id];
            }

            const sentMessage = await ChatService.sendMessage(conversationId, user.$id, finalText, type, actualAttachments, replyToId);

            // Replace optimistic message with the real one (green SyncStatusDot)
            const messageForState = {
                ...sentMessage,
                content: finalText,
                status: 'sent',
            } as unknown as ChatMessage;
            startTransition(() => {
                setMessages(prev => prev.map(m => m.$id === optimisticId ? messageForState : m));
            });
        } catch (error: unknown) {
            console.error('Failed to send message:', error);
            // Mark optimistic message as failed
            startTransition(() => {
                setMessages(prev => prev.map(m => m.$id === optimisticId ? ({ ...m, status: 'error' } as any) : m));
            });
            setAttachment(file);
            setPendingObject(objectAttach);
            setReplyingTo(previousReplyingTo);
            return false;
        } finally {
            setSending(false);
        }

        return true;
}
