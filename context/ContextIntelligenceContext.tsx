'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { calculateAdaptiveInterests } from '@/lib/ecosystem/intelligence-topics';
import { getConnectFeedSettings, setConnectFeedSettings } from '@/lib/connect/feed-settings';

interface InteractionRecord {
  topic: string;
  weight: number;
  timestamp: number;
}

interface ContextIntelligenceState {
  activeSessionId: string | null;
  trendingTopics: string[];
  recordInteraction: (topic: string, weight?: number) => void;
  syncCrossObjectContext: (objectKind: 'note' | 'goal' | 'event' | 'form' | 'chat', title?: string, tags?: string[]) => void;
}

const ContextIntelligenceContext = createContext<ContextIntelligenceState | undefined>(undefined);

const LOCAL_INTERACTIONS_KEY = 'kylrix_realtime_interactions_v1';
const LOCAL_SESSION_KEY = 'kylrix_feed_session_active_v1';

export function ContextIntelligenceProvider({ children }: { children: ReactNode }) {
  const { user: _user } = useAuth();
  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize or restore session
  useEffect(() => {
    void (async () => {
      const stored = await LocalEngine.cacheGet<string>(LOCAL_SESSION_KEY);
      if (stored) {
        setActiveSessionId(stored);
      } else {
        const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        setActiveSessionId(newId);
        await LocalEngine.cacheSet(LOCAL_SESSION_KEY, newId);
      }
    })();
  }, []);

  // Hydrate interactions history
  useEffect(() => {
    void (async () => {
      const stored = await LocalEngine.cacheGet<InteractionRecord[]>(LOCAL_INTERACTIONS_KEY);
      if (stored && Array.isArray(stored)) {
        const now = Date.now();
        // Prune older than 30 mins
        const fresh = stored.filter((i) => now - i.timestamp < 30 * 60 * 1000);
        setInteractions(fresh);
      }
    })();
  }, []);

  // High-velocity recording: updates in minutes
  const recordInteraction = useCallback((topic: string, weight: number = 1) => {
    const clean = topic.toLowerCase().replace(/^#/, '').trim();
    if (!clean || clean.length < 2) return;

    const newRecord: InteractionRecord = {
      topic: clean,
      weight,
      timestamp: Date.now(),
    };

    setInteractions((prev) => {
      const next = [newRecord, ...prev.slice(0, 100)];
      void LocalEngine.cacheSet(LOCAL_INTERACTIONS_KEY, next);
      return next;
    });

    // Schedule debounced drift calculation (applies within seconds/minutes of user activity)
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const settings = await getConnectFeedSettings();
        const nextInterests = calculateAdaptiveInterests(
          settings.topics || [],
          settings.interests || [],
          [newRecord, ...interactions]
        );

        if (nextInterests.join('|') !== settings.interests.join('|')) {
          await setConnectFeedSettings({ interests: nextInterests });
        }
      } catch (err) {
        console.warn('[ContextIntelligence] Adaptive drift sync error:', err);
      }
    }, 1200);
  }, [interactions]);

  // Interconnect across objects (notes, goals, tasks, forms)
  const syncCrossObjectContext = useCallback((objectKind: 'note' | 'goal' | 'event' | 'form' | 'chat', title?: string, tags?: string[]) => {
    if (tags && tags.length) {
      for (const t of tags.slice(0, 4)) {
        recordInteraction(t, 2);
      }
    }
    if (title) {
      const words = title.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      for (const w of words.slice(0, 3)) {
        recordInteraction(w, 1);
      }
    }
  }, [recordInteraction]);

  return (
    <ContextIntelligenceContext.Provider
      value={{
        activeSessionId,
        trendingTopics: Array.from(new Set(interactions.map((i) => i.topic))).slice(0, 10),
        recordInteraction,
        syncCrossObjectContext,
      }}
    >
      {children}
    </ContextIntelligenceContext.Provider>
  );
}

export function useContextIntelligence() {
  const context = useContext(ContextIntelligenceContext);
  if (!context) {
    return {
      activeSessionId: null,
      trendingTopics: [],
      recordInteraction: () => {},
      syncCrossObjectContext: () => {},
    };
  }
  return context;
}
