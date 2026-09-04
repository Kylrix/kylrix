'use client';

import React, { useEffect } from 'react';
import { ObjectDetailShell } from '@/components/objects/ObjectDetailShell';
import type { UnifiedObjectDetailModel } from '@/lib/objects/types';
import { triggerLocalSoftRefresh } from '@/lib/sync/local-soft-refresh';

type Props = {
  item: UnifiedObjectDetailModel | null;
  open: boolean;
  onClose: () => void;
  /** When true, render as fill container (desktop sidebar) with no overlay */
  embedded?: boolean;
  /** full title chrome vs panel-only (child supplies header) */
  chrome?: 'full' | 'panel';
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Detail host: overlay (mobile) or embedded panel (desktop sidebar).
 */
export function ObjectDetailHost({
  item,
  open,
  onClose,
  embedded = false,
  chrome = 'panel',
  children,
  footer}: Props) {
  useEffect(() => {
    if (open && item?.id) {
      triggerLocalSoftRefresh(item.kind, item.id);
    }
  }, [open, item?.id, item?.kind]);

  if (!open || !item) return null;

  // Always fill the parent Overlay / DynamicSidebar (those are true fullscreen).
  // Never nest a fixed shell — Drawer transforms trap `position:fixed` to ~720px.
  if (embedded || chrome === 'panel') {
    return (
      <div className="flex h-full min-h-0 w-full max-w-full min-w-0 flex-col bg-[#161412] overflow-x-hidden overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 max-w-full overscroll-contain">
          {children}
        </div>
        {footer ? (
          <footer className="border-t border-white/[0.08] px-5 py-3 shrink-0">{footer}</footer>
        ) : null}
      </div>
    );
  }

  return (
    <ObjectDetailShell item={item} open={open} onClose={onClose} footer={footer} chrome={chrome}>
      {children}
    </ObjectDetailShell>
  );
}
