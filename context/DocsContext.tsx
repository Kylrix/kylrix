'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type DocLanguage = 'typescript' | 'go' | 'python' | 'dart';

interface DocsContextType {
  language: DocLanguage;
  setLanguage: (lang: DocLanguage) => void;
}

const DocsContext = createContext<DocsContextType | undefined>(undefined);

export const DocsProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<DocLanguage>('typescript');

  useEffect(() => {
    const saved = localStorage.getItem('kylrix-docs-lang') as DocLanguage;
    if (saved) {
        setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = useCallback((lang: DocLanguage) => {
    setLanguage(lang);
    localStorage.setItem('kylrix-docs-lang', lang);
  }, []);

  const contextValue = useMemo<DocsContextType>(
    () => ({ language, setLanguage: handleSetLanguage }),
    [language, handleSetLanguage]
  );

  return (
    <DocsContext.Provider value={contextValue}>
      {children}
    </DocsContext.Provider>
  );
};

export const useDocs = () => {
  const context = useContext(DocsContext);
  if (!context) {
    // Return a dummy if not in provider, though we should wrap the app
    return { language: 'typescript' as DocLanguage, setLanguage: () => {} };
  }
  return context;
};
