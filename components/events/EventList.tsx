'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { EventObjectRow } from './EventObjectRow';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { Event } from '@/types';
import { events as eventApi } from '@/lib/kylrixflow';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/context/auth/AuthContext';
import { permissions, EventVisibility } from '@/lib/permissions';
import { CallService } from '@/lib/services/call';
import toast from 'react-hot-toast';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useFAB } from '@/context/FABContext';
import EventDetails from './EventDetails';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';
import { useWorkspace } from '@/context/WorkspaceContext';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

function mapRemoteEvent(doc: any): Event {
  const start = doc.startTime ? new Date(doc.startTime) : new Date();
  const end = doc.endTime ? new Date(doc.endTime) : start;
  return {
    id: doc.$id || doc.id,
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
    isWorkspace: Boolean(doc.isWorkspace),
  } as Event;
}

export default function EventList() {
  const [tabValue, setTabValue] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { userId } = useTask();
  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { isAuthenticated, openIDMWindow } = useAuth();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { activeWorkspace } = useWorkspace();
  const [isDesktop, _setIsDesktop] = useState(true);
  const committedIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#6366F1',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => {
        if (!isAuthenticated) {
          openIDMWindow();
          return;
        }
        setIsDialogOpen(true);
      },
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, isAuthenticated, openIDMWindow]);

  useEffect(() => {
    let isCancelled = false;

    // Same path as UnifiedFileAttachmentDrawer events tab:
    // RxDB → LocalEngine `f_events_list` → events.list() live refresh.
    const loadEvents = async () => {
      try {
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB();
        let items: any[] = [];

        try {
          items = (await db.events.find().exec()).map((d: any) => d.toJSON());
        } catch {
          items = [];
        }
        if (items.length === 0) {
          items = (await LocalEngine.cacheGet<any[]>('f_events_list')) || [];
        }
        if (!isCancelled && items.length > 0) {
          setEvents(items.map(mapRemoteEvent));
          setIsLoading(false);
        }

        try {
          const res = await eventApi.list();
          items = res?.rows || (Array.isArray(res) ? res : []);
        } catch {
          // keep local rows — attach drawer uses the same fallback order
          if (items.length === 0) {
            try {
              items = (await db.events.find().exec()).map((d: any) => d.toJSON());
            } catch {
              items = [];
            }
            if (items.length === 0) {
              items = (await LocalEngine.cacheGet<any[]>('f_events_list')) || [];
            }
          }
        }

        if (isCancelled) return;
        if (items.length > 0) {
          setEvents(items.map(mapRemoteEvent));
          void LocalEngine.cacheSet('f_events_list', items);
        }
      } catch (error: unknown) {
        console.error('Failed to load events', error);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void loadEvents();
    return () => {
      isCancelled = true;
    };
  }, []);

  const upsertLocal = useCallback((event: Event) => {
    setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
  }, []);

  const handleCommitEvent = useCallback(
    async (eventData: Event & { visibility?: string; autoCreateCall?: boolean }) => {
      if (committedIdsRef.current.has(eventData.id)) return;
      committedIdsRef.current.add(eventData.id);

      try {
        const currentUserId = userId || 'guest';
        const visibility: EventVisibility =
          (eventData.visibility as EventVisibility) ||
          (eventData.isPublic ? 'public' : 'private');
        const eventPermissions = permissions.forVisibility(visibility, currentUserId);

        let meetingUrl = eventData.url || '';
        if (eventData.autoCreateCall && currentUserId !== 'guest') {
          try {
            const call = await CallService.createCallLink(
              currentUserId,
              'video',
              undefined,
              eventData.title,
              new Date(eventData.startTime).toISOString(),
              60,
            );
            meetingUrl = `/connect/call/${call.$id}`;
            toast.success('Call link scheduled');
          } catch (callErr) {
            console.error('Failed to create call link', callErr);
            toast.error('Call link failed — saving event anyway');
          }
        }

        const newDoc = await eventApi.create(
          {
            userId: currentUserId,
            calendarId: currentUserId,
            title: eventData.title,
            description: eventData.description || '',
            startTime: new Date(eventData.startTime).toISOString(),
            endTime: new Date(eventData.endTime).toISOString(),
            location: eventData.location || '',
            meetingUrl,
            visibility,
            status: 'confirmed',
            coverImageId: eventData.coverImage || '',
            recurrenceRule: '',
            isWorkspace: activeWorkspace?.isPersonal === false,
          } as any,
          eventPermissions,
        );

        const created = mapRemoteEvent(newDoc);
        // Replace ephemeral live id with remote id in the list
        setEvents((prev) => [
          created,
          ...prev.filter((e) => e.id !== eventData.id && e.id !== created.id),
        ]);
        autonomicSyncEngine.ack(`event:${eventData.id}`);
        autonomicSyncEngine.ack(`event:${created.id}`);

        const cacheKey = `f_user_events_${userId || 'guest'}`;
        try {
          const current = (await LocalEngine.cacheGet<any[]>(cacheKey)) || [];
          const next = [
            created,
            ...current.filter((e: any) => (e.id || e.$id) !== eventData.id && (e.id || e.$id) !== created.id),
          ];
          await LocalEngine.cacheSet(cacheKey, next);
          await LocalEngine.cacheSet('f_events_list', next);
        } catch {
          /* optional */
        }
      } catch (error: unknown) {
        console.error('Failed to create event', error);
        toast.error('Could not save event');
        committedIdsRef.current.delete(eventData.id);
      }
    },
    [activeWorkspace?.isPersonal, userId],
  );

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    let list = events;
    if (activeWorkspace?.isPersonal !== false) {
      list = list.filter((e) => isDefaultWorkspaceObject(e as any));
    }
    if (tabValue === 1) {
      list = list.filter((e) => {
        const t = new Date(e.startTime).getTime();
        return !Number.isNaN(t) && t < now;
      });
    } else if (tabValue === 2 && userId) {
      list = list.filter((e) => e.creatorId === userId);
    }
    // tab 0 = all (same rows attach-object shows), not an empty "upcoming-only" trap
    return list;
  }, [activeWorkspace?.isPersonal, events, tabValue, userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-screen">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId="event">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 p-1">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black font-clash text-white tracking-tight">Events</h1>
              {visibleEvents.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] text-[10px] font-black uppercase tracking-wider mt-1">
                  {visibleEvents.length} {visibleEvents.length === 1 ? 'Event' : 'Events'}
                </span>
              )}
            </div>
            <p className="text-[#8E8A86] font-semibold font-satoshi text-sm tracking-wide">
              Discover and manage your schedule
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 font-bold rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white font-satoshi transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
            onClick={() => {
              if (!isAuthenticated) {
                openIDMWindow();
                return;
              }
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
            <span>{isAuthenticated ? 'Create Event' : 'Sign in to Create'}</span>
          </button>
        </div>

        <div className="mb-8 bg-[#161412] rounded-[28px] p-1 border border-[#34322F] flex gap-1 w-fit">
          {['All', 'Past', ...(isAuthenticated ? ['My Events'] : [])].map((tab, idx) => {
            const isActive = tabValue === idx;
            return (
              <button
                key={tab}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setTabValue(idx);
                }}
                className={`rounded-full px-5 py-2 font-bold text-xs sm:text-sm font-satoshi transition-all cursor-pointer ${
                  isActive ? 'bg-[#1C1A18] text-white' : 'text-[#8E8A86] hover:text-white hover:bg-[#1C1A18]/50'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {visibleEvents.map((event) => (
            <div key={event.id}>
              <EventObjectRow
                event={event}
                onDelete={() =>
                  setEvents((prev) => prev.filter((e) => e.id !== event.id))
                }
                onClick={() => {
                  if (isDesktop) {
                    openSidebar(
                      <EventDetails eventId={event.id} initialData={event} />,
                      event.id,
                      { hideHeader: true },
                    );
                  } else {
                    openOverlay(
                      <EventDetails eventId={event.id} initialData={event} onBack={closeOverlay} />,
                    );
                  }
                }}
              />
            </div>
          ))}
        </div>

        <ObjectCreateDrawer
          open={isDialogOpen}
          kind="event"
          onClose={() => setIsDialogOpen(false)}
          onLiveEvent={upsertLocal}
          onCommitEvent={handleCommitEvent}
        />
      </MultiSectionContainer>
    </div>
  );
}
