'use client';

import React from 'react';
import { ObjectDetailShell } from '@/components/objects/ObjectDetailShell';
import type { UnifiedObjectDetailModel } from '@/lib/objects/types';

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
  if (!open || !item) return null;

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-[#0A0908]">
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer ? <footer className="border-t border-[#2C2A28] px-5 py-3">{footer}</footer> : null}
      </div>
    );
  }

  return (
    <ObjectDetailShell item={item} open={open} onClose={onClose} footer={footer} chrome={chrome}>
      {children}
    </ObjectDetailShell>
  );
}
