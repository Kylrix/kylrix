'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { AgenticPanelContent } from './AgenticPanelContent';

export function AgenticDrawer() {
  const { isOpen, closeAgenticDrawer } = useAgenticDrawer();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    closeAgenticDrawer();
  }, [closeAgenticDrawer]);

  if (!isOpen) return null;

  const isFullscreen = !isDesktop && isExpanded;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm ${isFullscreen ? 'z-[10000]' : 'z-[1300]'}`}
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={`fixed flex flex-col overflow-hidden bg-[#161412] border-[#34322F] shadow-2xl font-satoshi transition-all duration-300 ${
          isFullscreen
            ? 'z-[10001] inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none border-0'
            : 'z-[1301] bottom-0 left-0 right-0 h-[60dvh] max-h-[60dvh] border-t rounded-t-[24px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(100%,540px)] md:rounded-[28px] md:bottom-4 md:border'
        }`}
        style={{
          boxShadow: '0 -12px 36px rgba(0,0,0,0.5), 0 16px 48px rgba(0,0,0,0.7)',
        }}
      >
        {!isDesktop && !isFullscreen && (
          <div className="flex justify-center items-center gap-3 py-2.5 flex-shrink-0 select-none border-b border-white/5">
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? 'Scale down' : 'Scale up'}
              className="p-1 text-white/40 hover:text-white transition"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <AgenticPanelContent onClose={handleClose} isDesktop={isDesktop} />
        </div>
      </div>
    </>
  );
}
