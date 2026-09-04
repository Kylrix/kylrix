'use client';

import React from 'react';
import { X } from 'lucide-react';
import { objectKindLabel, type UnifiedObjectDetailModel } from '@/lib/objects/types';

type Props = {
  item: UnifiedObjectDetailModel | null;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** full = title header; panel = backdrop + side panel only (child supplies chrome) */
  chrome?: 'full' | 'panel';
};

/**
 * Shared detail drawer chrome. Route/list click → open this; children render the
 * kind-specific plugin (NoteDetailSidebar guts, TaskDetails, etc.).
 */
export function ObjectDetailShell({
  item,
  open,
  onClose,
  children,
  footer,
  chrome = 'full'}: Props) {
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex pointer-events-none">
      <button
        type="button"
        aria-label="Close detail"
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={onClose}
      />
      <aside className="relative h-[100dvh] w-full max-w-none bg-[#161412] pointer-events-auto flex flex-col">
        {chrome === 'full' ? (
          <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08]">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#9B9691] mb-1">
                {objectKindLabel(item.kind)}
              </p>
              <h2 className="text-lg font-bold text-white font-clash truncate">{item.title || 'Untitled'}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-[#2C2A28] bg-[#141210] flex items-center justify-center text-[#9B9691] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        ) : null}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer ? <footer className="border-t border-[#2C2A28] px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}
