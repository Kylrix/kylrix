'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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

  const openProUpgrade = (featureName?: string) => {
    setFeature(featureName || null);
    setShowProUpgrade(true);
  };

  const closeProUpgrade = () => {
    setShowProUpgrade(false);
    setFeature(null);
  };

  return (
    <ProUpgradeContext.Provider value={{ showProUpgrade, openProUpgrade, closeProUpgrade, feature }}>
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
