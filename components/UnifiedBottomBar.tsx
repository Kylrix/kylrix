'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileText as NotesIcon,
  Target as GoalsIcon,
  Lock as VaultIcon,
  Settings as SettingsIcon,
  Plus,
  ChevronUp,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useFAB } from '@/context/FABContext';

/**
 * Persistent unified bottom bar with integrated central FAB.
 * Order: ideas → goals → [ CENTRAL FAB ] → vault → settings
 */
export function UnifiedBottomBar() {
  const pathname = usePathname();
  const { open: openUnified } = useUnifiedDrawer();
  const { config } = useFAB();

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      let maxScroll = scrollY;
      const scrollables = document.querySelectorAll('main, [data-scrollable="true"], .overflow-y-auto');
      scrollables.forEach((el) => {
        if (el instanceof HTMLElement && el.scrollTop > maxScroll) {
          maxScroll = el.scrollTop;
        }
      });
      if (maxScroll > 180) {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2500);
      } else {
        setIsScrolling(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [pathname]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollables = document.querySelectorAll('main, [data-scrollable="true"], .overflow-y-auto');
    scrollables.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    setIsScrolling(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:refresh-feed'));
    }
  }, []);

  const currentTab = useMemo(() => {
    if (pathname?.startsWith('/app') || pathname?.startsWith('/idea') || pathname?.startsWith('/notes')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/goal') || pathname?.startsWith('/events') || pathname?.startsWith('/event')) return 'goal';
    if (pathname?.startsWith('/forms') || pathname?.startsWith('/form')) return 'goal';
    if (pathname?.startsWith('/vault') || pathname?.startsWith('/totp') || pathname?.startsWith('/credentials')) return 'vault';
    if (pathname?.startsWith('/settings')) return 'settings';
    return null;
  }, [pathname]);

  const primarySurfaceColor = useMemo(() => {
    if (config.mainColor) return config.mainColor;
    if (pathname?.startsWith('/app') || pathname?.startsWith('/idea') || pathname?.startsWith('/notes')) return '#EC4899';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/goal')) return '#A855F7';
    if (pathname?.startsWith('/events') || pathname?.startsWith('/event')) return '#6366F1';
    if (pathname?.startsWith('/forms') || pathname?.startsWith('/form')) return '#6366F1';
    if (pathname?.startsWith('/vault') || pathname?.startsWith('/totp') || pathname?.startsWith('/credentials')) return '#10B981';
    if (pathname?.startsWith('/settings')) return '#6366F1';
    return '#EC4899';
  }, [pathname, config.mainColor]);

  const defaultMainClick = useCallback(() => {
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/goal')) {
      window.dispatchEvent(new CustomEvent('kylrix:open-create-goal'));
      return;
    }
    if (pathname?.startsWith('/events') || pathname?.startsWith('/event')) {
      window.dispatchEvent(new CustomEvent('kylrix:open-create-event'));
      return;
    }
    if (pathname?.startsWith('/vault') || pathname?.startsWith('/totp') || pathname?.startsWith('/credentials')) {
      window.dispatchEvent(new CustomEvent('kylrix:vault-add'));
      return;
    }
    // Default: unconditionally open note / object create drawer
    openUnified('note', { isPublic: false, isGuest: false });
  }, [pathname, openUnified]);

  const handleFabClick = useCallback(() => {
    if (config.onMainClick) {
      try {
        config.onMainClick();
        return;
      } catch (e) {
        console.error('Error invoking config.onMainClick:', e);
      }
    }
    defaultMainClick();
  }, [config, defaultMainClick]);

  const leftNavItems = [
    { key: 'note', route: '/app', icon: NotesIcon, label: 'Notes' },
    { key: 'goal', route: '/goals', icon: GoalsIcon, label: 'Goals' },
  ];

  const rightNavItems = [
    { key: 'vault', route: '/vault', icon: VaultIcon, label: 'Vault' },
    { key: 'settings', route: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  // Fixed persistent bottom navbar for the six core surfaces:
  // 1. idea (/app, /notes, /idea)
  // 2. form (/forms, /form)
  // 3. goals (/goals, /goal)
  // 4. events (/events, /event)
  // 5. secrets (/vault, /credentials)
  // 6. totp (/vault/totp, /totp)
  const isIdeaRoute = Boolean(
    pathname === '/app' ||
    pathname?.startsWith('/app/') ||
    pathname === '/idea' ||
    pathname?.startsWith('/idea/') ||
    pathname === '/notes' ||
    pathname?.startsWith('/notes/')
  );

  const isFormRoute = Boolean(
    pathname === '/forms' ||
    pathname?.startsWith('/forms/') ||
    pathname === '/form' ||
    pathname?.startsWith('/form/')
  );

  const isGoalsRoute = Boolean(
    pathname === '/goals' ||
    pathname?.startsWith('/goals/') ||
    pathname === '/goal' ||
    pathname?.startsWith('/goal/')
  );

  const isEventsRoute = Boolean(
    pathname === '/events' ||
    pathname?.startsWith('/events/') ||
    pathname === '/event' ||
    pathname?.startsWith('/event/')
  );

  const isSecretsRoute = Boolean(
    (pathname === '/vault' || pathname?.startsWith('/vault/') || pathname === '/credentials' || pathname?.startsWith('/credentials/')) &&
    !pathname?.startsWith('/vault/reset')
  );

  const isTotpRoute = Boolean(
    pathname === '/vault/totp' ||
    pathname?.startsWith('/vault/totp/') ||
    pathname === '/totp' ||
    pathname?.startsWith('/totp/')
  );

  const isAllowedSurface =
    isIdeaRoute ||
    isFormRoute ||
    isGoalsRoute ||
    isEventsRoute ||
    isSecretsRoute ||
    isTotpRoute;

  const isSpecificPostPage = Boolean(
    pathname?.match(/^\/connect\/post\/[^/]+$/) || pathname?.startsWith('/moment/')
  );
  const isSpecificProjectPage = Boolean(pathname?.match(/^\/workspace\/[^/]+$/));

  if (
    !isAllowedSurface ||
    isSpecificProjectPage ||
    isSpecificPostPage
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
          {leftNavItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentTab === item.key;
            const itemColor =
              item.key === 'vault'
                ? '#10B981'
                : item.key === 'goal'
                ? '#A855F7'
                : item.key === 'settings'
                ? '#6366F1'
                : '#EC4899';

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
                  color: isSelected ? itemColor : '#FFFFFF',
                  opacity: 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="relative flex items-center justify-center transition-all">
                  <Icon
                    size={22}
                    strokeWidth={isSelected ? 2.3 : 1.8}
                    className="transition-all duration-200"
                    style={{
                      color: isSelected ? itemColor : '#FFFFFF',
                      filter: isSelected ? `drop-shadow(0 0 6px ${itemColor}80)` : undefined,
                    }}
                  />
                  {isSelected && (
                    <div
                      className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full animate-fadeIn"
                      style={{ backgroundColor: itemColor }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-bold mt-1 tracking-tight font-satoshi transition-colors"
                  style={{
                    color: isSelected ? itemColor : '#FFFFFF',
                    fontFamily: 'var(--font-satoshi)',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* CENTRAL INTEGRATED FAB ITEM */}
          <div className="flex items-center justify-center px-1">
            <button
              type="button"
              onClick={handleFabClick}
              aria-label="Create new item"
              title="Create new item"
              className="flex items-center justify-center w-12 h-12 rounded-2xl text-black shadow-lg transition-all duration-300 active:scale-90 border border-black/20 cursor-pointer"
              style={{
                backgroundColor: primarySurfaceColor,
                boxShadow: `0 6px 20px ${primarySurfaceColor}66`,
              }}
            >
              {config.mainIcon || <Plus size={26} strokeWidth={3} className="text-black transition-transform duration-200" />}
            </button>
          </div>

          {rightNavItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentTab === item.key;
            const itemColor =
              item.key === 'vault'
                ? '#10B981'
                : item.key === 'goal'
                ? '#A855F7'
                : item.key === 'settings'
                ? '#6366F1'
                : '#EC4899';

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
                  color: isSelected ? itemColor : '#FFFFFF',
                  opacity: 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="relative flex items-center justify-center transition-all">
                  <Icon
                    size={22}
                    strokeWidth={isSelected ? 2.3 : 1.8}
                    className="transition-all duration-200"
                    style={{
                      color: isSelected ? itemColor : '#FFFFFF',
                      filter: isSelected ? `drop-shadow(0 0 6px ${itemColor}80)` : undefined,
                    }}
                  />
                  {isSelected && (
                    <div
                      className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full animate-fadeIn"
                      style={{ backgroundColor: itemColor }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-bold mt-1 tracking-tight font-satoshi transition-colors"
                  style={{
                    color: isSelected ? itemColor : '#FFFFFF',
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
