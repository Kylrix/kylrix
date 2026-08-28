'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KylrixApp } from '@/lib/sdk/design';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: (e?: any) => void | Promise<void>;
  submenu?: ContextMenuItem[];
  variant?: 'default' | 'destructive';
  keepOpen?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onCloseAction: () => void;
  items: ContextMenuItem[];
  appType?: KylrixApp;
  title?: string;
}

export function ContextMenuPanel({ onCloseAction, items, title }: { onCloseAction: () => void; items: ContextMenuItem[]; appType?: KylrixApp; title?: string }) {
  const [menuStack, setMenuStack] = useState<ContextMenuItem[][]>([items]);
  const currentItems = menuStack[menuStack.length - 1];
  const isSubmenu = menuStack.length > 1;

  useEffect(() => {
    setMenuStack((prev) => {
      if (prev.length <= 1) return [items];
      const prevSubmenu = prev[1];
      if (!prevSubmenu) return [items];
      const parentItem = items.find(
        (item) =>
          item.submenu &&
          item.submenu.length === prevSubmenu.length &&
          item.submenu.every((entry, index) => entry.label === prevSubmenu[index]?.label));
      if (parentItem?.submenu) return [items, parentItem.submenu];
      return [items];
    });
  }, [items]);

  const handleBack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuStack(prev => prev.slice(0, -1));
  }, []);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.submenu) {
      setMenuStack(prev => [...prev, item.submenu!]);
      return;
    }
    if (item.onClick) {
      item.onClick();
      if (!item.keepOpen) {
        onCloseAction();
      }
    }
  };

  return (
    <div
      data-kylrix-context-menu="true"
      className="w-full h-full min-h-0 bg-[#161412] text-white p-3.5 sm:p-4 flex flex-col gap-2.5 overflow-y-auto font-satoshi"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-1 shrink-0 border-b border-white/5 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9B9691]">Actions</p>
          <button
            type="button"
            onClick={onCloseAction}
            className="text-xs font-bold text-[#9B9691] hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            Close
          </button>
        </div>
        {title ? (
          <h4 className="text-sm font-extrabold text-white truncate max-w-full font-clash leading-tight">
            {title}
          </h4>
        ) : null}
      </div>

      {isSubmenu && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleBack(e);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#161412] border border-[#1C1A18] text-[#9B9691] hover:text-white transition-all text-left text-xs font-bold uppercase tracking-wider mb-0.5 cursor-pointer"
        >
          <ChevronLeft size={15} />
          <span>Back</span>
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        {currentItems.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleItemClick(item);
            }}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left border cursor-pointer ${
              item.variant === 'destructive'
                ? 'bg-red-500/10 border-red-500/20 text-[#FF453A] hover:bg-red-500/20'
                : 'bg-[#161412] border-[#1C1A18] text-[#F5F2ED] hover:border-[#A855F7] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {item.icon && (
                <div className="p-1.5 rounded-lg bg-[#0A0908] border border-[#1C1A18] text-[#A855F7] shrink-0">
                  {item.icon}
                </div>
              )}
              <span className="whitespace-normal leading-snug break-words">{item.label}</span>
            </div>
            {item.submenu ? <ChevronRight size={15} className="text-[#9B9691] shrink-0" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContextMenu({ onCloseAction, items, appType, title }: ContextMenuProps) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10090] bg-black/40 transition-opacity duration-300 ease-in-out cursor-default"
        onClick={onCloseAction}
      />
      <div
        data-kylrix-context-menu="true"
        className="fixed bottom-0 left-0 right-0 max-h-[60dvh] bg-[#161412] border-t border-white/10 rounded-t-[24px] z-[10100] text-white p-3.5 flex flex-col gap-2 animate-slide-up overflow-y-auto font-satoshi shadow-[0_-24px_48px_rgba(0,0,0,0.8)] max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="w-9 h-1 bg-[#34322F] rounded-full mx-auto shrink-0 mb-0.5" />
        <ContextMenuPanel onCloseAction={onCloseAction} items={items} appType={appType} title={title} />
      </div>
    </>,
    document.body
  );
}
