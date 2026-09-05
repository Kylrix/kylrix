'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileText as NotesIcon,
  Target as GoalsIcon,
  Lock as VaultIcon,
  Settings as SettingsIcon,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';

/**
 * Persistent unified bottom bar.
 * Order: ideas → goals → vault → settings
 */
export function UnifiedBottomBar() {
  const pathname = usePathname();
  const { activeContent } = useUnifiedDrawer();
  const { mode } = useAppChrome();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isOverlayOpen } = useOverlay();

  const appContext = useMemo(() => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/events') || pathname?.startsWith('/goal')) return 'goal';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/settings')) return 'settings';
    return null;
  }, [pathname]);

  const appColor = useMemo(() => {
    switch (appContext) {
      case 'vault':
        return '#10B981';
      case 'goal':
        return '#A855F7';
      case 'settings':
        return '#6366F1';
      case 'note':
      default:
        return '#EC4899';
    }
  }, [appContext]);

  const currentTab = useMemo(() => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/events') || pathname?.startsWith('/goal')) return 'goal';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/settings')) return 'settings';
    return null;
  }, [pathname]);

  const navItems = [
    { key: 'note', route: '/app', icon: NotesIcon, label: 'Notes' },
    { key: 'goal', route: '/goals', icon: GoalsIcon, label: 'Goals' },
    { key: 'vault', route: '/vault', icon: VaultIcon, label: 'Vault' },
    { key: 'settings', route: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];


  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/app\/notes\/[^/]+$/));
  const isSpecificPostPage = Boolean(pathname?.match(/^\/connect\/post\/[^/]+$/));
  const isSpecificProjectPage = Boolean(pathname?.match(/^\/workspace\/[^/]+$/));
  const isPublicFormPage = Boolean(pathname?.match(/^\/form\/[^/]+$/));
  // Public shared idea pages only (/idea/:id) — do not match app routes
  const isPublicIdeaPage = Boolean(pathname?.match(/^\/idea\/[^/]+$/));

  const contextMenu = useContextMenu();

  if (pathname?.startsWith('/accounts')) return null;

  if (
    isSpecificProjectPage ||
    isPublicFormPage ||
    isSpecificPostPage ||
    isPublicIdeaPage ||
    pathname?.includes('/settings') ||
    activeContent !== 'navbar' ||
    mode === 'compact' ||
    isDrawerOpen ||
    isNoteFullPageDetail ||
    isOverlayOpen ||
    contextMenu?.isOpen
  ) {
    return null;
  }

  return (
    <footer
      className="fixed left-0 right-0 bottom-0 z-[1300] block md:hidden pointer-events-auto select-none"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="w-full bg-[#000000] border-t-2 border-[#FFFFFF]/30 rounded-t-[24px] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <nav className="flex w-full items-center justify-around h-[64px]" aria-label="Bottom Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentTab === item.key;
            return (
              <Link
                key={item.key}
                href={item.route}
                onClick={(e) => {
                  if (pathname === item.route) {
                    e.preventDefault();
                  }
                }}

                className="flex flex-col items-center justify-center flex-1 h-full py-1 rounded-xl transition-transform active:scale-95 cursor-pointer no-underline group"
                style={{
                  color: isSelected ? appColor : '#FFFFFF',
                  opacity: 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div
                  className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-[#161412] border-2 border-[#FFFFFF] shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                      : 'bg-[#161412] border border-[#FFFFFF]/40 hover:border-[#FFFFFF] hover:bg-[#201D1A]'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={isSelected ? 2.2 : 1.8}
                    className="transition-colors duration-200"
                    style={{
                      color: isSelected ? appColor : '#FFFFFF',
                    }}
                  />
                  {isSelected && (
                    <div
                      className="absolute -bottom-1 w-1.5 h-1.5 rounded-full animate-fadeIn"
                      style={{ backgroundColor: appColor }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-bold mt-1 tracking-tight font-satoshi transition-colors"
                  style={{
                    color: isSelected ? appColor : '#FFFFFF',
                    fontFamily: 'var(--font-satoshi)',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
