'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import EventCard from './EventCard';
import EventDialog from './EventDialog';
import { Event } from '@/types';
import { events as eventApi } from '@/lib/kylrixflow';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/context/auth/AuthContext';
import { permissions, EventVisibility } from '@/lib/permissions';
import { CallService } from '@/lib/services/call';
import toast from 'react-hot-toast';
import { Query } from 'appwrite';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useFAB } from '@/context/FABContext';
import EventDetails from './EventDetails';

export default function EventList() {
  const [tabValue, setTabValue] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { projects, userId } = useTask();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { isAuthenticated, openIDMWindow } = useAuth();
  const { setConfiguration, resetConfiguration } = useFAB();

  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    // Configure FAB for this page
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
      actions: []
    });

    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, isAuthenticated]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        
        const queries: string[] = [];
        if (userId) {
          queries.push(Query.equal('userId', userId));
        } else if (!isAuthenticated) {
          queries.push(Query.equal('visibility', 'public'));
        }

        queries.push(Query.limit(100));
        queries.push(Query.select(['$id', 'title', 'description', 'startTime', 'endTime', 'location', 'visibility', 'status', 'coverImageId', 'userId', '$createdAt', '$updatedAt']));

        const list = await eventApi.list(queries);
        const mapped = list.rows.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          startTime: new Date(doc.startTime),
          endTime: new Date(doc.endTime),
          location: doc.location,
          url: doc.meetingUrl || '',
          coverImage: doc.coverImageId || '',
          attendees: [],
          isPublic: doc.visibility === 'public',
          isPinned: false,
          creatorId: doc.userId || '',
          createdAt: new Date(doc.$createdAt),
          updatedAt: new Date(doc.$updatedAt),
        }));
        setEvents(mapped);
      } catch (_error: unknown) {
        console.error('Failed to fetch events', _error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [userId, isAuthenticated]);

  const handleCreateEvent = async (eventData: any) => {
    try {
      // Use first project as calendar or default
      const calendarId = projects[0]?.id || 'default';
      const currentUserId = userId || 'guest';
      const visibility: EventVisibility = eventData.visibility || 'public';
      
      // Get appropriate permissions based on visibility
      const eventPermissions = permissions.forVisibility(visibility, currentUserId);
      
      let meetingUrl = eventData.url || '';

      // Auto-create call if requested
      if (eventData.autoCreateCall && currentUserId !== 'guest') {
        try {
          const call = await CallService.createCallLink(
            currentUserId,
            'video',
            undefined,
            eventData.title,
            eventData.startTime.toISOString(),
            60 // 1 hour duration
          );
          meetingUrl = `/connect/call/${call.$id}`;
          toast.success('Kylrix Connect call scheduled');
        } catch (callErr) {
          console.error('Failed to create call link', callErr);
          toast.error('Failed to create call link, but event will be created');
        }
      }

      const newDoc = await eventApi.create(
        {
          title: eventData.title,
          description: eventData.description || '',
          startTime: eventData.startTime.toISOString(),
          endTime: eventData.endTime.toISOString(),
          location: eventData.location || '',
          meetingUrl: meetingUrl,
          visibility: visibility,
          status: 'confirmed',
          coverImageId: eventData.coverImage || '',
          maxAttendees: 0,
          recurrenceRule: eventData.recurrenceRule || '',
          calendarId: calendarId,
          userId: currentUserId,
        },
        eventPermissions
      );

      const newEvent: Event = {
        id: newDoc.$id,
        title: newDoc.title,
        description: newDoc.description,
        startTime: new Date(newDoc.startTime),
        endTime: new Date(newDoc.endTime),
        location: newDoc.location,
        url: '',
        coverImage: '',
        attendees: [],
        isPublic: visibility === 'public',
        isPinned: false,
        creatorId: currentUserId,
        createdAt: new Date(newDoc.$createdAt),
        updatedAt: new Date(newDoc.$updatedAt),
      };

      setEvents([newEvent, ...events]);
      setIsDialogOpen(false);
      return newEvent;
    } catch (_error: unknown) {
      console.error('Failed to create event', _error);
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black min-h-screen p-4 md:p-8">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId="event">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 p-1">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black font-clash text-white tracking-tight">
                Events
              </h1>
              {events.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] text-[10px] font-black uppercase tracking-wider mt-1">
                  {events.length} {events.length === 1 ? 'Event' : 'Events'}
                </span>
              )}
            </div>
            <p className="text-[#8E8A86] font-semibold font-satoshi text-sm tracking-wide">
              Discover and manage your schedule
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 font-bold rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:text-white font-satoshi transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
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

        {/* Tab Selector */}
        <div className="mb-8 bg-[#161412] rounded-[28px] p-1 border border-[#34322F] flex gap-1 w-fit">
          {['Upcoming', 'Past', ...(isAuthenticated ? ['My Events'] : [])].map((tab, idx) => {
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
                  isActive 
                    ? 'bg-[#1C1A18] text-white' 
                    : 'text-[#8E8A86] hover:text-white hover:bg-[#1C1A18]/50'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {events.map((event) => (
            <div key={event.id}>
              <EventCard 
                event={event} 
                onDelete={() => {
                  setEvents(prev => prev.filter(e => e.id !== event.id));
                  closeSidebar();
                  closeOverlay();
                }}
                onClick={() => {
                  if (isDesktop) {
                    openSidebar(
                      <EventDetails eventId={event.id} initialData={event} />,
                      event.id,
                      { hideHeader: true }
                    );
                  } else {
                    openOverlay(
                      <EventDetails eventId={event.id} initialData={event} onBack={closeOverlay} />
                    );
                  }
                }} 
              />
            </div>
          ))}
        </div>

        {isDialogOpen && (
          <EventDialog
            open={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSubmit={handleCreateEvent}
          />
        )}
      </MultiSectionContainer>
    </div>
  );
}
