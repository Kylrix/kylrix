'use client';

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useAuth } from '@/lib/auth';
import { ChatService } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { getCachedIdentityById, seedIdentityCache } from '@/lib/identity-cache';
import { buildSafetyWarning, getVerificationState } from '@/lib/verification';

/**
 * framer-motion is heavy and is only needed when an island is being animated. Defer it
 * to a lazy chunk that loads on first chat event rather than on every authenticated
 * page paint.
 */
const ChatIslandPresence = dynamic(
  () => import('@/components/providers/ChatIslandPresence'),
  { ssr: false }
);

interface ChatNotification {
    id: string;
    senderName: string;
    content: string;
    avatar?: string;
    isEncrypted: boolean;
    type?: 'chat' | 'call';
    callId?: string;
}

interface ChatNotificationContextType {
    unreadConversations: Set<string>;
    lastMessage: any | null;
    scanComplete: boolean;
    markConversationRead: (conversationId: string) => void;
}

const ChatNotificationContext = createContext<ChatNotificationContextType | undefined>(undefined);

export function ChatNotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
    const [lastMessage, setLastMessage] = useState<any | null>(null);
    const [scanComplete, setScanComplete] = useState(false);
    const [activeNotification, setActiveNotification] = useState<ChatNotification | null>(null);
    const replyHistoryCache = useRef<Map<string, boolean>>(new Map());

    // Track session-level scan status locally
    const [hasCheckedSession, setHasCheckedSession] = useState(false);

    useEffect(() => {
        if (user?.$id && !hasCheckedSession) {
            if (sessionStorage.getItem(`chat_scan_${user.$id}`)) {
                setTimeout(() => setScanComplete(true), 0);
            }
            setTimeout(() => setHasCheckedSession(true), 0);
        }
    }, [user?.$id, hasCheckedSession]);

    useEffect(() => {
        replyHistoryCache.current = new Map();
    }, [user?.$id]);

    const showCallNotification = useCallback(async (signal: any, senderId: string) => {
        if (!user || senderId === user.$id) return;

        try {
            const cached = getCachedIdentityById(senderId);
            const profile = cached || await UsersService.getProfileById(senderId);
            if (profile) seedIdentityCache(profile);
            const senderName = (profile?.displayName || profile?.username) || signal.senderName || 'Guest';
            
            const notif: ChatNotification = {
                id: signal.callId || senderId,
                senderName: `Call Request: ${senderName}`,
                content: `Wants to join the session`,
                avatar: profile?.avatar || undefined,
                isEncrypted: false,
                type: 'call',
                callId: signal.callId
            };

            setActiveNotification(notif);

            setTimeout(() => {
                setActiveNotification(prev => prev?.id === notif.id ? null : prev);
            }, 8000);
        } catch (err) {
            console.warn('[ChatNotification] Failed to show call notification:', err);
        }
    }, [user]);

    const showDynamicIsland = useCallback(async (message: any) => {
        if (!user || message.senderId === user.$id) return;

        try {
            const cached = getCachedIdentityById(message.senderId);
            const profile = cached || await UsersService.getProfileById(message.senderId);
            if (profile) seedIdentityCache(profile);
            const senderName = (profile?.displayName || profile?.username) || 'Someone';
            const senderVerification = getVerificationState(profile?.preferences || null);
            let hasReplied = replyHistoryCache.current.get(message.conversationId);

            if (hasReplied === undefined) {
                try {
                    const conversation = await ChatService.getConversationById(message.conversationId, user.$id);
                    if (conversation?.type === 'direct') {
                        const history = await ChatService.getMessages(message.conversationId, 50, 0, user.$id, {
                            prefetchedConversation: conversation,
                        });
                        hasReplied = history.rows.some((row: any) => row.senderId === user.$id);
                    } else {
                        hasReplied = true;
                    }
                } catch {
                    hasReplied = true;
                }

                replyHistoryCache.current.set(message.conversationId, Boolean(hasReplied));
            }
            
            let content = message.content;
            const isEncrypted = message.content?.length > 40 && !message.content?.includes(' ');
            
            if (isEncrypted) {
                if (ecosystemSecurity.status.isUnlocked) {
                    const convKey = ecosystemSecurity.getConversationKey(message.conversationId);
                    try {
                        content = convKey 
                            ? await ecosystemSecurity.decryptWithKey(message.content, convKey)
                            : await ecosystemSecurity.decrypt(message.content);
                    } catch {
                        content = 'Encrypted message';
                    }
                } else {
                    content = 'Encrypted message';
                }
            }

            const shouldWarn = !senderVerification.verified && hasReplied === false;

            const notif: ChatNotification = {
                id: message.$id,
                senderName: shouldWarn ? `First message from ${senderName}` : senderName,
                content: shouldWarn ? buildSafetyWarning(senderName) : content,
                avatar: profile?.avatar || undefined,
                isEncrypted: isEncrypted && !ecosystemSecurity.status.isUnlocked,
                type: 'chat'
            };

            setActiveNotification(notif);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                setActiveNotification(prev => prev?.id === message.$id ? null : prev);
            }, 5000);
        } catch (err) {
            console.warn('[ChatNotification] Failed to show island:', err);
        }
    }, [user]);

    const performProactiveScan = useCallback(async () => {
        if (!user?.$id || scanComplete) return;

        console.log('[ChatNotification] Performing one-time proactive scan...');
        try {
            const res = await ChatService.getConversations(user.$id);
            if (!res || !res.rows) return;

            const unread = new Set<string>();
            
            res.rows.forEach((conv: any) => {
                if (conv.lastMessageAt && (!conv.lastReadAt || new Date(conv.lastMessageAt) > new Date(conv.lastReadAt))) {
                    if (conv.lastMessageSenderId !== user.$id) {
                        unread.add(conv.$id);
                    }
                }
            });

            setUnreadConversations(unread);
            setScanComplete(true);
            // Mark scan as done in session storage to prevent re-scans on navigation
            sessionStorage.setItem(`chat_scan_${user.$id}`, 'true');
        } catch (err) {
            console.warn('[ChatNotification] Proactive scan failed (expected if logged out or guest):', err);
        }
    }, [user, scanComplete]);

    const markConversationRead = useCallback((conversationId: string) => {
        if (!user?.$id) return;
        setUnreadConversations(prev => {
            if (!prev.has(conversationId)) return prev;
            const next = new Set(prev);
            next.delete(conversationId);
            return next;
        });
    }, [user?.$id]);

    // Effect to trigger proactive scan
    useEffect(() => {
        if (user?.$id && hasCheckedSession && !scanComplete) {
            if (!sessionStorage.getItem(`chat_scan_${user.$id}`)) {
                setTimeout(() => performProactiveScan(), 0);
            } else {
                setTimeout(() => setScanComplete(true), 0);
            }
        }
    }, [user?.$id, hasCheckedSession, scanComplete, performProactiveScan]);

    // Effect for Realtime Subscription
    useEffect(() => {
        if (!user?.$id) return;

        // 1. Subscribe to NEW messages across all conversations
        const chatChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${APPWRITE_CONFIG.COLLECTIONS.CHAT.MESSAGES}.documents`;
        
        const unsubChat = realtime.subscribe([chatChannel], (response) => {
            if (response.events.some(e => e.includes('.create'))) {
                const payload = response.payload;
                
                if (payload.senderId === user.$id) {
                    replyHistoryCache.current.set(payload.conversationId, true);
                    return;
                }

                if (payload.senderId !== user.$id) {
                    setLastMessage(payload);
                    setUnreadConversations(prev => new Set(prev).add(payload.conversationId));
                    showDynamicIsland(payload);
                }
            }
        });

        // 2. Subscribe to Call Signals via Activity Table
        const activityChannel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.${...}.documents`;

        const unsubActivity = realtime.subscribe([activityChannel], (response) => {
            if (response.events.some(e => e.includes('.update') || e.includes('.create'))) {
                const activity = response.payload;
                if (!activity.customStatus) return;

                try {
                    const signal = JSON.parse(activity.customStatus);
                    // Only notify for join_request signals targeting us
                    if (signal.target === user.$id && signal.type === 'join_request') {
                        if (Date.now() - signal.ts < 10000) {
                            showCallNotification(signal, activity.userId);
                        }
                    }
                } catch (e) {}
            }
        });

        return () => {
            if (typeof unsubChat === 'function') (unsubChat as any)();
            else (unsubChat as any)?.unsubscribe?.();

            if (typeof unsubActivity === 'function') (unsubActivity as any)();
            else (unsubActivity as any)?.unsubscribe?.();
        };
    }, [user?.$id, showDynamicIsland, showCallNotification]);

    const contextValue = useMemo<ChatNotificationContextType>(
        () => ({ unreadConversations, lastMessage, scanComplete, markConversationRead }),
        [unreadConversations, lastMessage, scanComplete, markConversationRead]
    );

    /**
     * Only mount the framer-motion-backed island once a chat event has fired in this
     * session. Idle authenticated routes pay zero motion bundle cost; the first
     * notification incurs a one-time lazy chunk fetch before its entrance animation.
     */
    const [hasEverShownIsland, setHasEverShownIsland] = useState(false);
    useEffect(() => {
        if (activeNotification && !hasEverShownIsland) setHasEverShownIsland(true);
    }, [activeNotification, hasEverShownIsland]);

    return (
        <ChatNotificationContext.Provider value={contextValue}>
            {children}
            {hasEverShownIsland ? (
                <ChatIslandPresence
                    notification={activeNotification}
                    onDismiss={() => setActiveNotification(null)}
                />
            ) : null}
        </ChatNotificationContext.Provider>
    );
}

export function useChatNotifications() {
    const context = useContext(ChatNotificationContext);
    if (context === undefined) {
        throw new Error('useChatNotifications must be used within a ChatNotificationProvider');
    }
    return context;
}
