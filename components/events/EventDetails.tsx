'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, MapPin, Share2, Video, ExternalLink, Edit3, Globe, Lock, ChevronDown, Check, Users, UserCheck } from 'lucide-react';
import { formatTime } from '@/lib/time-util';
import { useLayout } from '@/context/LayoutContext';
import { exportToICS } from '@/lib/utils/export';
import { events as eventApi, eventGuests as guestApi } from '@/lib/kylrixflow';
import { generateEventPattern } from '@/utils/patternGenerator';
import { Event as AppwriteEvent } from '@/types/kylrixflow';
import { Event as LocalEvent } from '@/types';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useSection } from '@/context/SectionContext';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { EventDateTimePickerDrawer } from './drawers/EventDateTimePickerDrawer';
import { EventLocationDrawer } from './drawers/EventLocationDrawer';
import { EventVisibilityDrawer } from './drawers/EventVisibilityDrawer';
import { useAuth } from '@/context/auth/AuthContext';
import { Query } from 'appwrite';
import toast from 'react-hot-toast';

import { useEvents } from '@/context/EventsContext';

interface EventDetailsProps {
  eventId: string;
  initialData?: AppwriteEvent | LocalEvent | any;
  onBack?: () => void;
  onClose?: () => void;
  hideViewPageButton?: boolean;
}

function parseEventDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  const t = typeof val === 'number' ? val : Date.parse(String(val));
  return Number.isFinite(t) ? new Date(t) : new Date();
}

export default function EventDetails({ eventId, initialData, onBack, onClose, hideViewPageButton }: EventDetailsProps) {
  const { pushLiveEvent } = useEvents();
  const { closeSecondarySidebar } = useLayout();
  const { closeOverlay } = useOverlay();
  const { closeSidebar } = useDynamicSidebar();
  const { setActiveDetail } = useSection();
  
  const handleClose = () => {
    onBack?.();
    onClose?.();
    closeOverlay();
    closeSidebar();
    closeSecondarySidebar();
    setActiveDetail(null);
  };
  const [event, setEvent] = useState<AppwriteEvent | LocalEvent | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<any>(null);

  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

  // Drawer & Inline Editing State
  const [isDateTimeDrawerOpen, setIsDateTimeDrawerOpen] = useState(false);
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [isVisibilityDrawerOpen, setIsVisibilityDrawerOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutInput, setAboutInput] = useState('');

  useEffect(() => {
    if (!user || !eventId) return;
    const checkRegistration = async () => {
      try {
        const guests = await guestApi.list([
          Query.equal('eventId', eventId),
          Query.equal('userId', user.$id),
        ]);
        if (guests.total > 0) {
          setIsRegistered(true);
          setGuestId(guests.rows[0].$id);
        } else {
          setIsRegistered(false);
          setGuestId(null);
        }
      } catch {
        /* quiet */
      }
    };
    checkRegistration();
  }, [user, eventId]);

  useEffect(() => {
    if (!eventId) return;
    const fetchAttendees = async () => {
      try {
        const guests = await guestApi.list([Query.equal('eventId', eventId)]);
        setAttendees(guests.rows);
      } catch {
        /* quiet */
      }
    };
    fetchAttendees();
  }, [eventId, isRegistered]);

  useEffect(() => {
    let isMounted = true;
    const fetchEvent = async () => {
      let currentLocal: any = initialData;

      // 1. Try local copy first (0ms instantaneous load)
      if (!currentLocal && eventId) {
        try {
          const list = (await LocalEngine.cacheGet<any[]>('f_events_list')) || [];
          currentLocal = list.find((e: any) => (e.$id || e.id) === eventId);
          if (currentLocal && isMounted) {
            setEvent(currentLocal);
            setLoading(false);
          }
        } catch {
          /* quiet */
        }
      }

      if (!eventId) return;

      // 2. Fetch remote data and perform timestamp / pending merge
      try {
        const remoteData = await eventApi.get(eventId);
        if (remoteData && isMounted) {
          setEvent((prevLocal: any) => {
            if (!prevLocal) return remoteData;

            const resourceId = `event:${eventId}`;
            const isPending = autonomicSyncEngine.isPending(resourceId);
            if (isPending) {
              // Local copy has unflushed edits — local copy strictly wins!
              return prevLocal;
            }

            const parseTs = (val?: string | Date | null) => {
              if (!val) return 0;
              const t = typeof val === 'string' ? Date.parse(val) : val.getTime();
              return Number.isFinite(t) ? t : 0;
            };

            const localTime = Math.max(parseTs(prevLocal.updatedAt), parseTs(prevLocal.$updatedAt), parseTs(prevLocal.createdAt));
            const remoteTime = Math.max(parseTs(remoteData.updatedAt), parseTs(remoteData.$updatedAt), parseTs(remoteData.createdAt));

            // Timestamp comparison: newer wins!
            if (remoteTime > localTime) {
              return remoteData;
            }
            return prevLocal;
          });
        }
      } catch (_err: unknown) {
        console.error('Failed to fetch event details', _err);
        if (!currentLocal && isMounted) {
          setError('Failed to load event');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchEvent();
    return () => {
      isMounted = false;
    };
  }, [eventId, initialData]);

  useEffect(() => {
    if (event) {
      setTitleInput(event.title || '');
      setAboutInput(event.description || '');
      const fetchOrganizer = async () => {
        const userId = (event as any).userId || (event as any).creatorId;
        if (!userId) return;
        try {
          const { getGlobalProfileStatusSecure } = await import('@/lib/actions/secure-ops');
          const res = await getGlobalProfileStatusSecure(userId);
          if (res?.exists) {
            setOrganizer(res.profile);
          }
        } catch (err) {
          console.error('Failed to fetch organizer profile', err);
        }
      };
      fetchOrganizer();
    }
  }, [event]);

  // Helper to normalize event data access
  const getId = (evt: any) => evt?.$id || evt?.id || eventId;
  const getCoverImage = (evt: any) => evt?.coverImageId || evt?.coverImage;
  const getVisibility = (evt: any) => evt?.visibility || (evt?.isPublic !== false ? 'Public' : 'Private');
  const getMeetingUrl = (evt: any) => evt?.meetingUrl || evt?.url;

  const pushEventUpdate = useCallback(async (updatedFields: Record<string, any>) => {
    if (!event) return;
    const targetId = getId(event);
    const resourceId = `event:${targetId}`;

    const nextEvent: any = {
      ...event,
      ...updatedFields,
      updatedAt: new Date(),
    };

    setEvent(nextEvent);
    pushLiveEvent(nextEvent);

    try {
      await eventApi.update(targetId, updatedFields as any);
      autonomicSyncEngine.ack(resourceId);
    } catch (err) {
      console.error('Failed to sync event update remotely:', err);
    }
  }, [event, pushLiveEvent]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
    if (!user || !event) return;
    const targetId = getId(event);
    try {
      setRegistering(true);
      const newGuest = await guestApi.create({
        eventId: targetId,
        userId: user.$id,
        email: user.email,
        status: 'accepted',
        role: 'attendee',
      });
      setIsRegistered(true);
      setGuestId(newGuest.$id);
      const currentCount = Number((event as any).attendeeCount) || 0;
      void pushEventUpdate({ attendeeCount: currentCount + 1 });
      toast.success('Successfully registered for event!');
    } catch {
      toast.error('Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!guestId || !event) return;
    try {
      setRegistering(true);
      await guestApi.delete(guestId);
      setIsRegistered(false);
      setGuestId(null);
      const currentCount = Number((event as any).attendeeCount) || 1;
      void pushEventUpdate({ attendeeCount: Math.max(0, currentCount - 1) });
      toast.success('Registration cancelled');
    } catch {
      toast.error('Failed to cancel registration');
    } finally {
      setRegistering(false);
    }
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput.trim() !== event?.title) {
      void pushEventUpdate({ title: titleInput.trim() });
    }
  };

  const handleAboutSubmit = () => {
    setIsEditingAbout(false);
    if (aboutInput.trim() !== event?.description) {
      void pushEventUpdate({ description: aboutInput.trim() });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full bg-[#161412] min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6 text-center h-full flex flex-col justify-center items-center bg-[#161412] min-h-[400px]">
        <p className="text-[#8E8A86] text-sm font-semibold">{error || 'Event not found'}</p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 px-4 py-2 rounded-xl bg-[#1C1A18] border border-[#34322F] text-white hover:bg-[#242220] transition-all font-bold text-xs cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  const startDate = parseEventDate(event.startTime);
  const endDate = parseEventDate(event.endTime);
  const eventIdValue = getId(event);
  const coverImage = getCoverImage(event);
  const visibility = getVisibility(event);
  const meetingUrl = getMeetingUrl(event);
  const isPublic = (event as any).isPublic !== false && visibility !== 'Private';
  
  const coverStyle = coverImage
    ? { backgroundImage: `url(${coverImage})` }
    : { background: generateEventPattern(eventIdValue + event.title) };

  return (
    <div className="h-full flex flex-col bg-[#161412] text-white">
      {/* Header with Cover */}
      <div className="relative w-full h-[140px] flex-shrink-0">
        <div
          className="w-full h-full bg-cover bg-center"
          style={coverStyle}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#161412] to-transparent opacity-80" />
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-colors flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col gap-4 scrollbar-thin">
        {/* Header Title info */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setIsVisibilityDrawerOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-emerald-500/50 text-white text-[11px] font-bold font-satoshi capitalize transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isPublic ? <Globe className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-purple-400" />}
              <span>{visibility}</span>
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>
            {(event as any).status === 'cancelled' && (
              <span className="px-2.5 py-0.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] font-mono font-bold uppercase">
                Cancelled
              </span>
            )}
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                }}
                autoFocus
                className="w-full bg-black/60 text-white border border-emerald-500 rounded-xl px-3 py-1.5 text-xl font-black font-clash focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-2 rounded-xl bg-emerald-500 text-black font-bold shrink-0"
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-start justify-between gap-2 cursor-pointer rounded-xl p-1 -ml-1 hover:bg-white/[0.03] transition-all"
            >
              <h2 className="text-xl font-black font-clash text-white tracking-tight leading-snug">
                {event.title}
              </h2>
              <Edit3 className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 shrink-0">
            <SyncStatusDot resourceId={`event:${eventIdValue}`} />
            <SyncStatusLabel resourceId={`event:${eventIdValue}`} />
          </div>
        </div>

        {/* Seamless RSVP Registration Banner */}
        <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#6366F1] shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white leading-tight truncate">
                {isRegistered ? 'You are attending this event!' : 'RSVP to confirm attendance'}
              </span>
              <span className="text-[10px] text-[#8E8A86] font-mono mt-0.5">
                {(event as any).attendeeCount || attendees.length} confirmed {((event as any).attendeeCount || attendees.length) === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={isRegistered ? handleCancelRegistration : handleRegister}
            disabled={registering}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold transition-all cursor-pointer shrink-0 shadow-md ${
              isRegistered
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
            }`}
          >
            {registering ? '...' : isRegistered ? 'Cancel RSVP' : 'Register'}
          </button>
        </div>

        {/* Date & Time / Location (Card) */}
        <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col gap-4">
          {/* When */}
          <div 
            onClick={() => setIsDateTimeDrawerOpen(true)}
            className="flex flex-col gap-1.5 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/10"
          >
            <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">When</span>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/40 transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white leading-tight">
                  {formatTime(startDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-xs text-[#8E8A86] mt-0.5 flex items-center gap-1 font-satoshi">
                  <Clock className="w-3 h-3 text-[#8E8A86]" />
                  {formatTime(startDate, { hour: 'numeric', minute: '2-digit', hour12: true })} - {formatTime(endDate, { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/[0.04] w-full" />

          {/* Where */}
          <div 
            onClick={() => setIsLocationDrawerOpen(true)}
            className="flex flex-col gap-1.5 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/10"
          >
            <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-400 uppercase">Where</span>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-emerald-400 flex-shrink-0 group-hover:border-emerald-500/40 transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-white leading-relaxed break-words">
                  {event.location || 'Online Event'}
                </span>
                {meetingUrl && (
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-bold font-satoshi text-white bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-[#6366F1] rounded-[8px] transition-all w-fit cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>Join Meeting</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Organizer */}
        {((event as any).userId || (event as any).creatorId) && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase">Organizer</span>
            <div className="p-3 rounded-[20px] bg-[#0A0908] border border-white/[0.04] flex items-center gap-3">
              <IdentityAvatar 
                userId={(event as any).userId || (event as any).creatorId} 
                size={36} 
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate">
                  {organizer?.displayName || organizer?.username || 'Organizer'}
                </span>
                {organizer?.username && (
                  <span className="text-[10px] text-[#8E8A86] truncate">
                    @{organizer.username.replace(/^@/, '')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description / About */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase">About</span>
          <div className="flex items-center justify-between">
            {!isEditingAbout && (
              <button
                type="button"
                onClick={() => setIsEditingAbout(true)}
                className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
          </div>

          {isEditingAbout ? (
            <div className="flex flex-col gap-2">
              <textarea
                rows={4}
                value={aboutInput}
                onChange={(e) => setAboutInput(e.target.value)}
                autoFocus
                className="w-full p-3 rounded-2xl bg-black/60 border border-emerald-500 text-sm leading-relaxed text-[#C1BEBA] font-satoshi focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingAbout(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 text-white/70 text-xs font-bold font-mono"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAboutSubmit}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs font-mono flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  <span>Save About</span>
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingAbout(true)}
              className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] hover:border-white/10 transition-all text-sm leading-relaxed text-[#C1BEBA] font-satoshi whitespace-pre-line break-words cursor-pointer"
            >
              {event.description || 'No description provided. Click to add details.'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-[#34322F]">
          {!hideViewPageButton && (
            <a
              href={`/events/${eventIdValue}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-sm text-center font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Event Page</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/events/${eventIdValue}`);
              toast.success('Event link copied!');
            }}
            className="w-full py-3 px-4 rounded-[14px] bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-[#6366F1] text-white font-bold text-sm text-center font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Copy Link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportToICS(
                event.title,
                event.description || '',
                typeof event.startTime === 'string' ? event.startTime : event.startTime?.toISOString() || '',
                typeof event.endTime === 'string' ? event.endTime : event.endTime?.toISOString() || ''
              );
              toast.success('Calendar event (.ics) downloaded!');
            }}
            className="w-full py-3 px-4 rounded-[14px] bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-[#F59E0B] text-white font-bold text-sm text-center font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#F59E0B]" />
            <span>Export Calendar Event (.ICS)</span>
          </button>
        </div>
      </div>

      {/* Drawers */}
      <EventDateTimePickerDrawer
        open={isDateTimeDrawerOpen}
        onClose={() => setIsDateTimeDrawerOpen(false)}
        startTime={startDate}
        endTime={endDate}
        onApply={(newStart, newEnd) => {
          void pushEventUpdate({
            startTime: newStart,
            endTime: newEnd,
          });
          toast.success('Event schedule updated!');
        }}
      />

      <EventLocationDrawer
        open={isLocationDrawerOpen}
        onClose={() => setIsLocationDrawerOpen(false)}
        location={event.location || ''}
        meetingUrl={meetingUrl || ''}
        eventTitle={event.title}
        onApply={(newLoc, newUrl) => {
          void pushEventUpdate({
            location: newLoc,
            meetingUrl: newUrl,
            url: newUrl,
          });
          toast.success('Location & meeting link updated!');
        }}
      />

      <EventVisibilityDrawer
        open={isVisibilityDrawerOpen}
        onClose={() => setIsVisibilityDrawerOpen(false)}
        isPublic={isPublic}
        onApply={(nextIsPublic) => {
          void pushEventUpdate({
            isPublic: nextIsPublic,
            isGuest: nextIsPublic,
            visibility: nextIsPublic ? 'Public' : 'Private',
          });
          toast.success(nextIsPublic ? 'Event is now Public' : 'Event is now Private');
        }}
      />
    </div>
  );
}

