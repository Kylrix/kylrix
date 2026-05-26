"use client";

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { useOverlay } from './OverlayContext';
import { useNotes } from '@/context/NotesContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  NoteAdd as NoteAddIcon,
  Search as SearchIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  Folder as FolderIcon,
  Chat as ChatIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

type KylrixApp = 'root' | 'accounts' | 'kylrix' | 'vault' | 'flow' | 'note' | 'connect';

interface MenuState {
  x: number;
  y: number;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }>;
  appType?: KylrixApp;
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
  
  // Track if a component already handled this context menu event
  const menuOpenedInCurrentTick = useRef(false);

  const openMenu = useCallback((s: MenuState) => {
    setState(s);
    menuOpenedInCurrentTick.current = true;
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const { showSuccess } = useToast();
  const { openOverlay } = useOverlay();
  const { upsertNote } = useNotes();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();

  // Global listeners for close click/keyboard
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (_e: MouseEvent) => {
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

  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => closeMenu();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen, closeMenu]);

  // Global contextmenu listener to block standard browser behavior and display dynamic morphing menu
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      // If a specific React component (like NoteCard) already opened a menu, do not override it
      if (menuOpenedInCurrentTick.current) {
        menuOpenedInCurrentTick.current = false;
        return;
      }

      e.preventDefault();

      // Determine sub-app theme based on path
      let appType: KylrixApp = 'kylrix';
      if (pathname?.startsWith('/note')) appType = 'note';
      else if (pathname?.startsWith('/connect')) appType = 'connect';
      else if (pathname?.startsWith('/vault')) appType = 'vault';
      else if (pathname?.startsWith('/flow')) appType = 'flow';
      else if (pathname?.startsWith('/accounts')) appType = 'accounts';
      else if (pathname?.startsWith('/settings')) appType = 'accounts';

      // 1. Identify clicked component target
      const target = e.target as HTMLElement;
      const isSidebar = target.closest('[data-testid="sidebar"]') || target.closest('aside');
      const isTopbar = target.closest('header') || target.closest('#connect-topbar');

      const items: MenuState['items'] = [];

      // Helper function for quick note capture
      const triggerQuickNote = () => {
        import("@/app/(app)/note/(app)/notes/CreateNoteForm").then(({ default: CreateNoteForm }) => {
          openOverlay(<CreateNoteForm onNoteCreated={(n) => upsertNote(n)} />);
        });
      };

      // Helper for topbar search focus
      const focusGlobalSearch = () => {
        const input = document.getElementById("topbar-search-input") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select?.();
        }
      };

      // Compile Morphing Options
      if (isSidebar) {
        items.push(
          { label: 'Notes Vault', icon: <FolderIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/note/notes') },
          { label: 'Connect Hub', icon: <ChatIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/connect') },
          { label: 'Vault Crypt', icon: <LockIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/vault') },
          { label: 'Settings', icon: <SettingsIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/settings') }
        );
      } else if (isTopbar) {
        items.push(
          { label: 'Focus Search', icon: <SearchIcon sx={{ fontSize: 16 }} />, onClick: focusGlobalSearch },
          { label: 'Quick Capture Note', icon: <NoteAddIcon sx={{ fontSize: 16 }} />, onClick: triggerQuickNote },
          { label: 'Sync Vault', icon: <SyncIcon sx={{ fontSize: 16 }} />, onClick: () => showSuccess('Vault Synced', 'All encrypted local rows are in active alignment.') }
        );
      } else {
        // Page-specific morphing options
        if (appType === 'note') {
          items.push(
            { label: 'New Scratch Note', icon: <NoteAddIcon sx={{ fontSize: 16 }} />, onClick: triggerQuickNote },
            { label: 'Search Note Directory', icon: <SearchIcon sx={{ fontSize: 16 }} />, onClick: focusGlobalSearch },
            { label: 'Go to Settings', icon: <SettingsIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/settings') }
          );
        } else if (appType === 'connect') {
          items.push(
            { label: 'New Frequency Chat', icon: <ChatIcon sx={{ fontSize: 16 }} />, onClick: () => openUnifiedDrawer('navbar') },
            { label: 'Search Users', icon: <SearchIcon sx={{ fontSize: 16 }} />, onClick: focusGlobalSearch },
            { label: 'Reload Channels', icon: <RefreshIcon sx={{ fontSize: 16 }} />, onClick: () => window.location.reload() }
          );
        } else if (appType === 'vault') {
          items.push(
            { label: 'Lock Crypt Vault', icon: <LockIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/vault/lock') },
            { label: 'Quick Capture Note', icon: <NoteAddIcon sx={{ fontSize: 16 }} />, onClick: triggerQuickNote },
            { label: 'Sync Engine', icon: <SyncIcon sx={{ fontSize: 16 }} />, onClick: () => showSuccess('Engine Synced', 'Active rows successfully validated.') }
          );
        } else {
          // General / Default options
          items.push(
            { label: 'Quick Capture Note', icon: <NoteAddIcon sx={{ fontSize: 16 }} />, onClick: triggerQuickNote },
            { label: 'Ecosystem Portal', icon: <FolderIcon sx={{ fontSize: 16 }} />, onClick: focusGlobalSearch },
            { label: 'Sync Vault', icon: <SyncIcon sx={{ fontSize: 16 }} />, onClick: () => showSuccess('Vault Synced', 'All encrypted local rows are in active alignment.') },
            { label: 'Go to Settings', icon: <SettingsIcon sx={{ fontSize: 16 }} />, onClick: () => router.push('/settings') }
          );
        }
      }

      setState({
        x: e.clientX,
        y: e.clientY,
        items,
        appType
      });
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, [pathname, router, showSuccess, openOverlay, upsertNote, openUnifiedDrawer]);

  const value = useMemo<ContextMenuContextType>(
    () => ({ openMenu, closeMenu, isOpen, state }),
    [openMenu, closeMenu, isOpen, state]
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenu = () => {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useContextMenu must be used within a ContextMenuProvider');
  return ctx;
};
