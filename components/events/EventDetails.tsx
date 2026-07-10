'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Share2, Video, ExternalLink } from 'lucide-react';
import { formatTime } from '@/lib/time-util';
import { useLayout } from '@/context/LayoutContext';
import { exportToICS } from '@/lib/utils/export';
import { events as eventApi } from '@/lib/kylrixflow';
import { generateEventPattern } from '@/utils/patternGenerator';
import { Event as AppwriteEvent } from '@/types/kylrixflow';
import { Event as LocalEvent } from '@/types';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useSection } from '@/context/SectionContext';
import toast from 'react-hot-toast';

interface EventDetailsProps {
  eventId: string;
  initialData?: AppwriteEvent | LocalEvent | any;
  onBack?: () => void;
  onClose?: () => void;
}

export default function EventDetails({ eventId, initialData, onBack, onClose }: EventDetailsProps) {
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

  useEffect(() => {
    const fetchEvent = async () => {
      if (initialData) return;
      
      try {
        setLoading(true);
        const data = await eventApi.get(eventId);
        setEvent(data);
      } catch (_err: unknown) {
        console.error('Failed to fetch event details', _err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
        fetchEvent();
    }
  }, [eventId, initialData]);

  useEffect(() => {
    if (event) {
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
  const getId = (evt: any) => evt?.$id || evt?.id;
  const getCoverImage = (evt: any) => evt?.coverImageId || evt?.coverImage;
  const getVisibility = (evt: any) => evt?.visibility || (evt?.isPublic ? 'Public' : 'Private');
  const getMeetingUrl = (evt: any) => evt?.meetingUrl || evt?.url;

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

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const eventIdValue = getId(event);
  const coverImage = getCoverImage(event);
  const visibility = getVisibility(event);
  const meetingUrl = getMeetingUrl(event);
  
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
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
        {/* Header Title info */}
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#1C1A18] border border-[#34322F] text-white text-[11px] font-bold font-satoshi capitalize">
              {visibility}
            </span>
            {(event as any).status === 'cancelled' && (
              <span className="px-2.5 py-0.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] font-mono font-bold uppercase">
                Cancelled
              </span>
            )}
          </div>
          <h2 className="text-xl font-black font-clash text-white tracking-tight leading-snug">
            {event.title}
          </h2>
        </div>

        {/* Date & Time / Location (Card) */}
        <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col gap-4">
          {/* When */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">When</span>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-indigo-400 flex-shrink-0">
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">Where</span>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-indigo-400 flex-shrink-0">
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

        {/* Description */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase">About</span>
          <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] text-sm leading-relaxed text-[#C1BEBA] font-satoshi whitespace-pre-line break-words">
            {event.description || 'No description provided.'}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-[#34322F]">
          <a
            href={`/flow/events/${eventIdValue}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-sm text-center font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Event Page</span>
            <ExternalLink className="w-4 h-4" />
          </a>
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
              exportToICS(event.title, event.description || '', event.startTime, event.endTime);
              toast.success('Calendar event (.ics) downloaded!');
            }}
            className="w-full py-3 px-4 rounded-[14px] bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-[#F59E0B] text-white font-bold text-sm text-center font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#F59E0B]" />
            <span>Export Calendar Event (.ICS)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

