'use client';

import {
  MapPin,
  Share2,
  Clock,
  Users,
  Edit,
  Trash2,
  Pin,
  Lock,
  Link as LinkIcon,
  MoreVertical
} from 'lucide-react';
import { Event } from '@/types';
import { formatTime, isToday, isTomorrow } from '@/lib/time-util';
import { generateEventPattern as generatePattern } from '@/utils/patternGenerator';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { events as eventApi } from '@/lib/kylrixflow';
import toast from 'react-hot-toast';

interface EventCardProps {
  event: Event;
  onClick: () => void;
  onDelete?: () => void;
}

export default function EventCard({ event, onClick, onDelete }: EventCardProps) {
  const pattern = generatePattern(event.id);
  const router = useRouter();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { openMenu } = useContextMenu();
  const { isPinned: isResourcePinned, togglePin } = useResourcePins();

  const isCreator = user && (event.creatorId === user.$id || (event as any).userId === user.$id);
  const pinned = isResourcePinned('event', event.id, event.creatorId, event.isPinned);

  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await togglePin({
        resourceType: 'event',
        resourceId: event.id,
        ownerId: event.creatorId || (event as any).userId,
        rowIsPinned: event.isPinned,
        setOwnerRowPin: async (nextPinned) => {
          await eventApi.update(event.id, { isPinned: nextPinned });
        },
      });
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'event',
    resourceId: event.id,
    isPublic: !!event.isPublic,
    isGuest: !!event.isGuest,
    resourceTitle: event.title,
    onUpdate: () => {
      // Re-render handled by parent/realtime
    }
  });

  const contextMenuItems = useMemo(() => [
    { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: handlePinToggle },
    ...accessControlItems,
    ...(isCreator ? [
      { label: 'Edit Event', icon: <Edit size={16} />, onClick: () => router.push(`/flow/events/${event.id}`) },
      { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => {
        openUnified('delete-confirm', {
          title: `Delete event: "${event.title}"?`,
          description: 'This will permanently remove this event from your ecosystem.',
          resourceName: 'this event',
          confirmLabel: 'Delete Event',
          onConfirm: async () => {
            await eventApi.delete(event.id);
            onDelete?.();
          }
        });
      }}
    ] : [])
  ], [pinned, accessControlItems, isCreator, event, router, openUnified, onDelete, handlePinToggle]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: contextMenuItems,
      appType: 'flow'
    });
  };

  const getDateLabel = () => {
    const date = new Date(event.startTime);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return null;
  };
  
  const dateLabel = getDateLabel();

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={onClick}
      className="group flex flex-col bg-[#161412] hover:bg-[#1C1A18] border border-[#34322F] hover:border-[#6366F1] rounded-[28px] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5)] h-full"
    >
      <div className="relative overflow-hidden aspect-[16/9] w-full shrink-0">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
          />
        ) : (
          <div 
            className="w-full h-full transition-transform duration-400 group-hover:scale-105"
            style={{ background: pattern }}
          />
        )}
        
        {/* Date badge */}
        <div className="absolute top-3 left-3 bg-black/85 rounded-xl px-2.5 py-1.5 flex flex-col items-center min-w-[48px] border border-white/5">
          <span className="text-[10px] font-extrabold font-mono text-[#6366F1] uppercase tracking-wider leading-none mb-1">
            {formatTime(new Date(event.startTime), { month: 'short' })}
          </span>
          <span className="text-lg font-black font-clash text-white leading-none">
            {new Date(event.startTime).getDate()}
          </span>
        </div>

        {/* Top Right Actions Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button
             onClick={handlePinToggle}
             className={`p-1.5 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 transition-all duration-200 ${pinned ? 'text-[#F59E0B]' : 'text-white/40 hover:text-[#F59E0B]'}`}
           >
             <Pin size={14} className={pinned ? 'fill-[#F59E0B]' : ''} />
           </button>
           <div className="backdrop-blur-md bg-black/40 border border-white/10 rounded-lg">
             <ShareLockButton 
                resourceType="event"
                resourceId={event.id}
                isPublic={!!event.isPublic}
                isGuest={!!event.isGuest}
                accentColor="#6366F1"
                onPublished={() => {}}
             />
           </div>
        </div>

        {/* Today/Tomorrow chip */}
        {dateLabel && (
          <span className={`absolute bottom-3 left-3 text-[9px] font-black font-mono px-2 py-0.5 rounded-md border border-black/10 tracking-wider text-black ${
            dateLabel === 'Today' ? 'bg-[#10B981]' : 'bg-[#3B82F6]'
          }`}>
            {dateLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-grow p-6 flex flex-col justify-between gap-4">
        <div>
          <h2 className="text-base font-bold font-clash text-white tracking-tight leading-snug line-clamp-2 mb-2">
            {event.title}
          </h2>
          <div className="flex items-center gap-2 text-[#9B9691] mb-1.5">
            <Clock size={14} className="shrink-0" />
            <span className="text-[11px] font-semibold font-satoshi">
              {formatTime(new Date(event.startTime), { hour: 'numeric', minute: '2-digit', hour12: true })} - {formatTime(new Date(event.endTime), { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-[#9B9691]">
              <MapPin size={14} className="shrink-0" />
              <span className="text-[11px] font-semibold font-satoshi truncate">
                {event.location}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#34322F]/30 pt-3 mt-auto">
          {event.attendees.length > 0 ? (
            <div className="flex -space-x-1.5 overflow-hidden">
              {event.attendees.slice(0, 4).map((id) => (
                <img
                  key={id}
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-[#34322F] bg-[#1C1A18] object-cover"
                  src={`https://i.pravatar.cc/150?u=${id}`}
                  alt="Attendee"
                />
              ))}
              {event.attendees.length > 4 && (
                <span className="flex items-center justify-center h-7 w-7 rounded-full ring-2 ring-[#34322F] bg-[#1C1A18] text-white font-mono text-[9px] font-bold">
                  +{event.attendees.length - 4}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#9B9691]">
              <Users size={14} />
              <span className="text-xs font-semibold font-satoshi">No attendees</span>
            </div>
          )}

          <div className="relative">
            <button 
              type="button" 
              onClick={handleMenuClick}
              className="p-1.5 text-[#9B9691] border border-[#34322F] bg-[#1C1A18] hover:text-white hover:bg-[#34322F] rounded-xl transition-colors cursor-pointer"
            >
              <MoreVertical size={16} strokeWidth={1.5} />
            </button>
            
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={handleMenuClose} />
                <div 
                  className="absolute right-0 bottom-full mb-1.5 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1.5 z-50 font-satoshi text-left cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleShareEvent}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white rounded-xl transition-colors font-semibold"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share Event</span>
                  </button>
                  {isCreator && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditEvent}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#9B9691] hover:bg-[#1C1A18] hover:text-white rounded-xl transition-colors font-semibold"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit Event</span>
                      </button>
                      <div className="my-1 border-t border-[#34322F]" />
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#D14343] hover:bg-red-500/5 rounded-xl transition-colors font-bold"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Event</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
