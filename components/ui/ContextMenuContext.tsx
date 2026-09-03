"use client";

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  FileText,
  Search,
  RefreshCw,
  Settings,
  Lock,
  MessageSquare,
  Sparkles,
  Sliders,
  Share2,
  ExternalLink,
  Copy,
  Plus,
  CheckCircle2,
  Layers,
  Shield,
  Bot,
  Users
} from 'lucide-react';

import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { isFlowPath } from '@/lib/routing/app-paths';
import { ContextMenuPanel } from '@/components/ui/ContextMenu';
import type { KylrixApp } from '@/sdk/design';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: (e?: any) => void | Promise<void>;
  submenu?: ContextMenuItem[];
  variant?: 'default' | 'destructive';
  keepOpen?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  appType?: KylrixApp;
  title?: string;
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
  const { setIsDrawerOpen } = useDrawerState();
  const isOpen = !!state;

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  const closeMenu = useCallback(() => {
    setState(null);
  }, []);
  
  // Track if a component already handled this context menu event
  const menuOpenedInCurrentTick = useRef(false);

  const openMenu = useCallback((s: MenuState) => {
    setState(s);
    menuOpenedInCurrentTick.current = true;
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const { showSuccess } = useToast();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();

  // Global listener for ESC key
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, closeMenu]);

  // Global contextmenu listener with intelligent adaptive scoping
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) {
        return;
      }

      // If a specific React component (like MomentCard, NoteCard, GoalRow) handled the menu, do not override
      if (menuOpenedInCurrentTick.current) {
        menuOpenedInCurrentTick.current = false;
        return;
      }

      e.preventDefault();

      // Determine sub-app theme based on path
      let appType: KylrixApp = 'kylrix';
      if (pathname?.startsWith('/app')) appType = 'note';
      else if (pathname?.startsWith('/connect')) appType = 'connect';
      else if (pathname?.startsWith('/vault')) appType = 'vault';
      else if (isFlowPath(pathname) || pathname?.startsWith('/goals') || pathname?.startsWith('/flows')) appType = 'flow';
      else if (pathname?.startsWith('/accounts') || pathname?.startsWith('/settings')) appType = 'accounts';

      // 1. Identify clicked component target
      const target = e.target as HTMLElement;

      // Check if user has highlighted text on the page
      const selectedText = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
      if (selectedText && selectedText.length > 0) {
        const titleSnippet = selectedText.length > 28 ? `"${selectedText.slice(0, 25)}..."` : `"${selectedText}"`;
        const selectionItems: ContextMenuItem[] = [
          {
            label: 'Copy Selected Text',
            icon: <Copy size={16} />,
            onClick: () => {
              navigator.clipboard.writeText(selectedText);
              showSuccess('Copied', 'Selection copied to clipboard');
            },
          },
          {
            label: 'Create Note with Selection',
            icon: <FileText size={16} />,
            onClick: () => {
              try {
                window.localStorage.setItem('kylrix:draft:prefill', selectedText);
              } catch {}
              openUnifiedDrawer('note');
            },
          },
          {
            label: 'Search Selection in Kylrix',
            icon: <Search size={16} />,
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('kylrix:open-topbar-search', {
                    detail: { mode: 'all', placeholder: `Search "${selectedText.slice(0, 20)}"...` }
                  })
                );
              }
            },
          },
        ];

        setState({
          x: e.clientX,
          y: e.clientY,
          title: `Selection: ${titleSnippet}`,
          items: selectionItems,
          appType,
        });
        return;
      }

      // Check if right-clicking on an image/media element
      const imgElement = target.closest('img') as HTMLImageElement | null;
      if (imgElement && imgElement.src) {
        const src = imgElement.src;
        const mediaItems: ContextMenuItem[] = [
          {
            label: 'Open Image Full View',
            icon: <ExternalLink size={16} />,
            onClick: () => window.open(src, '_blank'),
          },
          {
            label: 'Copy Image URL',
            icon: <Share2 size={16} />,
            onClick: () => {
              navigator.clipboard.writeText(src);
              showSuccess('Copied', 'Image link copied to clipboard');
            },
          },
        ];

        setState({
          x: e.clientX,
          y: e.clientY,
          title: 'Media Actions',
          items: mediaItems,
          appType,
        });
        return;
      }

      const isSidebar = target.closest('[data-testid="sidebar"]') || target.closest('aside');
      const isTopbar = target.closest('header') || target.closest('#connect-topbar');

      const items: MenuState['items'] = [];
      let menuTitle = 'Quick Actions';

      const focusGlobalSearch = (placeholder?: string) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kylrix:open-topbar-search', {
              detail: { mode: 'all', placeholder: placeholder || 'Search Kylrix ecosystem...' }
            })
          );
        }
      };

      if (isSidebar) {
        menuTitle = 'Navigation Hub';
        items.push(
          { label: 'Notes & Ideas', icon: <FileText size={16} />, onClick: () => router.push('/app') },
          { label: 'Connect Hub', icon: <MessageSquare size={16} />, onClick: () => router.push('/connect') },
          { label: 'Goals & Tasks', icon: <CheckCircle2 size={16} />, onClick: () => router.push('/goals') },
          { label: 'Security Vault', icon: <Lock size={16} />, onClick: () => router.push('/vault') },
          { label: 'Workspaces', icon: <Layers size={16} />, onClick: () => router.push('/workspaces') },
          { label: 'Settings', icon: <Settings size={16} />, onClick: () => router.push('/settings') }
        );
      } else if (isTopbar) {
        menuTitle = 'Topbar Actions';
        items.push(
          { label: 'Universal Search', icon: <Search size={16} />, onClick: () => focusGlobalSearch() },
          { label: 'Quick Capture Note', icon: <Plus size={16} />, onClick: () => openUnifiedDrawer('note') },
          { label: 'Explore Workspaces', icon: <Layers size={16} />, onClick: () => router.push('/workspaces') }
        );
      } else {
        // Highly contextual per-route actions
        if (appType === 'connect') {
          menuTitle = 'Connect Hub';
          items.push(
            {
              label: 'Create New Moment',
              icon: <Sparkles size={16} className="text-amber-400" />,
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('kylrix:open-moment-composer'));
                }
              },
            },
            {
              label: 'Feed Settings & Topics',
              icon: <Sliders size={16} />,
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('kylrix:open-feed-settings'));
                }
              },
            },
            {
              label: 'Search Feed & Topics',
              icon: <Search size={16} />,
              onClick: () => focusGlobalSearch('Search feed moments, topics, and authors...'),
            },
            {
              label: 'Refresh Live Stream',
              icon: <RefreshCw size={16} />,
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('kylrix:feed-refresh'));
                }
              },
            },
            {
              label: 'Chats & Hangouts',
              icon: <MessageSquare size={16} />,
              onClick: () => openUnifiedDrawer('hangouts'),
            }
          );
        } else if (appType === 'note') {
          menuTitle = 'Notes & Ideas';
          items.push(
            { label: 'New Scratch Note', icon: <Plus size={16} className="text-amber-400" />, onClick: () => openUnifiedDrawer('note') },
            { label: 'Search Notes Directory', icon: <Search size={16} />, onClick: () => focusGlobalSearch('Search notes, tags, and ideas...') },
            { label: 'Workspaces Hub', icon: <Layers size={16} />, onClick: () => router.push('/workspaces') },
            { label: 'Settings', icon: <Settings size={16} />, onClick: () => router.push('/settings') }
          );
        } else if (appType === 'vault') {
          menuTitle = 'Security Vault';
          items.push(
            { label: 'Add Password / Secret', icon: <Plus size={16} className="text-emerald-400" />, onClick: () => router.push('/vault?action=new') },
            { label: 'Add 2FA TOTP Code', icon: <Shield size={16} />, onClick: () => router.push('/vault/totp?action=new') },
            { label: 'Security & Passkeys', icon: <Settings size={16} />, onClick: () => router.push('/settings?tab=security') }
          );
        } else if (appType === 'flow') {
          menuTitle = 'Goals & Workflows';
          items.push(
            { label: 'New Goal / Task', icon: <Plus size={16} className="text-emerald-400" />, onClick: () => router.push('/tasks?action=new') },
            { label: 'Create Workflow', icon: <Layers size={16} />, onClick: () => router.push('/flows') },
            { label: 'Notes & Ideas', icon: <FileText size={16} />, onClick: () => router.push('/app') }
          );
        } else if (appType === 'accounts') {
          menuTitle = 'Settings & Identity';
          items.push(
            { label: 'Account & Profile', icon: <Users size={16} />, onClick: () => router.push('/settings') },
            { label: 'Security & Masterpass', icon: <Lock size={16} />, onClick: () => router.push('/settings?tab=security') },
            { label: 'AI Autonomous Agents', icon: <Bot size={16} />, onClick: () => router.push('/settings/agents') }
          );
        } else {
          menuTitle = 'Quick Actions';
          items.push(
            { label: 'Quick Capture Note', icon: <Plus size={16} />, onClick: () => openUnifiedDrawer('note') },
            { label: 'Universal Search', icon: <Search size={16} />, onClick: () => focusGlobalSearch() },
            { label: 'Connect Stream', icon: <MessageSquare size={16} />, onClick: () => router.push('/connect') },
            { label: 'Settings', icon: <Settings size={16} />, onClick: () => router.push('/settings') }
          );
        }
      }

      setState({
        x: e.clientX,
        y: e.clientY,
        title: menuTitle,
        items,
        appType
      });
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, [pathname, router, showSuccess, openUnifiedDrawer]);

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
  return ctx || null;
};
