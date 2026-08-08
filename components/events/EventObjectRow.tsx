'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { MapPin, Clock, Pin, Edit, Trash2, Users, Bell } from 'lucide-react';
import type { Event } from '@/types';
import { formatTime } from '@/lib/time-util';
import { generateEventPattern } from '@/utils/patternGenerator';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { events as eventApi } from '@/lib/kylrixflow';
import { useEvents } from '@/context/EventsContext';
import toast from 'react-hot-toast';

type Props = {
  event: Event;
  onClick: () => void;
  onDelete?: () => void;
};

function dayLabel(date: Date): 'Today' | 'Tomorrow' | null {
  if (Number.isNaN(date.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(new Date());
  const target = startOf(date);
  if (target === today) return 'Today';
  if (target === today + 86_400_000) return 'Tomorrow';
  return null;
}

/** Event list tile — colorful cover pattern (or cover image) + date chrome. */
export function EventObjectRow({ event, onClick, onDelete }: Props) {
  const pattern = useMemo(
    () => generateEventPattern(event.id + (event.title || '')),
    [event.id, event.title],
  );
  const { user } = useAuth();
  const { removeEvent } = useEvents();
  const { open: openUnified } = useUnifiedDrawer();
  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;
  const { isPinned: isResourcePinned, togglePin } = useResourcePins();

  const [reminded, setReminded] = useState(Boolean((event as any).scheduled || (event as any).isReminded));
  const pinned = isResourcePinned('event', event.id, event.creatorId, event.isPinned);
  const isCreator =
    !!user && (event.creatorId === user.$id || (event as any).userId === user.$id);
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const label = dayLabel(start);
  const coverSrc = event.coverImage?.startsWith('http') ? event.coverImage : '';

  const handlePinToggle = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
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
      } catch (err) {
        console.error('Failed to toggle pin:', err);
      }
    },
    [event, togglePin],
  );

  const handleRemindToggle = useCallback(async () => {
    const next = !reminded;
    setReminded(next);
    toast.success(next ? 'Reminder set for event' : 'Reminder turned off');
  }, [reminded]);

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'event',
    resourceId: event.id,
    isPublic: !!event.isPublic,
    isGuest: !!event.isGuest,
    resourceTitle: event.title,
  });

  const contextMenuItems = useMemo(
    () => [
      {
        label: pinned ? 'Unpin' : 'Pin',
        icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />,
        onClick: () => void handlePinToggle(),
      },
      {
        label: reminded ? 'Stop Reminder' : 'Remind',
        icon: <Bell size={16} className={reminded ? 'text-[#F59E0B]' : ''} />,
        onClick: () => void handleRemindToggle(),
      },
      ...accessControlItems,
      ...(isCreator
        ? [
            {
              label: 'Edit Event',
              icon: <Edit size={16} />,
              onClick: () => onClick(),
            },
            {
              label: 'Delete',
              icon: <Trash2 size={16} className="text-red-500" />,
              variant: 'destructive' as const,
              onClick: () => {
                openUnified('delete-confirm', {
                  title: `Delete event: "${event.title || 'Untitled Event'}"?`,
                  description: 'This will permanently remove this event from your ecosystem.',
                  resourceName: 'this event',
                  confirmLabel: 'Delete Event',
                  onConfirm: async () => {
                    try {
                      await eventApi.delete(event.id);
                    } catch {
                      /* quiet for offline deletion */
                    }
                    removeEvent(event.id);
                    onDelete?.();
                    toast.success('Event deleted');
                  },
                });
              },
            },
          ]
        : []),
    ],
    [
      pinned,
      reminded,
      accessControlItems,
      isCreator,
      event,
      handlePinToggle,
      handleRemindToggle,
      onClick,
      onDelete,
      openUnified,
      removeEvent,
    ],
  );

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    if (!openMenu) return;
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    openMenu({
      x: clientX,
      y: clientY,
      items: contextMenuItems,
      appType: 'flow',
      title: event.title || 'Untitled Event',
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onContextMenu={handleContextMenu}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex flex-col bg-[#161412] hover:bg-[#1C1A18] border border-[#34322F] hover:border-[#22C55E]/55 rounded-[28px] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5)] h-full text-left min-w-[260px] sm:min-w-[280px]"
    >
      {/* Cover — image or deterministic colorful pattern */}
      <div className="relative overflow-hidden aspect-[16/9] w-full shrink-0">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full transition-transform duration-400 group-hover:scale-105"
            style={{ background: pattern }}
            aria-hidden
          />
        )}

        <div className="absolute top-3 left-3 bg-black/85 rounded-xl px-2.5 py-1.5 flex flex-col items-center min-w-[48px] border border-white/5">
          <span className="text-[10px] font-extrabold font-mono text-[#22C55E] uppercase tracking-wider leading-none mb-1">
            {formatTime(start, { month: 'short' })}
          </span>
          <span className="text-lg font-black font-clash text-white leading-none">
            {Number.isNaN(start.getTime()) ? '—' : start.getDate()}
          </span>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handlePinToggle}
            className={`p-1.5 rounded-lg bg-black/40 border border-white/10 transition-all duration-200 ${
              pinned ? 'text-[#F59E0B]' : 'text-white/40 hover:text-[#F59E0B]'
            }`}
          >
            <Pin size={14} className={pinned ? 'fill-[#F59E0B]' : ''} />
          </button>
          <div
            className="bg-black/40 border border-white/10 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareLockButton
              resourceType="event"
              resourceId={event.id}
              isPublic={!!event.isPublic}
              isGuest={!!event.isGuest}
              accentColor="#22C55E"
              onPublished={() => {}}
            />
          </div>
        </div>

        {label ? (
          <span
            className={`absolute bottom-3 left-3 text-[9px] font-black font-mono px-2 py-0.5 rounded-md border border-black/10 tracking-wider text-black ${
              label === 'Today' ? 'bg-[#10B981]' : 'bg-[#3B82F6]'
            }`}
          >
            {label.toUpperCase()}
          </span>
        ) : null}
      </div>

      <div className="flex-grow p-5 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 min-w-0 mb-2 overflow-hidden">
            <h2 className="text-base font-bold font-clash text-white tracking-tight leading-snug line-clamp-2 flex-1 min-w-0">
              {event.title || 'Untitled'}
            </h2>
            <SyncStatusDot resourceId={event.id} kind="event" row={event as unknown as Record<string, unknown>} />
          </div>
          <div className="flex items-center gap-2 text-[#9B9691] mb-1.5">
            <Clock size={14} className="shrink-0" />
            <span className="text-[11px] font-semibold font-satoshi">
              {formatTime(start, { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' – '}
              {formatTime(end, { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
          {event.location ? (
            <div className="flex items-center gap-2 text-[#9B9691]">
              <MapPin size={14} className="shrink-0" />
              <span className="text-[11px] font-semibold font-satoshi truncate">
                {event.location}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#34322F]/40 pt-3 mt-auto">
          {(event.attendees?.length ?? 0) > 0 ? (
            <div className="flex items-center gap-1.5 text-[#9B9691]">
              <Users size={14} />
              <span className="text-xs font-semibold font-satoshi">
                {event.attendees.length} going
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#9B9691]">
              <Users size={14} />
              <span className="text-xs font-semibold font-satoshi">No attendees</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
