'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Video, Link2, Check, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { hasEffectivePaidAccess } from '@/lib/utils';

import { CallService } from '@/lib/services/call';

type Props = {
  open: boolean;
  onClose: () => void;
  location: string;
  meetingUrl: string;
  eventTitle?: string;
  onApply: (location: string, meetingUrl: string, autoCreateCall?: boolean) => void;
};

export function EventLocationDrawer({ open, onClose, location: initialLocation, meetingUrl: initialMeetingUrl, eventTitle, onApply }: Props) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [location, setLocation] = useState(initialLocation);
  const [meetingUrl, setMeetingUrl] = useState(initialMeetingUrl);
  const [useKylrixCall, setUseKylrixCall] = useState(false);
  const [isProcessingCall, setIsProcessingCall] = useState(false);

  const isPro = user ? hasEffectivePaidAccess(user) : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setLocation(initialLocation || '');
      setMeetingUrl(initialMeetingUrl || '');
      setUseKylrixCall(Boolean(initialMeetingUrl && initialMeetingUrl.includes('/connect/call/')));
    }
  }, [open, initialLocation, initialMeetingUrl]);

  const handleSave = async () => {
    setIsProcessingCall(true);
    let finalUrl = meetingUrl.trim();
    const existingCallMatch = initialMeetingUrl?.match(/\/connect\/call\/([^/?#]+)/);
    const existingCallId = existingCallMatch ? existingCallMatch[1] : null;

    try {
      if (useKylrixCall && isPro) {
        if (existingCallId) {
          // Reuse existing call ID — never spin up duplicate calls for the same event
          finalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/connect/call/${existingCallId}`;
        } else {
          // Spin up new tracked Huddle / Call
          const callObj = await CallService.createCallLink(
            user?.$id || 'guest',
            'video',
            undefined,
            eventTitle ? `Huddle: ${eventTitle}` : 'Event Huddle',
            undefined,
            120,
            undefined,
            true
          );
          const callId = callObj?.$id || callObj?.id;
          if (callId) {
            finalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/connect/call/${callId}`;
          }
        }
      } else if (!useKylrixCall && existingCallId) {
        // User removed the Huddle object — instantly delete call item from database
        await CallService.cleanupLink(existingCallId);
        if (finalUrl.includes('/connect/call/')) {
          finalUrl = '';
        }
      }

      onApply(location.trim(), finalUrl, useKylrixCall);
      onClose();
    } catch (err) {
      console.error('Failed to update event huddle/location:', err);
      onApply(location.trim(), finalUrl, useKylrixCall);
      onClose();
    } finally {
      setIsProcessingCall(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[15000] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-[540px] mx-auto bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[28px] p-6 shadow-2xl z-[15001] flex flex-col gap-5 text-white overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base font-clash tracking-tight text-white">
                Location & Meeting
              </h3>
              <p className="text-xs text-[#8E8A86] font-mono">
                Set physical location or link a video call
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
            Physical / Display Location
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco HQ or Online"
              className="rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-white text-sm font-satoshi focus:border-emerald-500 focus:outline-none transition-all placeholder:text-white/20"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
            Video Call URL (Google Meet / Zoom / Custom)
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

          {/* Kylrix Call Pro Option */}
          <div 
            onClick={() => {
              if (isPro) setUseKylrixCall((v) => !v);
            }}
            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none ${
              useKylrixCall
                ? 'bg-[#6366F1]/15 border-[#6366F1]/40 text-white'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${useKylrixCall ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}>
                <Video className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold font-satoshi">Spin up Kylrix Audio/Video Call</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Pro
                  </span>
                </div>
                <span className="text-[10px] text-[#8E8A86] font-mono mt-0.5">
                  {isPro ? 'Encrypted real-time audio/video mesh for all attendees' : 'Requires Kylrix Pro subscription'}
                </span>
              </div>
            </div>
            {isPro && (
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${useKylrixCall ? 'border-[#6366F1] bg-[#6366F1]' : 'border-white/30'}`}>
                {useKylrixCall && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessingCall}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)] mt-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            <span>{isProcessingCall ? 'Updating Huddle...' : 'Apply Location & Meeting'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
