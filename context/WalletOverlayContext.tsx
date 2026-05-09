'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WalletSidebar } from '@/components/overlays/WalletSidebar';

interface WalletOverlayContextType {
  isWalletOpen: boolean;
  openWallet: () => void;
  openWalletWithIntent: (intent: TokenWalletIntent) => void;
  closeWallet: () => void;
}

export interface TokenWalletIntent {
  mode: 'send';
  toUser: { id: string; username: string; displayName: string } | null;
}

const WalletOverlayContext = createContext<WalletOverlayContextType | undefined>(undefined);

export function WalletOverlayProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [tokenIntent, setTokenIntent] = useState<TokenWalletIntent | null>(null);

  const openWallet = useCallback(() => setIsWalletOpen(true), []);
  const openWalletWithIntent = useCallback((intent: TokenWalletIntent) => {
    setTokenIntent(intent);
    setIsWalletOpen(true);
  }, []);
  const closeWallet = useCallback(() => setIsWalletOpen(false), []);
  const consumeTokenIntent = useCallback(() => setTokenIntent(null), []);

  useEffect(() => {
    if (searchParams.get('openWallet') !== 'true') return;
    setIsWalletOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openWallet');
    const nextQuery = params.toString();
    router.replace(pathname + (nextQuery ? `?${nextQuery}` : ''));
  }, [pathname, router, searchParams]);

  const value = useMemo<WalletOverlayContextType>(
    () => ({ isWalletOpen, openWallet, openWalletWithIntent, closeWallet }),
    [closeWallet, isWalletOpen, openWallet, openWalletWithIntent]
  );

  return (
    <WalletOverlayContext.Provider value={value}>
      {children}
      {isWalletOpen ? (
        <WalletSidebar
          isOpen={isWalletOpen}
          onClose={closeWallet}
          tokenIntent={tokenIntent}
          onConsumeTokenIntent={consumeTokenIntent}
        />
      ) : null}
    </WalletOverlayContext.Provider>
  );
}

export function useWalletOverlay() {
  const context = useContext(WalletOverlayContext);
  if (!context) {
    throw new Error('useWalletOverlay must be used within a WalletOverlayProvider');
  }
  return context;
}
