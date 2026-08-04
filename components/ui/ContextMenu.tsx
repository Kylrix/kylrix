'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KylrixApp } from '@/lib/sdk/design';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
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
}

export function ContextMenu({ onCloseAction, items }: ContextMenuProps) {
  const [menuStack, setMenuStack] = useState<ContextMenuItem[][]>([items]);
  const currentItems = menuStack[menuStack.length - 1];
  const isSubmenu = menuStack.length > 1;
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      {!isDesktop && (
        <div
          className="fixed inset-0 z-[10090] bg-black/40 transition-opacity duration-300 ease-in-out cursor-default"
          onClick={onCloseAction}
        />
      )}

      <div
        data-kylrix-context-menu="true"
        className={
          isDesktop
            ? 'fixed top-[57px] right-0 bottom-0 w-full max-w-[420px] h-[calc(100vh-57px)] bg-[#161412] border-l border-white/10 z-[10100] text-white p-5 flex flex-col gap-4 overflow-y-auto font-satoshi shadow-[-16px_0_32px_rgba(0,0,0,0.6)]'
            : 'fixed bottom-0 left-0 right-0 h-[60vh] max-h-[600px] bg-[#161412] border-t border-white/10 rounded-t-[28px] z-[10100] text-white p-5 flex flex-col gap-4 animate-slide-up overflow-y-auto font-satoshi shadow-[0_-24px_48px_rgba(0,0,0,0.8)] max-w-xl mx-auto'
        }
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!isDesktop ? (
          <div className="w-10 h-1 bg-[#34322F] rounded-full mx-auto shrink-0 mb-1" />
        ) : (
          <div className="flex items-center justify-between shrink-0 mb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9B9691]">Actions</p>
            <button
              type="button"
              onClick={onCloseAction}
              className="text-xs font-bold text-[#9B9691] hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
            >
              Close
            </button>
          </div>
        )}

        {isSubmenu && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBack(e);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#161412] border border-[#1C1A18] text-[#9B9691] hover:text-white transition-all text-left text-xs font-bold uppercase tracking-wider mb-1"
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}

        <div className="flex flex-col gap-2">
          {currentItems.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
              className={`w-full flex items-center justify-between gap-3.5 p-3 rounded-2xl text-sm font-semibold transition-all duration-200 text-left border ${
                item.variant === 'destructive'
                  ? 'bg-red-500/10 border-red-500/20 text-[#FF453A] hover:bg-red-500/20'
                  : 'bg-[#161412] border-[#1C1A18] text-[#F5F2ED] hover:border-[#A855F7] hover:text-white'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                {item.icon && (
                  <div className="p-2 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-[#A855F7] shrink-0">
                    {item.icon}
                  </div>
                )}
                <span className="whitespace-normal leading-snug break-words">{item.label}</span>
              </div>
              {item.submenu ? <ChevronRight size={16} className="text-[#9B9691] shrink-0" /> : null}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
