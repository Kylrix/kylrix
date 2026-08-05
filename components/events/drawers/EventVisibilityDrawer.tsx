'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Lock, Check, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  isPublic: boolean;
  onApply: (isPublic: boolean) => void;
};

export function EventVisibilityDrawer({ open, onClose, isPublic: initialIsPublic, onApply }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setIsPublic(initialIsPublic);
    }
  }, [open, initialIsPublic]);

  const handleSave = () => {
    onApply(isPublic);
    onClose();
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[15000] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-[540px] mx-auto bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[28px] p-6 shadow-2xl z-[15001] flex flex-col gap-5 text-white overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base font-clash tracking-tight text-white">
                Event Visibility & Sharing
              </h3>
              <p className="text-xs text-[#8E8A86] font-mono">
                Control who can view and join this event
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

        {/* Options */}
        <div className="flex flex-col gap-3">
          <div 
            onClick={() => setIsPublic(true)}
            className={`p-4 rounded-2xl border transition-all flex items-start justify-between cursor-pointer select-none ${
              isPublic
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl border mt-0.5 ${isPublic ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold font-satoshi text-white">Public Event</span>
                <span className="text-xs text-[#8E8A86] font-satoshi mt-0.5">
                  Anyone with the share link can view event details and RSVP. Public previews are enabled for link sharing.
                </span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${isPublic ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
              {isPublic && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
            </div>
          </div>

          <div 
            onClick={() => setIsPublic(false)}
            className={`p-4 rounded-2xl border transition-all flex items-start justify-between cursor-pointer select-none ${
              !isPublic
                ? 'bg-purple-500/10 border-purple-500/40 text-white'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl border mt-0.5 ${!isPublic ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold font-satoshi text-white">Private Event</span>
                <span className="text-xs text-[#8E8A86] font-satoshi mt-0.5">
                  Only explicitly invited members can view details. Unauthenticated guest previews will be restricted.
                </span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${!isPublic ? 'border-purple-500 bg-purple-500' : 'border-white/30'}`}>
              {!isPublic && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)] mt-2"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            <span>Apply Visibility</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
