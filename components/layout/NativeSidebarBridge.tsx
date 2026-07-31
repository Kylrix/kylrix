'use client';

import React, { useEffect, useRef } from 'react';
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

/**
 * Bridges legacy overlays / drawers into the single native right sidebar host.
 */
export function NativeSidebarBridge() {
  const { open, close, dismiss, isOpen, activeKey, sticky } = useNativeSidebar();
  const overlay = useOverlay();
  const dynamic = useDynamicSidebar();
  const agentic = useAgenticDrawer();
  const wallet = useWalletOverlay();
  const unified = useUnifiedDrawer();
  const lastKeyRef = useRef<string | null>(null);

  const openRef = useRef(open);
  const closeRef = useRef(close);
  const dismissRef = useRef(dismiss);
  openRef.current = open;
  closeRef.current = close;
  dismissRef.current = dismiss;

  useEffect(() => {
    if (agentic.isOpen) {
      lastKeyRef.current = 'agentic';
      openRef.current(<AgenticPanelContent />, {
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
      lastKeyRef.current = 'wallet';
      openRef.current(
        <WalletSidebar
          isOpen
          embedded
          onClose={() => {
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

    if (!isUnifiedOverlayOnly(unified.activeContent)) {
      const key = `unified:${unified.activeContent}`;
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
          title: unified.activeContent.replace(/-/g, ' '),
          restore: {
            type: 'unified',
            payload: { content: unified.activeContent },
          },
        },
      );
      return;
    }

    if (dynamic.isOpen && dynamic.content) {
      const key = dynamic.activeContentKey || 'dynamic';
      lastKeyRef.current = key;
      openRef.current(
        <div className="h-full min-h-0 overflow-hidden flex flex-col bg-[#0A0908]">
          {dynamic.content}
        </div>,
        {
          key,
          width: dynamic.options?.fullscreen
            ? NATIVE_SIDEBAR_WIDTHS.wide
            : NATIVE_SIDEBAR_WIDTHS.detail,
          title: 'Detail',
          restore: {
            type: 'dynamic',
            payload: { key: dynamic.activeContentKey },
          },
        },
      );
      return;
    }

    if (overlay.isOpen && overlay.content) {
      lastKeyRef.current = 'overlay';
      openRef.current(
        <div className="h-full min-h-0 overflow-hidden flex flex-col bg-[#0A0908]">
          {overlay.content}
        </div>,
        {
          key: 'overlay',
          width: NATIVE_SIDEBAR_WIDTHS.wide,
          title: 'Detail',
          restore: { type: 'overlay' },
        },
      );
      return;
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
    dynamic.options?.fullscreen,
    overlay.isOpen,
    overlay.content,
    sticky,
    wallet,
    unified,
  ]);

  useEffect(() => {
    if (!isOpen && agentic.isOpen && lastKeyRef.current === 'agentic') {
      agentic.closeAgenticDrawer();
      lastKeyRef.current = null;
    }
  }, [isOpen, agentic]);

  void activeKey;

  return null;
}
