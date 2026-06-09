"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getEcosystemUrl } from '@/constants/ecosystem';

interface EcosystemContextType {
  authUri: string;
  getAppUri: (app: string) => string;
  isLocalhost: boolean;
}

const defaultContext: EcosystemContextType = {
  authUri: '/accounts',
  getAppUri: (app: string) => {
    const pathMap: Record<string, string> = {
      'accounts': '/accounts',
      'note': '/note',
      'vault': '/vault',
      'flow': '/flow',
      'connect': '/connect'
    };
    return pathMap[app] || '/' + app;
  },
  isLocalhost: false,
};

const EcosystemContext = createContext<EcosystemContextType>(defaultContext);

export function EcosystemProvider({ children }: { children: React.ReactNode }) {
  const [contextValue, setContextValue] = useState<EcosystemContextType>(defaultContext);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    
    setContextValue({
      authUri: getEcosystemUrl('accounts'),
      getAppUri: (app: string) => getEcosystemUrl(app),
      isLocalhost: isLocal,
    });
  }, []);

  return (
    <EcosystemContext.Provider value={contextValue}>
      {children}
    </EcosystemContext.Provider>
  );
}

export function useEcosystem() {
  return useContext(EcosystemContext);
}
