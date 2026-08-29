'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

interface FABAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
  href?: string;
}

export interface FABConfiguration {
  isVisible: boolean;
  mainIcon?: React.ReactNode;
  mainColor?: string;
  actions: FABAction[];
  onMainClick?: () => void;
  suppressWorkflow?: boolean;
}

interface FABContextType {
  config: FABConfiguration;
  setConfiguration: (config: Partial<FABConfiguration>) => void;
  resetConfiguration: () => void;
}

const DEFAULT_CONFIG: FABConfiguration = {
  isVisible: false,
  actions: [],
  mainColor: '#6366F1'};

const FABContext = createContext<FABContextType | undefined>(undefined);

export function FABProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FABConfiguration>(DEFAULT_CONFIG);

  const setConfiguration = useCallback((newConfig: Partial<FABConfiguration>) => {
    setConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (
        merged.isVisible === prev.isVisible &&
        merged.mainColor === prev.mainColor &&
        merged.mainIcon === prev.mainIcon &&
        merged.onMainClick === prev.onMainClick &&
        merged.suppressWorkflow === prev.suppressWorkflow &&
        merged.actions === prev.actions
      ) {
        return prev;
      }
      return merged;
    });
  }, []);

  const resetConfiguration = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const value = useMemo(() => ({
    config,
    setConfiguration,
    resetConfiguration}), [config, setConfiguration, resetConfiguration]);

  return (
    <FABContext.Provider value={value}>
      {children}
    </FABContext.Provider>
  );
}

export function useFAB() {
  const context = useContext(FABContext);
  if (!context) {
    throw new Error('useFAB must be used within a FABProvider');
  }
  return context;
}
