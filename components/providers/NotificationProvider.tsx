"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { 
  realtime, 
  databases,
} from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'appwrite';
import { useAuth } from '@/lib/auth';

interface NotificationMetadata {
  read?: boolean;
  readAt?: string;
  originalDetails?: string | null;
}

interface ActivityLog {
  $id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  details: string | null;
}

interface NotificationContextType {
  notifications: ActivityLog[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const NOTIFICATION_CACHE_KEY = 'kylrix_notification_cache_v1';
const NOTIFICATION_CACHE_TTL = 1000 * 60 * 5;

type CachedNotifications = {
  logs: ActivityLog[];
  cachedAt: number;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const _APPWRITE_TABLE_ID_ACTIVITYLOG = "activityLog";

  const parseMetadata = (details: string | null): NotificationMetadata => {
    if (!details) return { read: false, originalDetails: null };
    try {
      if (details.startsWith('{')) {
        return JSON.parse(details);
      }
    } catch (_e: unknown) {}
    return { read: false, originalDetails: details };
  };

  const calculateUnread = useCallback((logs: ActivityLog[]) => {
    return logs.filter(log => !parseMetadata(log.details).read).length;
  }, []);

  const readCachedNotifications = useCallback((): CachedNotifications | null => {
    if (typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedNotifications;
      if (!Array.isArray(parsed?.logs)) return null;
      return { logs: parsed.logs, cachedAt: Number(parsed.cachedAt) || Date.now() };
    } catch {
      return null;
    }
  }, []);

  const saveCachedNotifications = useCallback((logs: ActivityLog[]) => {
    if (typeof window === 'undefined') return;

    try {
      const payload: CachedNotifications = { logs: logs.slice(0, 50), cachedAt: Date.now() };
      localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Best-effort only.
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user?.$id) return;

    const cached = readCachedNotifications();
    if (cached) {
      setNotifications(cached.logs);
      setUnreadCount(calculateUnread(cached.logs));
      setIsLoading(false);
      if (Date.now() - cached.cachedAt < NOTIFICATION_CACHE_TTL) {
        return;
      }
    } else {
      setIsLoading(true);
    }

    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASES.KYLRIXNOTE,
        APPWRITE_CONFIG.TABLES.KYLRIXNOTE.ACTIVITY_LOG,
        [Query.equal('userId', user.$id), Query.orderDesc('$createdAt'), Query.limit(50)]
      );
      const logs = res.documents as unknown as ActivityLog[];
      setNotifications(logs);
      setUnreadCount(calculateUnread(logs));
      saveCachedNotifications(logs);
    } catch (error: unknown) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.$id, calculateUnread, readCachedNotifications, saveCachedNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.$id) return;

    const channel = `databases.${APPWRITE_CONFIG.DATABASES.KYLRIXNOTE}.collections.${APPWRITE_CONFIG.TABLES.KYLRIXNOTE.ACTIVITY_LOG}.documents`;
    
    const unsub = realtime.subscribe(channel, (response) => {
      const payload = response.payload as ActivityLog;
      if (payload.userId !== user.$id) return;

      const isCreate = response.events.some(e => e.includes('.create'));
      const isUpdate = response.events.some(e => e.includes('.update'));

      if (isCreate) {
        setNotifications(prev => {
          const next = [payload, ...prev];
          saveCachedNotifications(next);
          return next;
        });
        if (!parseMetadata(payload.details).read) {
          setUnreadCount(prev => prev + 1);
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`Kylrix ${payload.targetType}`, { body: payload.action });
        }
        } else if (isUpdate) {
            setNotifications(prev => {
              const updated = prev.map(n => n.$id === payload.$id ? payload : n);
              setUnreadCount(calculateUnread(updated));
              saveCachedNotifications(updated);
              return updated;
            });
        }
    });

    return () => {
      if (typeof unsub === 'function') (unsub as any)();
      else (unsub as any).unsubscribe?.();
    };
  }, [user?.$id, calculateUnread, saveCachedNotifications]);

  const markAsRead = async (id: string) => {
    const notification = notifications.find(n => n.$id === id);
    if (!notification) return;

    const meta = parseMetadata(notification.details);
    if (meta.read) return;

    const newMetadata = { ...meta, read: true, readAt: new Date().toISOString() };

    try {
      setNotifications(prev => {
        const next = prev.map(n => n.$id === id ? { ...n, details: JSON.stringify(newMetadata) } : n);
        saveCachedNotifications(next);
        return next;
      });
      await databases.updateDocument(APPWRITE_CONFIG.DATABASES.KYLRIXNOTE, APPWRITE_CONFIG.TABLES.KYLRIXNOTE.ACTIVITY_LOG, id, {
        details: JSON.stringify(newMetadata)
      });
    } catch (error: unknown) {
      console.error('Cloud sync failed:', error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !parseMetadata(n.details).read);
    unread.forEach(n => markAsRead(n.$id));
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      isLoading, 
      markAsRead, 
      markAllAsRead 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
