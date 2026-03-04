'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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

  const handleSetLanguage = (lang: DocLanguage) => {
    setLanguage(lang);
    localStorage.setItem('kylrix-docs-lang', lang);
  };

  return (
    <DocsContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
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
