'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';

interface WalletOverlayContextType {
  isWalletOpen: boolean;
  tokenIntent: TokenWalletIntent | null;
  openWallet: () => void;
  openWalletWithIntent: (intent: TokenWalletIntent) => void;
  closeWallet: () => void;
  consumeTokenIntent: () => void;
}

export interface TokenWalletIntent {
  mode: 'send';
  toUser: { id: string; username: string; displayName: string } | null;
}

const WalletOverlayContext = createContext<WalletOverlayContextType | undefined>(undefined);

/** Isolate useSearchParams so the outer Provider never suspends away from consumers. */
function OpenWalletFromQueryEffect({
  pathname,
  onOpenRequested,
}: {
  pathname: string;
  onOpenRequested: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('openWallet') !== 'true') return;
    onOpenRequested();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openWallet');
    const nextQuery = params.toString();
    router.replace(pathname + (nextQuery ? `?${nextQuery}` : ''));
  }, [onOpenRequested, pathname, router, searchParams]);

  return null;
}

export function WalletOverlayProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [tokenIntent, setTokenIntent] = useState<TokenWalletIntent | null>(null);

  const openWallet = useCallback(() => setIsWalletOpen(true), []);
  const openWalletWithIntent = useCallback((intent: TokenWalletIntent) => {
    setTokenIntent(intent);
    setIsWalletOpen(true);
  }, []);
  const closeWallet = useCallback(() => setIsWalletOpen(false), []);
  const consumeTokenIntent = useCallback(() => setTokenIntent(null), []);

  const value = useMemo<WalletOverlayContextType>(
    () => ({
      isWalletOpen,
      tokenIntent,
      openWallet,
      openWalletWithIntent,
      closeWallet,
      consumeTokenIntent,
    }),
    [
      closeWallet,
      consumeTokenIntent,
      isWalletOpen,
      openWallet,
      openWalletWithIntent,
      tokenIntent,
    ],
  );

  return (
    <WalletOverlayContext.Provider value={value}>
      <SubscriptionProvider>
        {children}
        <Suspense fallback={null}>
          <OpenWalletFromQueryEffect pathname={pathname} onOpenRequested={openWallet} />
        </Suspense>
      </SubscriptionProvider>
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
