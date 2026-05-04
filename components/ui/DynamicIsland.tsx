'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KylrixApp } from '@/lib/sdk';

export type IslandPanel = 'ecosystem' | 'profile' | 'search';
export type IslandType = 'success' | 'error' | 'warning' | 'info' | 'pro' | 'system' | 'suggestion' | 'connect';

export interface IslandNotification {
  id: string;
  type: IslandType;
  title: string;
  message?: string;
  app?: KylrixApp;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  majestic?: boolean;
  shape?: 'island' | 'ball' | 'pill';
  personal?: boolean;
  defaultExpanded?: boolean;
  timestamp?: number;
}

type IslandContextType = {
  showIsland: (notification: Omit<IslandNotification, 'id'>) => void;
  dismissIsland: (id: string) => void;
  allNotifications: IslandNotification[];
  activeNotification: IslandNotification | null;
  openPanel: (panel: IslandPanel) => void;
  closePanel: () => void;
  panel: IslandPanel | null;
  isActive: boolean;
};

const IslandContext = createContext<IslandContextType | undefined>(undefined);

export function useIsland() {
  const context = useContext(IslandContext);
  if (!context) {
    throw new Error('useIsland must be used within an IslandProvider');
  }
  return context;
}

export function IslandProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<IslandNotification[]>([]);
  const [allNotifications, setAllNotifications] = useState<IslandNotification[]>([]);
  const [panel, setPanel] = useState<IslandPanel | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());

  const activeNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  const dismissIsland = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showIsland = useCallback((notification: Omit<IslandNotification, 'id'>) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const next: IslandNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration: notification.duration || (notification.majestic ? 10000 : 6000),
    };

    setNotifications((current) => [...current, next]);
    setAllNotifications((current) => {
      const duplicate = current.some((entry) => entry.title === next.title && entry.message === next.message);
      return duplicate ? current : [next, ...current].slice(0, 50);
    });

    const timer = window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
      timersRef.current.delete(id);
    }, next.duration);

    timersRef.current.set(id, timer);
  }, []);

  const openPanel = useCallback((nextPanel: IslandPanel) => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);

  useEffect(() => {
    const handleExternalNotification = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<IslandNotification, 'id'>>;
      if (!customEvent.detail?.title) return;
      showIsland(customEvent.detail);
    };

    window.addEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
    return () => window.removeEventListener('kylrix:island-notification', handleExternalNotification as EventListener);
  }, [showIsland]);

  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      for (const timer of currentTimers.values()) {
        window.clearTimeout(timer);
      }
      currentTimers.clear();
    };
  }, []);

  const value = useMemo<IslandContextType>(() => ({
    showIsland,
    dismissIsland,
    allNotifications,
    activeNotification,
    openPanel,
    closePanel,
    panel,
    isActive: Boolean(panel || activeNotification),
  }), [activeNotification, allNotifications, closePanel, dismissIsland, openPanel, panel, showIsland]);

  return <IslandContext.Provider value={value}>{children}</IslandContext.Provider>;
}
