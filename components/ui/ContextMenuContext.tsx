"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

interface MenuState {
  x: number;
  y: number;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }>;
}

interface ContextMenuContextType {
  openMenu: (state: MenuState) => void;
  closeMenu: () => void;
  isOpen: boolean;
  state: MenuState | null;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<MenuState | null>(null);
  const isOpen = !!state;

  const closeMenu = useCallback(() => setState(null), []);
  const openMenu = useCallback((s: MenuState) => setState(s), []);

  // Global listeners for close
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (_e: MouseEvent) => {
      // If click falls through (menu component stops its own propagation), this will close
      closeMenu();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, closeMenu]);

  // Close on scroll to keep in sync with page content
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => closeMenu();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu, isOpen, state }}>
      {children}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenu = () => {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useContextMenu must be used within a ContextMenuProvider');
  return ctx;
};
