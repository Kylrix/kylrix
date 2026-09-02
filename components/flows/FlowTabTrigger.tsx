'use client';

import React, { useCallback } from 'react';
import { GitFork } from 'lucide-react';
import { useOverlay } from '@/components/ui/OverlayContext';
import { FlowsDrawer } from '@/components/flows/FlowsDrawer';
import {
  useNativeSidebarApiOptional,
  NATIVE_SIDEBAR_WIDTHS,
} from '@/context/RightRailContext';

export interface FlowTabTriggerProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'header';
}

export function FlowTabTrigger({
  className = '',
  variant = 'icon',
}: FlowTabTriggerProps) {
  const { openOverlay, closeOverlay } = useOverlay();
  const native = useNativeSidebarApiOptional();
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  const handleOpenFlows = useCallback(() => {
    const panel = (
      <FlowsDrawer
        onClose={() => {
          if (isDesktop && native) {
            native.close('flows-drawer');
          } else {
            closeOverlay();
          }
        }}
      />
    );

    if (isDesktop && native) {
      native.open(panel, {
        key: 'flows-drawer',
        width: NATIVE_SIDEBAR_WIDTHS.default,
        title: 'Flows Hub',
      });
    } else {
      openOverlay(panel);
    }
  }, [isDesktop, native, closeOverlay, openOverlay]);

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleOpenFlows}
        className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
        title="Automations & Flows"
      >
        <GitFork size={16} className="text-[#A855F7]" />
        <span>Flows</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenFlows}
      className={`relative inline-flex items-center justify-center p-2.5 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
      title="Automations & Flows"
      aria-label="Flows"
    >
      <GitFork size={16} className="text-[#A855F7] group-hover:text-white" />
    </button>
  );
}
