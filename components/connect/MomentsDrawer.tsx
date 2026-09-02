'use client';

import React, { useCallback, useEffect } from 'react';
import { X, Plus, Sliders, Sparkles } from 'lucide-react';
import { ConnectMomentsPanel } from '@/components/connect/ConnectMomentsPanel';
import { ConnectFeedSettingsPanel } from '@/components/connect/ConnectFeedSettingsPanel';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

export interface MomentsDrawerProps {
  onClose?: () => void;
  initialTab?: 'moments' | 'replies' | 'likes' | 'bookmarks';
}

export function MomentsDrawer({ onClose }: MomentsDrawerProps) {
  const { open: openUnified } = useUnifiedDrawer();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleOpenComposer = useCallback(() => {
    openUnified('moment-composer');
  }, [openUnified]);

  const handleOpenSettings = useCallback(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
    const node = <ConnectFeedSettingsPanel onClose={isDesktop ? closeSidebar : closeOverlay} />;
    if (isDesktop) openSidebar(node, 'connect-feed-settings', { hideHeader: true });
    else openOverlay(node);
  }, [closeOverlay, closeSidebar, openOverlay, openSidebar]);

  // Handle ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] bg-[#000000] text-white overflow-hidden select-none animate-in fade-in duration-200">
      {/* Top Header Chrome */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#0A0908] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-base font-black font-clash text-white tracking-tight m-0">
              Moments
            </h2>
            <p className="text-[11px] font-mono text-white/40 m-0">
              Decentralized social pulse & stream
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenComposer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#F59E0B] text-black hover:bg-[#d97706] active:scale-95 transition-all shadow-[0_2px_10px_rgba(245,158,11,0.25)] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Create Moment</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="p-2 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Feed settings"
            aria-label="Feed settings"
          >
            <Sliders size={16} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-1"
              title="Close Moments"
              aria-label="Close Moments"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Stream Body */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 min-h-0 select-text">
        <ConnectMomentsPanel onCreateMoment={handleOpenComposer} />
      </main>
    </div>
  );
}
