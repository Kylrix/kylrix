'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { UnifiedMediaViewer } from '@/components/objects/UnifiedMediaViewer';

interface MediaViewerState {
  isOpen: boolean;
  src: string;
  type?: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  title?: string;
  fileId?: string;
  bucketId?: string;
}

interface UnifiedMediaContextType {
  openMedia: (params: Omit<MediaViewerState, 'isOpen'>) => void;
  closeMedia: () => void;
}

const UnifiedMediaContext = createContext<UnifiedMediaContextType | undefined>(undefined);

export function UnifiedMediaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MediaViewerState>({
    isOpen: false,
    src: '',
    type: 'image',
    title: '',
  });

  const openMedia = useCallback((params: Omit<MediaViewerState, 'isOpen'>) => {
    setState({
      isOpen: true,
      ...params,
    });
  }, []);

  const closeMedia = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  React.useEffect(() => {
    const handleCustomOpen = (e: CustomEvent<Omit<MediaViewerState, 'isOpen'>>) => {
      if (e.detail) {
        openMedia(e.detail);
      }
    };
    window.addEventListener('kylrix:open-unified-media' as any, handleCustomOpen);
    return () => window.removeEventListener('kylrix:open-unified-media' as any, handleCustomOpen);
  }, [openMedia]);

  return (
    <UnifiedMediaContext.Provider value={{ openMedia, closeMedia }}>
      {children}
      {state.isOpen && (
        <UnifiedMediaViewer
          src={state.src}
          type={state.type}
          title={state.title}
          fileId={state.fileId}
          bucketId={state.bucketId}
          onClose={closeMedia}
        />
      )}
    </UnifiedMediaContext.Provider>
  );
}

export function useUnifiedMedia() {
  const context = useContext(UnifiedMediaContext);
  if (!context) throw new Error('useUnifiedMedia must be used within UnifiedMediaProvider');
  return context;
}
