'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { Calendar, Check, ChevronDown, ChevronUp, MapPin, Video } from 'lucide-react';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { useAuth } from '@/lib/auth';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { addHours } from '@/lib/time-util';
import type { Event } from '@/types';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { useEvents } from '@/context/EventsContext';

type Props = {
  onClose?: () => void;
  onRegisterClose?: (close: (() => void) | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Instant local-copy upsert while typing. */
  onLiveEvent?: (event: Event & { visibility?: string; autoCreateCall?: boolean }) => void;
  /** Fired once on Check/Enter close when the draft has content. */
  onCommitEvent?: (event: Event & { visibility?: string; autoCreateCall?: boolean }) => void | Promise<void>;
  onEventCreated?: (event: Event) => void;
  onCancel?: () => void;
  initialData?: any;
};

function toLocalInputValue(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Event create composer — idea-style seamless content + live local copy.
 * Persist remote on close via parent `onEventCreated` / EventList handler.
 */
import { EventDateTimePickerDrawer } from '@/components/events/drawers/EventDateTimePickerDrawer';

export function CreateEventComposer({
  onClose,
  onRegisterClose,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onEventCreated,
  onLiveEvent,
  onCommitEvent,
  onCancel: _onCancel,
  initialData: _initialData,
}: Props) {
  const { user } = useAuth();
  const { pushLiveEvent } = useEvents();
  const ownerId = user?.$id || 'guest';
  const cacheKey = 'f_events_list';

  const [isDateDrawerOpen, setIsDateDrawerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [startTime, setStartTime] = useState(() => toLocalInputValue(new Date()));
  const [endTime, setEndTime] = useState(() => toLocalInputValue(addHours(new Date(), 1)));
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [autoCreateCall, setAutoCreateCall] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | undefined>();
  const [localExpanded, setLocalExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalExpanded((v) => !v));
  const liveIdRef = useRef<string | undefined>(undefined);
  const announcedRef = useRef(false);
  const isPastedRef = useRef(false);
  const pasteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMetaRef = useRef({
    startTime,
    endTime,
    location,
    visibility,
    autoCreateCall,
  });

  useEffect(() => {
    pendingMetaRef.current = { startTime, endTime, location, visibility, autoCreateCall };
  }, [autoCreateCall, endTime, location, startTime, visibility]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('kylrix:draft:event');
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.content) setContent(draft.content);
        if (draft.title) {
          setTitle(draft.title);
          setIsTitleManuallyEdited(true);
        }
        if (draft.startTime) setStartTime(draft.startTime);
        if (draft.endTime) setEndTime(draft.endTime);
        if (draft.location) setLocation(draft.location);
        if (draft.visibility) setVisibility(draft.visibility);
        if (draft.autoCreateCall !== undefined) setAutoCreateCall(draft.autoCreateCall);
        if (draft.id) {
          setResolvedId(draft.id);
          liveIdRef.current = draft.id;
        }
      }
    } catch {
      /* quiet */
    }
  }, []);

  useEffect(() => {
    if (!content.trim() && !title.trim()) return;
    const draft = {
      id: liveIdRef.current || resolvedId,
      content,
      title,
      startTime,
      endTime,
      location,
      visibility,
      autoCreateCall,
    };
    try {
      localStorage.setItem('kylrix:draft:event', JSON.stringify(draft));
      void LocalEngine.cacheSet(`f_draft_event_${ownerId}`, draft);
    } catch {
      /* quiet */
    }
  }, [content, title, startTime, endTime, location, visibility, autoCreateCall, resolvedId, ownerId]);

  useEffect(() => {
    if (isTitleManuallyEdited) return;
    const generated = buildAutoTitleFromContent(content);
    setTitle(content.trim() ? generated : '');
  }, [content, isTitleManuallyEdited]);

  const ensureId = useCallback(() => {
    const existing = resolvedId || liveIdRef.current;
    if (existing) return existing;
    const id = ID.unique();
    liveIdRef.current = id;
    setResolvedId(id);
    return id;
  }, [resolvedId]);

  const buildLive = useCallback(
    (nextContent: string, nextTitle?: string): Event => {
      const id = ensureId();
      const meta = pendingMetaRef.current;
      const previewTitle =
        resolveNoteCardTitle(
          isTitleManuallyEdited ? title : nextTitle ?? buildAutoTitleFromContent(nextContent),
          nextContent,
        ) ||
        (isTitleManuallyEdited ? title : nextTitle) ||
        'Untitled Event';
      const start = meta.startTime ? new Date(meta.startTime) : new Date();
      const end = meta.endTime ? new Date(meta.endTime) : addHours(start, 1);
      return {
        id,
        title: previewTitle,
        description: nextContent,
        startTime: start,
        endTime: end,
        location: meta.location || '',
        url: '',
        coverImage: '',
        attendees: [],
        isPublic: meta.visibility !== 'private',
        isGuest: true,
        isPinned: false,
        creatorId: ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    [ensureId, isTitleManuallyEdited, ownerId, title],
  );

  const pushLive = useCallback(
    async (event: Event) => {
      const meta = pendingMetaRef.current;
      const enriched = {
        ...event,
        visibility: meta.visibility,
        autoCreateCall: meta.autoCreateCall,
      };
      onLiveEvent?.(enriched);
      onEventCreated?.(event);
      pushLiveEvent(event);
      if (!announcedRef.current && (event.title?.trim() || event.description?.trim())) {
        announcedRef.current = true;
      }
    },
    [onEventCreated, onLiveEvent, pushLiveEvent],
  );

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(next);
      const generated = isTitleManuallyEdited ? title : buildAutoTitleFromContent(next);
      if (!isTitleManuallyEdited) setTitle(generated);
      void pushLive(buildLive(next, generated));
    },
    [buildLive, isTitleManuallyEdited, pushLive, title],
  );

  const handleClose = useCallback(() => {
    const id = liveIdRef.current || resolvedId;
    const hasContent = Boolean(content.trim() || title.trim());
    const meta = pendingMetaRef.current;

    try {
      localStorage.removeItem('kylrix:draft:event');
      void LocalEngine.cacheSet(`f_draft_event_${ownerId}`, null);
    } catch {
      /* quiet */
    }

    if (!hasContent && id) {
      autonomicSyncEngine.ack(`event:${id}`);
      void (async () => {
        try {
          const current = (await LocalEngine.cacheGet<any[]>(cacheKey)) || [];
          await LocalEngine.cacheSet(
            cacheKey,
            current.filter((e: any) => (e.id || e.$id) !== id),
          );
        } catch {
          /* optional */
        }
      })();
    } else if (hasContent) {
      const event = buildLive(content, title);
      void pushLive(event);
      const enriched = {
        ...event,
        visibility: meta.visibility,
        autoCreateCall: meta.autoCreateCall,
      };
      autonomicSyncEngine.markPending(`event:${event.id}`, new Date().toISOString(), enriched);
      void Promise.resolve(onCommitEvent?.(enriched))
        .then(() => {
          autonomicSyncEngine.ack(`event:${event.id}`);
        })
        .catch(() => {});
    }
    onClose?.();
  }, [buildLive, cacheKey, content, onClose, onCommitEvent, ownerId, pushLive, resolvedId, title]);

  useEffect(() => {
    onRegisterClose?.(handleClose);
    return () => onRegisterClose?.(null);
  }, [handleClose, onRegisterClose]);

  const resourceId = resolvedId ? `event:${resolvedId}` : null;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full min-h-0 flex flex-col bg-[#161412] text-white"
    >
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 bg-[#161412]/95 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="font-extrabold text-sm font-mono tracking-tight text-white leading-tight">
              New Event
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 select-none">
              <SyncStatusDot resourceId={resourceId} kind="event" />
              <SyncStatusLabel resourceId={resourceId} kind="event" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMobile ? (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/25 transition-all font-extrabold text-xs shrink-0 flex items-center gap-1.5"
            title="Save and Close"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0 scrollbar-thin overscroll-contain">
        {(content.trim().length >= 5 || isTitleManuallyEdited) && (
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsTitleManuallyEdited(true);
              void pushLive(buildLive(content, e.target.value));
            }}
            placeholder="Title"
            className="w-full bg-white/[0.02] text-white placeholder-white/20 border border-white/5 focus:border-[#22C55E]/30 rounded-xl px-3 py-2 text-xl font-black focus:outline-none transition-all font-clash shrink-0"
          />
        )}

        <textarea
          rows={isExpanded ? 10 : 5}
          value={content}
          onPaste={() => {
            isPastedRef.current = true;
            if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
            pasteTimerRef.current = setTimeout(() => {
              isPastedRef.current = false;
            }, 2000);
          }}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isExpanded && !isPastedRef.current) {
              e.preventDefault();
              handleClose();
            }
          }}
          placeholder="Write your event..."
          autoFocus
          className="w-full h-full min-h-[120px] resize-none bg-white/[0.03] text-white placeholder-white/20 border border-white/[0.06] hover:border-white/10 focus:border-[#22C55E]/30 rounded-xl px-3 py-2 text-lg focus:outline-none transition-all scrollbar-thin"
        />
      </div>

      <div className="p-3 border-t border-white/5 bg-[#161412] flex flex-col gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setIsDateDrawerOpen(true)}
          className="w-full p-2.5 rounded-xl border border-white/10 bg-black/40 hover:bg-black/60 transition-all flex items-center justify-between text-left cursor-pointer group select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#6366F1]/15 text-[#6366F1]">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-white font-satoshi">
                {startTime ? new Date(startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Event Schedule'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {startTime ? `${new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Tap to pick date & time'}
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
        </button>
        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-white/40">
          <MapPin className="w-3.5 h-3.5" />
          <input
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              void pushLive(buildLive(content, title));
            }}
            placeholder="Location (optional)"
            className="flex-1 rounded-lg border border-white/5 bg-black/40 px-2 py-1.5 text-white text-xs font-satoshi normal-case tracking-normal"
          />
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {(['private', 'public'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVisibility(v);
                  void pushLive(buildLive(content, title));
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black font-mono uppercase tracking-wider border transition-colors ${
                  visibility === v
                    ? 'border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]'
                    : 'border-white/10 bg-white/[0.03] text-white/45'
                }`}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAutoCreateCall((v) => !v);
                void pushLive(buildLive(content, title));
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black font-mono uppercase tracking-wider border transition-colors ${
                autoCreateCall
                  ? 'border-[#6366F1]/40 bg-[#6366F1]/15 text-[#6366F1]'
                  : 'border-white/10 bg-white/[0.03] text-white/45'
              }`}
            >
              <Video className="w-3 h-3" />
              Call
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-extrabold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(34,197,94,0.25)] cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      <EventDateTimePickerDrawer
        open={isDateDrawerOpen}
        onClose={() => setIsDateDrawerOpen(false)}
        startTime={startTime ? new Date(startTime) : new Date()}
        endTime={endTime ? new Date(endTime) : addHours(new Date(), 1)}
        onApply={(newStart, newEnd) => {
          const sStr = toLocalInputValue(newStart);
          const eStr = toLocalInputValue(newEnd);
          setStartTime(sStr);
          setEndTime(eStr);
          void pushLive(buildLive(content, title));
        }}
      />
    </div>
  );
}
