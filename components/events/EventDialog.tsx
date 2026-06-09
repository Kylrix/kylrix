'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Link2, Globe, Lock, Video, ChevronUp, ChevronDown, ArrowUpRight } from 'lucide-react';
import { addHours } from '@/lib/time-util';
import { EventVisibility } from '@/lib/permissions';
import UserSearch from '@/components/UserSearch';
import { useSection } from '@/context/SectionContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import EventDetails from './EventDetails';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
}

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => any;
}

const toLocalISO = (date: Date | null) => {
  if (!date) return '';
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
};

const fromLocalISO = (str: string) => {
  if (!str) return null;
  return new Date(str);
};

export const EventDialog: React.FC<EventDialogProps> = ({ open, onClose, onSubmit }) => {
  const { setActiveDetail } = useSection();
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(addHours(new Date(), 1));
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [selectedGuests, setSelectedGuests] = useState<User[]>([]);
  const [autoCreateCall, setAutoCreateCall] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Viewport observer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load draft when dialog opens
  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:event');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.location) setLocation(draft.location);
        if (draft.url) setUrl(draft.url);
        if (draft.coverImage) setCoverImage(draft.coverImage);
        if (draft.visibility) setVisibility(draft.visibility);
        if (draft.autoCreateCall !== undefined) setAutoCreateCall(draft.autoCreateCall);
        if (draft.startTime) setStartTime(new Date(draft.startTime));
        if (draft.endTime) setEndTime(new Date(draft.endTime));
        if (draft.guests) setSelectedGuests(draft.guests);
      } catch (e) {
        console.error('Failed to parse event draft', e);
      }
    }
    setIsHydrated(true);
  }, [open]);

  // Save draft on fields change
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !isHydrated) return;
    const draft = {
      title,
      description,
      location,
      url,
      coverImage,
      visibility,
      autoCreateCall,
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      guests: selectedGuests,
    };
    if (title.trim() || description.trim() || location.trim() || url.trim() || selectedGuests.length > 0) {
      localStorage.setItem('kylrix:draft:event', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:event');
    }
  }, [open, isHydrated, title, description, location, url, coverImage, visibility, autoCreateCall, startTime, endTime, selectedGuests]);

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;

    onSubmit({
      title,
      description,
      startTime,
      endTime,
      location,
      url,
      coverImage,
      visibility,
      guests: selectedGuests.map(g => g.id),
      autoCreateCall
    });

    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:event');
    }
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime(new Date());
    setEndTime(addHours(new Date(), 1));
    setLocation('');
    setUrl('');
    setCoverImage('');
    setVisibility('public');
    setSelectedGuests([]);
    setAutoCreateCall(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
    setIsExpanded(false);
    setIsHydrated(false);
  };

  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleMorphToDetail = async () => {
    if (!title.trim() || !startTime || !endTime) return;

    const result = await onSubmit({
      title,
      description,
      startTime,
      endTime,
      location,
      url,
      coverImage,
      visibility,
      guests: selectedGuests.map(g => g.id),
      autoCreateCall
    });

    if (result && (result.id || result.$id)) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:event');
      }
      const eventId = result.id || result.$id;
      if (!isMobile) {
        openSidebar(
          <EventDetails eventId={eventId} initialData={result} />,
          eventId,
          { hideHeader: true }
        );
      } else {
        openOverlay(
          <EventDetails eventId={eventId} initialData={result} onBack={closeOverlay} />
        );
      }
    }
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
        onClick={handleClose}
      />

      {/* Dialog Pane */}
      <div
        className={`fixed bg-[#161412] border-[#34322F] pointer-events-auto transition-all duration-300 flex flex-col z-[2000] md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-[600px] md:h-full md:border-l md:rounded-none inset-x-0 bottom-0 border-t rounded-t-[28px] ${
          isMobile ? (isExpanded ? 'h-[100dvh]' : 'h-[60dvh]') : 'h-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#34322F] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#1C1A18] border border-[#34322F] text-[#6366F1] flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
                Create New Event
              </h3>
              <p className="text-xs text-[#8E8A86] font-semibold font-satoshi mt-0.5">
                Orchestrate a new moment in the ecosystem
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {title.trim().length > 0 && (
              <button
                type="button"
                onClick={handleMorphToDetail}
                className="p-1.5 rounded-lg text-[#F59E0B] hover:text-white hover:bg-[#1C1A18] transition-colors cursor-pointer animate-pulse"
                title="Go Full Detail"
              >
                <ArrowUpRight className="w-5 h-5" />
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-[#8E8A86] hover:text-[#F5F2ED] hover:bg-[#1C1A18] transition-colors cursor-pointer"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#1C1A18] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 scrollbar-thin">
          {/* Title input */}
          <div>
            <input
              type="text"
              autoFocus
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-2xl font-black font-clash text-white placeholder-[#5E5B58] border-none focus:outline-none focus:ring-0"
            />
          </div>

          {/* Description input */}
          <div>
            <textarea
              placeholder="Add description or agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-transparent text-base font-medium font-satoshi text-[#C1BEBA] placeholder-[#5E5B58] border-none focus:outline-none focus:ring-0 resize-none"
            />
          </div>

          <div className="h-px bg-[#34322F]" />

          {/* Starts At / Ends At Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase font-satoshi">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={toLocalISO(startTime)}
                onChange={(e) => setStartTime(fromLocalISO(e.target.value))}
                className="w-full bg-[#000000] px-4 py-3 rounded-xl border border-[#34322F] text-sm font-semibold text-white focus:outline-none focus:border-[#6366F1] transition-colors cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase font-satoshi">
                Ends At
              </label>
              <input
                type="datetime-local"
                value={toLocalISO(endTime)}
                onChange={(e) => setEndTime(fromLocalISO(e.target.value))}
                className="w-full bg-[#000000] px-4 py-3 rounded-xl border border-[#34322F] text-sm font-semibold text-white focus:outline-none focus:border-[#6366F1] transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Location & Link Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative flex items-center">
              <span className="absolute left-4 text-[#6366F1] pointer-events-none">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Location (Physical or Virtual)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#000000] pl-11 pr-4 py-3.5 rounded-xl border border-[#34322F] text-sm font-semibold text-white placeholder-[#5E5B58] focus:outline-none focus:border-[#6366F1] transition-colors"
              />
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-[#6366F1] pointer-events-none">
                <Link2 className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="External Link (Optional)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-[#000000] pl-11 pr-4 py-3.5 rounded-xl border border-[#34322F] text-sm font-semibold text-white placeholder-[#5E5B58] focus:outline-none focus:border-[#6366F1] transition-colors"
              />
            </div>
          </div>

          {/* Auto-create Connect Call */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#1C1A18] border border-[#34322F] hover:border-[#6366F1] transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#000000] border border-[#34322F] rounded-lg text-[#6366F1] flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block font-satoshi">
                  Kylrix Connect Call
                </span>
                <span className="text-xs text-[#8E8A86] font-semibold block font-satoshi mt-0.5">
                  Create a secure video call link for this event
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoCreateCall(!autoCreateCall)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoCreateCall ? 'bg-[#6366F1]' : 'bg-[#34322F]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoCreateCall ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Event Visibility */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase block font-satoshi">
              Event Visibility
            </span>
            <div className="flex gap-2 w-full">
              {(['public', 'unlisted', 'private'] as const).map((v) => {
                const isActive = visibility === v;
                let Icon = Globe;
                if (v === 'unlisted') Icon = Link2;
                if (v === 'private') Icon = Lock;

                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer capitalize font-satoshi ${
                      isActive
                        ? 'bg-[#1C1A18] border-[#6366F1] text-[#6366F1]'
                        : 'bg-black border-[#34322F] text-[#8E8A86] hover:bg-[#1C1A18] hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{v}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invite Guests (UserSearch) */}
          <UserSearch
            label="INVITE GUESTS"
            placeholder="Search people to invite..."
            selectedUsers={selectedGuests}
            onSelect={(user) => setSelectedGuests(prev => [...prev, user])}
            onRemove={(userId) => setSelectedGuests(prev => prev.filter(u => u.id !== userId))}
          />
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 gap-3 flex flex-col border-t border-[#34322F] bg-[#161412] flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3.5 rounded-xl text-[#8E8A86] font-bold text-sm font-satoshi hover:bg-[#1C1A18] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || !startTime || !endTime}
            className={`w-full py-3.5 rounded-xl font-bold text-sm font-satoshi transition-all cursor-pointer ${
              !title.trim() || !startTime || !endTime
                ? 'bg-[#1C1A18] text-[#5E5B58] border border-[#34322F] cursor-not-allowed'
                : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white'
            }`}
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDialog;
