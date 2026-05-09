'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WalletSidebar } from '@/components/overlays/WalletSidebar';

interface WalletOverlayContextType {
  isWalletOpen: boolean;
  openWallet: () => void;
  closeWallet: () => void;
}

const WalletOverlayContext = createContext<WalletOverlayContextType | undefined>(undefined);

export function WalletOverlayProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const openWallet = useCallback(() => setIsWalletOpen(true), []);
  const closeWallet = useCallback(() => setIsWalletOpen(false), []);

  useEffect(() => {
    if (searchParams.get('openWallet') !== 'true') return;
    setIsWalletOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openWallet');
    const nextQuery = params.toString();
    router.replace(pathname + (nextQuery ? `?${nextQuery}` : ''));
  }, [pathname, router, searchParams]);

  const value = useMemo<WalletOverlayContextType>(
    () => ({ isWalletOpen, openWallet, closeWallet }),
    [closeWallet, isWalletOpen, openWallet]
  );

  return (
    <WalletOverlayContext.Provider value={value}>
      {children}
      {isWalletOpen ? <WalletSidebar isOpen={isWalletOpen} onClose={closeWallet} /> : null}
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
