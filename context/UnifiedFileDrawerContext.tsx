'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface SyncedMediaFile {
  $id: string;
  name: string;
  bucketId: string;
  sizeOriginal: number;
  mimeType?: string;
  createdAt?: string;
  fileUrl?: string;
}

export type UnifiedFileDrawerMainTab = 'objects' | 'synced' | 'upload';
export type UnifiedFileDrawerObjectSubTab =
  | 'goals'
  | 'ideas'
  | 'projects'
  | 'threads'
  | 'totps'
  | 'forms'
  | 'events'
  | 'vault'
  | 'tags'
  | 'sessions';

interface OpenFileDrawerOptions {
  onSelectFile: (file: SyncedMediaFile) => void;
  allowedBuckets?: string[];
  title?: string;
  /** Open on Objects / Synced / Upload (default synced). */
  initialTab?: UnifiedFileDrawerMainTab;
  /** Objects sub-tab when initialTab is objects (default goals). */
  initialSubTab?: UnifiedFileDrawerObjectSubTab;
}

interface UnifiedFileDrawerContextType {
  isOpen: boolean;
  options: OpenFileDrawerOptions | null;
  openFileDrawer: (opts: OpenFileDrawerOptions) => void;
  closeFileDrawer: () => void;
}

const UnifiedFileDrawerContext = createContext<UnifiedFileDrawerContextType | undefined>(undefined);

export function UnifiedFileDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OpenFileDrawerOptions | null>(null);

  const openFileDrawer = useCallback((opts: OpenFileDrawerOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeFileDrawer = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  return (
    <UnifiedFileDrawerContext.Provider value={{ isOpen, options, openFileDrawer, closeFileDrawer }}>
      {children}
    </UnifiedFileDrawerContext.Provider>
  );
}

export function useUnifiedFileDrawer() {
  const ctx = useContext(UnifiedFileDrawerContext);
  if (!ctx) {
    throw new Error('useUnifiedFileDrawer must be used within a UnifiedFileDrawerProvider');
  }
  return ctx;
}
