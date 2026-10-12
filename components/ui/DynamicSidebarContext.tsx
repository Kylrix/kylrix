'use client';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useRef,
  useEffect
} from 'react';

export interface DynamicSidebarOptions {
  hideHeader?: boolean;
  /** True = edge-to-edge viewport (idea/goal/event detail). */
  fullscreen?: boolean;
}

interface DynamicSidebarContextType {
  isOpen: boolean;
  content: ReactNode | null;
  activeContentKey: string | null;
  options: DynamicSidebarOptions | null;
  openSidebar: (content: ReactNode, key?: string | null, options?: DynamicSidebarOptions | null) => void;
  closeSidebar: () => void;
}

const DynamicSidebarContext = createContext<DynamicSidebarContextType | undefined>(undefined);

export function DynamicSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [activeContentKey, setActiveContentKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kylrixnote_dynamic_sidebar_key');
  });
  const [options, setOptions] = useState<DynamicSidebarOptions | null>(null);
  const stackRef = useRef<Array<{ content: ReactNode; key: string | null; options: DynamicSidebarOptions | null }>>([]);

  // Use refs to keep callbacks stable and prevent massive list re-renders
  const stateRef = useRef({ isOpen, activeContentKey });
  const contentRef = useRef<ReactNode | null>(null);
  const optionsRef = useRef<DynamicSidebarOptions | null>(null);
  
  useEffect(() => {
    stateRef.current = { isOpen, activeContentKey };
  }, [isOpen, activeContentKey]);

  useEffect(() => {
    contentRef.current = content;
    optionsRef.current = options;
  }, [content, options]);

  const openSidebar = useCallback(
    (newContent: ReactNode, key: string | null = null, newOptions: DynamicSidebarOptions | null = null) => {
      // Idempotent guard — prevents Maximum update depth when caller recreates JSX each render
      if (
        stateRef.current.isOpen &&
        stateRef.current.activeContentKey === key &&
        contentRef.current === newContent &&
        optionsRef.current === newOptions
      ) {
        return;
      }
      // Stackable: push current onto stack if already open and key actually changes
      if (stateRef.current.isOpen && contentRef.current && stateRef.current.activeContentKey !== key) {
        stackRef.current.push({ content: contentRef.current, key: stateRef.current.activeContentKey, options: optionsRef.current });
      }
      contentRef.current = newContent;
      optionsRef.current = newOptions;
      setContent(newContent);
      setActiveContentKey(key);
      setOptions(newOptions);
      setIsOpen(true);
      if (key) {
        localStorage.setItem('kylrixnote_dynamic_sidebar_key', key);
      }
    },
    []);

  const closeSidebar = useCallback(() => {
    // Pop stack if available — restores previous detail instead of closing entirely
    const prev = stackRef.current.pop();
    if (prev) {
      contentRef.current = prev.content;
      optionsRef.current = prev.options;
      stateRef.current = { isOpen: true, activeContentKey: prev.key };
      setContent(prev.content);
      setActiveContentKey(prev.key);
      setOptions(prev.options);
      setIsOpen(true);
      if (prev.key) localStorage.setItem('kylrixnote_dynamic_sidebar_key', prev.key);
      else localStorage.removeItem('kylrixnote_dynamic_sidebar_key');
      return;
    }
    contentRef.current = null;
    optionsRef.current = null;
    stateRef.current = { isOpen: false, activeContentKey: null };
    setIsOpen(false);
    setActiveContentKey(null);
    setOptions(null);
    localStorage.removeItem('kylrixnote_dynamic_sidebar_key');
    // Delay clearing content for exit animation
    setTimeout(() => {
      setContent(null);
      contentRef.current = null;
    }, 300);
  }, []);

  const providerValue = useMemo(
    () => ({ isOpen, content, activeContentKey, options, openSidebar, closeSidebar }),
    [isOpen, content, activeContentKey, options, openSidebar, closeSidebar]
  );

  return (
    <DynamicSidebarContext.Provider value={providerValue}>
      {children}
    </DynamicSidebarContext.Provider>
  );
}

export function useDynamicSidebar() {
  const context = useContext(DynamicSidebarContext);
  if (context === undefined) {
    throw new Error('useDynamicSidebar must be used within a DynamicSidebarProvider');
  }
  return context;
}
