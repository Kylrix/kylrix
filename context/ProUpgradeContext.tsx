'use client';

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

interface ProUpgradeContextType {
  showProUpgrade: boolean;
  openProUpgrade: (feature?: string) => void;
  closeProUpgrade: () => void;
  feature: string | null;
}

const ProUpgradeContext = createContext<ProUpgradeContextType | undefined>(undefined);

export function ProUpgradeProvider({ children }: { children: ReactNode }) {
  const [showProUpgrade, setShowProUpgrade] = useState(false);
  const [feature, setFeature] = useState<string | null>(null);

  const openProUpgrade = useCallback((featureName?: string) => {
    setFeature(featureName || null);
    setShowProUpgrade(true);
  }, []);

  const closeProUpgrade = useCallback(() => {
    setShowProUpgrade(false);
    setFeature(null);
  }, []);

  const contextValue = useMemo<ProUpgradeContextType>(
    () => ({ showProUpgrade, openProUpgrade, closeProUpgrade, feature }),
    [showProUpgrade, openProUpgrade, closeProUpgrade, feature]
  );

  return (
    <ProUpgradeContext.Provider value={contextValue}>
      {children}
    </ProUpgradeContext.Provider>
  );
}

export function useProUpgrade() {
  const context = useContext(ProUpgradeContext);
  if (!context) {
    return {
      showProUpgrade: false,
      openProUpgrade: () => {},
      closeProUpgrade: () => {},
      feature: null,
    };
  }
  return context;
}
