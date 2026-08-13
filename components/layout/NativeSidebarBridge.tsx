'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  NATIVE_SIDEBAR_WIDTHS,
  useNativeSidebar,
} from '@/context/RightRailContext';
import {
  isUnifiedOverlayOnly,
  UnifiedDrawerBody,
  unifiedDrawerWidth,
} from '@/components/overlays/UnifiedDrawerBody';
import { AgenticPanelContent } from '@/components/overlays/AgenticPanelContent';

const WalletSidebar = dynamic(
  () => import('@/components/overlays/WalletSidebar').then((m) => m.WalletSidebar),
  { ssr: false },
);

const DESKTOP_MQ = '(min-width: 768px)';

function useIsDesktopRail() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(DESKTOP_MQ);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return isDesktop;
}

/**
 * Bridges legacy overlays / drawers into the native right sidebar on desktop.
 * Mobile object details stay on Overlay / DynamicSidebar (true fullscreen drawers).
 */
export function NativeSidebarBridge() {
  const { open, close, dismiss, swap, isOpen, activeKey, sticky } = useNativeSidebar();
  const overlay = useOverlay();
  const dynamic = useDynamicSidebar();
  const agentic = useAgenticDrawer();
  const wallet = useWalletOverlay();
  const unified = useUnifiedDrawer();
  const isDesktop = useIsDesktopRail();
  const lastKeyRef = useRef<string | null>(null);
  const lastDynamicContentRef = useRef<React.ReactNode | null>(null);
  const lastOverlayContentRef = useRef<React.ReactNode | null>(null);

  const openRef = useRef(open);
  const closeRef = useRef(close);
  const dismissRef = useRef(dismiss);
  const swapRef = useRef(swap);

  useEffect(() => {
    openRef.current = open;
    closeRef.current = close;
    dismissRef.current = dismiss;
    swapRef.current = swap;
  }, [open, close, dismiss, swap]);

  useEffect(() => {
    if (agentic.isOpen) {
      if (!isDesktop) {
        if (lastKeyRef.current === 'agentic_mobile') return;
        lastKeyRef.current = 'agentic_mobile';
        overlay.openOverlay(
          <AgenticPanelContent
            isDesktop={false}
            onClose={() => {
              agentic.closeAgenticDrawer();
              overlay.closeOverlay();
            }}
          />
        );
        return;
      }

      if (lastKeyRef.current === 'agentic') return;
      lastKeyRef.current = 'agentic';
      openRef.current(
        <AgenticPanelContent
          isDesktop={isDesktop}
          onClose={() => {
            agentic.closeAgenticDrawer();
            dismissRef.current();
          }}
        />,
        {
        key: 'agentic',
        width: NATIVE_SIDEBAR_WIDTHS.default + 20,
        sticky: true,
        title: 'Kylie',
        restore: {
          type: 'agentic',
          payload: {
            prompt: agentic.pendingPrompt,
            autoRun: agentic.pendingAutoRun,
          },
        },
      });
      return;
    }

    if (wallet.isWalletOpen) {
      if (!isDesktop) {
        if (lastKeyRef.current === 'wallet_mobile') return;
        lastKeyRef.current = 'wallet_mobile';
        overlay.openOverlay(
          <WalletSidebar
            isOpen
            embedded
            onClose={() => {
              lastKeyRef.current = null;
              wallet.closeWallet();
              overlay.closeOverlay();
            }}
            tokenIntent={wallet.tokenIntent}
            onConsumeTokenIntent={wallet.consumeTokenIntent}
          />
        );
        return;
      }
      if (lastKeyRef.current === 'wallet') return;
      lastKeyRef.current = 'wallet';
      openRef.current(
        <WalletSidebar
          isOpen
          embedded
          onClose={() => {
            lastKeyRef.current = null;
            wallet.closeWallet();
            dismissRef.current();
          }}
          tokenIntent={wallet.tokenIntent}
          onConsumeTokenIntent={wallet.consumeTokenIntent}
        />,
        {
          key: 'wallet',
          width: NATIVE_SIDEBAR_WIDTHS.default,
          title: 'Wallet',
          restore: { type: 'wallet' },
        },
      );
      return;
    }

    if (isDesktop && !isUnifiedOverlayOnly(unified.activeContent)) {
      const key = `unified:${unified.activeContent}`;
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;
      openRef.current(
        <div className="h-full min-h-0 overflow-y-auto bg-[#0A0908]">
          <UnifiedDrawerBody
            activeContent={unified.activeContent}
            drawerData={unified.drawerData}
            onClose={() => {
              unified.close();
              dismissRef.current();
            }}
          />
        </div>,
        {
          key,
          width: unifiedDrawerWidth(unified.activeContent),
          sticky: unified.activeContent === 'agentic',
          title: unified.activeContent === 'new-project'
            ? 'New Workspace'
            : unified.activeContent.replace(/-/g, ' '),
          restore: {
            type: 'unified',
            payload: { content: unified.activeContent },
          },
        },
      );
      return;
    }

    // Mobile: object details use Overlay / DynamicSidebarPanel (edge-to-edge drawers).
    // Desktop: same content lives in the native right rail (never fullscreen).
    if (!isDesktop) {
      if ((dynamic.isOpen && dynamic.content) || (overlay.isOpen && overlay.content)) {
        const owned = lastKeyRef.current;
        if (owned && owned !== 'agentic') {
          lastKeyRef.current = null;
          closeRef.current(owned);
        }
        return;
      }
    } else {
      if (dynamic.isOpen && dynamic.content) {
        const key = dynamic.activeContentKey || 'dynamic';
        // Guard: key is the source of truth — content reference churn (inline JSX) must not retrigger swap loops.
        if (lastKeyRef.current !== key) {
          lastKeyRef.current = key;
          lastDynamicContentRef.current = dynamic.content;
          openRef.current(
            dynamic.content,
            {
              key,
              width: NATIVE_SIDEBAR_WIDTHS.detail,
              title: 'Detail',
              restore: {
                type: 'dynamic',
                payload: { key: dynamic.activeContentKey },
              },
            },
          );
        }
        return;
      }

      if (overlay.isOpen && overlay.content) {
        if (lastKeyRef.current !== 'overlay') {
          lastKeyRef.current = 'overlay';
          lastOverlayContentRef.current = overlay.content;
          openRef.current(
            overlay.content,
            {
              key: 'overlay',
              width: NATIVE_SIDEBAR_WIDTHS.detail,
              title: 'Detail',
              restore: { type: 'overlay' },
            },
          );
        }
        return;
      }
    }

    const owned = lastKeyRef.current;
    if (!owned) return;
    if (sticky && owned === 'agentic') {
      lastKeyRef.current = null;
      dismissRef.current();
      return;
    }
    if (!sticky) {
      lastKeyRef.current = null;
      closeRef.current(owned);
    }
  }, [
    agentic.isOpen,
    agentic.pendingPrompt,
    agentic.pendingAutoRun,
    wallet.isWalletOpen,
    unified.activeContent,
    unified.drawerData,
    dynamic.isOpen,
    dynamic.content,
    dynamic.activeContentKey,
    overlay.isOpen,
    overlay.content,
    sticky,
    isDesktop,
  ]);

  useEffect(() => {
    if (!isOpen && agentic.isOpen && lastKeyRef.current === 'agentic') {
      agentic.closeAgenticDrawer();
      lastKeyRef.current = null;
    }
  }, [isOpen, agentic.isOpen]);

  void activeKey;

  return null;
}
