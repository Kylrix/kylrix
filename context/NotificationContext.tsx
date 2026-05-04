"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  realtime, 
  listActivityLogs, 
  updateDocument,
  APPWRITE_DATABASE_ID, 
  APPWRITE_TABLE_ID_ACTIVITYLOG 
} from '@/lib/appwrite';
import { useAuth } from '@/components/ui/AuthContext';
import type { ActivityLog } from '@/types/appwrite';

interface NotificationMetadata {
  read?: boolean;
  readAt?: string;
  originalDetails?: string | null;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: ActivityLog[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const parseMetadata = (details: string | null): NotificationMetadata => {
    if (!details) return { read: false, originalDetails: null };
    try {
      if (details.startsWith('{')) {
        return JSON.parse(details);
      }
    } catch (_err: any) {
      // Not JSON, treat as raw string
    }
    return { read: false, originalDetails: details };
  };

  const calculateUnread = useCallback((logs: ActivityLog[]) => {
    return logs.filter(log => !parseMetadata(log.details).read).length;
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user?.$id) return;
    
    setIsLoading(true);
    try {
      const res = await listActivityLogs();
      const logs = res.documents as unknown as ActivityLog[];
      setNotifications(logs);
      setUnreadCount(calculateUnread(logs));
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.$id, calculateUnread]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_TABLE_ID_ACTIVITYLOG}.documents`;
    
    const unsub = realtime.subscribe(channel, (response) => {
      const payload = response.payload as ActivityLog;
      if (payload.userId !== user.$id) return;

      const isCreate = response.events.some(e => e.includes('.create'));
      const isUpdate = response.events.some(e => e.includes('.update'));
      const isDelete = response.events.some(e => e.includes('.delete'));

      if (isCreate) {
        setNotifications(prev => [payload, ...prev]);
        if (!parseMetadata(payload.details).read) {
          setUnreadCount(prev => prev + 1);
        }
        
        if (Notification.permission === 'granted') {
          new Notification(`Kylrix ${payload.targetType}`, {
            body: payload.action,
            icon: '/logo/kylrixnote.png'
          });
        }
      } else if (isUpdate) {
        setNotifications(prev => {
          const updated = prev.map(n => n.$id === payload.$id ? payload : n);
          setUnreadCount(calculateUnread(updated));
          return updated;
        });
      } else if (isDelete) {
        setNotifications(prev => {
          const filtered = prev.filter(n => n.$id !== payload.$id);
          setUnreadCount(calculateUnread(filtered));
          return filtered;
        });
      }
    });

    return () => {
      if (typeof unsub === 'function') {
        (unsub as any)();
      } else if (unsub && typeof (unsub as any).unsubscribe === 'function') {
        (unsub as any).unsubscribe();
      }
    };
  }, [isAuthenticated, user?.$id, calculateUnread]);

  const markAsRead = async (id: string) => {
    const notification = notifications.find(n => n.$id === id);
    if (!notification) return;

    const meta = parseMetadata(notification.details);
    if (meta.read) return;

    const newMetadata: NotificationMetadata = {
      ...meta,
      read: true,
      readAt: new Date().toISOString()
    };

    try {
      // Pessimistic UI update for immediate feedback
      setNotifications(prev => prev.map(n => n.$id === id ? { ...n, details: JSON.stringify(newMetadata) } : n));
      
      await updateDocument(APPWRITE_TABLE_ID_ACTIVITYLOG, id, {
        details: JSON.stringify(newMetadata)
      });
    } catch (error: any) {
      console.error('Failed to sync read state to cloud:', error);
      // Revert on failure if necessary, or just rely on next fetch
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !parseMetadata(n.details).read);
    if (unreadNotifications.length === 0) return;

    // Update local state first for performance
    setNotifications(prev => prev.map(n => ({
      ...n,
      details: JSON.stringify({ ...parseMetadata(n.details), read: true, readAt: new Date().toISOString() })
    })));
    setUnreadCount(0);

    // Sync to cloud in background
    Promise.all(unreadNotifications.map(n => markAsRead(n.$id)))
      .catch (_err => console.error('Bulk mark as read failed:', _err));
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      isLoading, 
      markAsRead, 
      markAllAsRead,
      clearNotifications
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