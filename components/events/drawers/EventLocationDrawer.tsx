'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Link2, Check, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  location: string;
  meetingUrl: string;
  eventTitle?: string;
  onApply: (location: string, meetingUrl: string, autoCreateCall?: boolean) => void;
};

export function EventLocationDrawer({ open, onClose, location: initialLocation, meetingUrl: initialMeetingUrl, onApply }: Props) {
  const [mounted, setMounted] = useState(false);
  const [location, setLocation] = useState(initialLocation);
  const [meetingUrl, setMeetingUrl] = useState(initialMeetingUrl);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setLocation(initialLocation || '');
      setMeetingUrl(initialMeetingUrl || '');
    }
  }, [open, initialLocation, initialMeetingUrl]);

  const handleSave = () => {
    onApply(location.trim(), meetingUrl.trim(), false);
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#161412] border border-[#34322F] rounded-t-[28px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-extrabold text-white font-clash">Location & Meeting Link</h3>
            <p className="text-xs text-white/50 font-satoshi mt-0.5">Add physical venue or digital room URL</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-white/80 font-satoshi">Physical Location</span>
            <div className="relative flex items-center">
              <MapPin className="w-4 h-4 text-white/30 absolute left-3.5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. SF Commons, 2nd Floor"
                className="w-full rounded-xl border border-white/10 bg-black/60 pl-10 pr-3.5 py-2.5 text-white text-sm font-satoshi focus:border-emerald-500 focus:outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-white/80 font-satoshi">Meeting URL</span>
            <div className="relative flex items-center">
              <Link2 className="w-4 h-4 text-white/30 absolute left-3.5" />
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-xl border border-white/10 bg-black/60 pl-10 pr-3.5 py-2.5 text-white text-sm font-satoshi focus:border-emerald-500 focus:outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)] mt-2"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            <span>Apply Location & Meeting</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
