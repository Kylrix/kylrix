'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Event } from '@/types';
import { events as eventApi } from '@/lib/kylrixflow';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { mergeServerPageWithLocalCopy } from '@/lib/sync/local-copy-sync';

function mapRemoteEvent(doc: any): Event {
  const start = doc.startTime ? new Date(doc.startTime) : new Date();
  const end = doc.endTime ? new Date(doc.endTime) : start;
  return {
    id: doc.$id || doc.id,
    $id: doc.$id || doc.id,
    title: doc.title,
    description: doc.description,
    startTime: Number.isNaN(start.getTime()) ? new Date() : start,
    endTime: Number.isNaN(end.getTime()) ? start : end,
    location: doc.location,
    url: doc.meetingUrl || doc.url || '',
    coverImage: doc.coverImageId || doc.coverImage || '',
    attendees: [],
    isPublic: doc.visibility === 'public' || Boolean(doc.isPublic),
    isPinned: Boolean(doc.isPinned),
    creatorId: doc.userId || doc.creatorId || '',
    createdAt: new Date(doc.$createdAt || doc.createdAt || Date.now()),
    updatedAt: new Date(doc.$updatedAt || doc.updatedAt || Date.now()),
    $createdAt: typeof doc.$createdAt === 'string' ? doc.$createdAt : new Date(doc.createdAt || Date.now()).toISOString(),
    $updatedAt: typeof doc.$updatedAt === 'string' ? doc.$updatedAt : new Date(doc.updatedAt || Date.now()).toISOString(),
    isWorkspace: Boolean(doc.isWorkspace),
  } as Event;
}

interface EventsContextType {
  events: Event[];
  isLoading: boolean;
  pushLiveEvent: (event: Event, options?: { pending?: boolean }) => void;
  removeEvent: (eventId: string) => void;
  refetchEvents: () => Promise<void>;
}

const EventsContext = createContext<EventsContextType>({
  events: [],
  isLoading: true,
  pushLiveEvent: () => {},
  removeEvent: () => {},
  refetchEvents: async () => {},
});

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      // 1. Instant 0ms local copy hydration
      let localItems: any[] = [];
      try {
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB();
        localItems = (await db.events.find().exec()).map((d: any) => d.toJSON());
      } catch {
        localItems = [];
      }

      if (localItems.length === 0) {
        localItems = (await LocalEngine.cacheGet<any[]>('f_events_list')) || [];
      }

      if (localItems.length > 0) {
        setEvents(localItems.map(mapRemoteEvent));
        setIsLoading(false);
      }

      // 2. Fetch remote and merge using timestamp comparison & pending guards
      let remoteItems: any[] = [];
      try {
        const res = await eventApi.list();
        remoteItems = res?.rows || (Array.isArray(res) ? res : []);
      } catch {
        /* keep local */
      }

      const mappedLocal = localItems.map(mapRemoteEvent);
      if (remoteItems.length > 0) {
        const mappedRemote = remoteItems.map(mapRemoteEvent);
        const merged = mergeServerPageWithLocalCopy<any>({
          serverBatch: mappedRemote,
          localNotes: mappedLocal,
        });
        setEvents(merged);
        void LocalEngine.cacheSet('f_events_list', merged);
      } else if (localItems.length > 0) {
        setEvents(mappedLocal);
        void LocalEngine.cacheSet('f_events_list', localItems);
      }
    } catch (err) {
      console.error('Failed to load events in EventsProvider:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const pushLiveEvent = useCallback((event: Event, options?: { pending?: boolean }) => {
    const eventId = event.id || (event as any).$id;
    if (!eventId) return;

    const normalized = mapRemoteEvent({
      ...event,
      updatedAt: new Date(),
      $updatedAt: new Date().toISOString(),
    });

    setEvents((prev) => {
      const nextList = [normalized, ...prev.filter((e) => (e.id || (e as any).$id) !== eventId)];
      void LocalEngine.cacheSet('f_events_list', nextList);
      return nextList;
    });

    const resourceId = `event:${eventId}`;
    if (options?.pending !== false) {
      autonomicSyncEngine.markPending(resourceId, new Date().toISOString(), normalized);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:event-updated', { detail: normalized }));
    }
  }, []);

  const removeEvent = useCallback((eventId: string) => {
    setEvents((prev) => {
      const nextList = prev.filter((e) => (e.id || (e as any).$id) !== eventId);
      void LocalEngine.cacheSet('f_events_list', nextList);
      return nextList;
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:event-deleted', { detail: { id: eventId } }));
    }
  }, []);

  return (
    <EventsContext.Provider
      value={{
        events,
        isLoading,
        pushLiveEvent,
        removeEvent,
        refetchEvents: loadEvents,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  return useContext(EventsContext);
}
