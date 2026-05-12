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
import dynamic from 'next/dynamic';

/**
 * Heavy crypto deps (ethers, @solana/web3.js, @mysten/sui, bitcoinjs-lib, bip32/39, …) are
 * transitively imported from WalletSidebar. Loading it eagerly forces every route to ship
 * that crypto graph in its initial JS bundle. Code-splitting it keeps the wallet code in its
 * own chunk that only loads when a user actually opens the wallet overlay.
 */
const WalletSidebar = dynamic(
  () => import('@/components/overlays/WalletSidebar').then((m) => ({ default: m.WalletSidebar })),
  { ssr: false }
);

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
    () => ({ isWalletOpen, openWallet, openWalletWithIntent, closeWallet }),
    [closeWallet, isWalletOpen, openWallet, openWalletWithIntent]
  );

  return (
    <WalletOverlayContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <OpenWalletFromQueryEffect pathname={pathname} onOpenRequested={openWallet} />
      </Suspense>
      <WalletSidebar
        isOpen={isWalletOpen}
        onClose={closeWallet}
        tokenIntent={tokenIntent}
        onConsumeTokenIntent={consumeTokenIntent}
      />
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
