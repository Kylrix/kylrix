'use client';

import React, { useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { useOverlay } from '@/components/ui/OverlayContext';
import { MomentsDrawer } from '@/components/connect/MomentsDrawer';
import {
  useNativeSidebarApiOptional,
  NATIVE_SIDEBAR_WIDTHS,
} from '@/context/RightRailContext';

export interface MomentTabTriggerProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'header';
}

export function MomentTabTrigger({
  className = '',
  variant = 'icon',
}: MomentTabTriggerProps) {
  const { openOverlay, closeOverlay } = useOverlay();
  const native = useNativeSidebarApiOptional();
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  const handleOpenMoments = useCallback(() => {
    const panel = (
      <MomentsDrawer
        onClose={() => {
          if (isDesktop && native) {
            native.close('moments-drawer');
          } else {
            closeOverlay();
          }
        }}
      />
    );

    if (isDesktop && native) {
      native.open(panel, {
        key: 'moments-drawer',
        width: NATIVE_SIDEBAR_WIDTHS.default,
        title: 'Moments Feed',
      });
    } else {
      openOverlay(panel);
    }
  }, [isDesktop, native, closeOverlay, openOverlay]);

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleOpenMoments}
        className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
        title="Moments & Feed"
      >
        <Sparkles size={16} className="text-[#F59E0B]" />
        <span>Moments</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenMoments}
      className={`relative inline-flex items-center justify-center p-2.5 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
      title="Moments & Feed"
      aria-label="Moments"
    >
      <Sparkles size={16} className="text-[#F59E0B] group-hover:text-white" />
    </button>
  );
}
