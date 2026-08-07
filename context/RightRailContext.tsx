'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useAuth } from '@/context/auth/AuthContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  emptySidebarMemory,
  routeKeyFromPathname,
  SIDEBAR_MEMORY_CACHE_KEY,
  type RouteSidebarMemory,
  type SidebarMemoryDoc,
  type SidebarRestoreHint,
} from '@/lib/sidebar/native-sidebar-memory';
import { getSettings, updateSettings, createSettings } from '@/lib/appwrite/note';

export type NativeSidebarOpenOptions = {
  key?: string;
  width?: number;
  /** Stubborn surfaces (agentic) survive route changes until explicit close */
  sticky?: boolean;
  /** Serializable hint for cross-device restore */
  restore?: SidebarRestoreHint | null;
  title?: string;
};

type NativeSidebarContextType = {
  isOpen: boolean;
  width: number;
  content: ReactNode | null;
  activeKey: string | null;
  sticky: boolean;
  title: string | null;
  open: (content: ReactNode, options?: NativeSidebarOpenOptions) => void;
  /** Instant swap — same shell, new body (no unload of host) */
  swap: (content: ReactNode, options?: NativeSidebarOpenOptions) => void;
  close: (key?: string) => void;
  /** Force-close even sticky (user X / dismiss) */
  dismiss: () => void;
};

/** Stable API only — mounts must not subscribe to `content` or they loop. */
type NativeSidebarApi = {
  open: NativeSidebarContextType['open'];
  swap: NativeSidebarContextType['swap'];
  close: NativeSidebarContextType['close'];
  dismiss: NativeSidebarContextType['dismiss'];
  getActiveKey: () => string | null;
};

const NativeSidebarContext = createContext<NativeSidebarContextType | undefined>(
  undefined,
);

const NativeSidebarApiContext = createContext<NativeSidebarApi | null>(null);

const DEFAULT_WIDTH = 420;
const DETAIL_WIDTH = 560;
const WIDE_WIDTH = 720;

export const NATIVE_SIDEBAR_WIDTHS = {
  default: DEFAULT_WIDTH,
  detail: DETAIL_WIDTH,
  wide: WIDE_WIDTH,
  compact: 380,
} as const;

/**
 * Unified native right sidebar — one host, instant content swap.
 * Pushes page content; contracts primary left nav without clobbering user preference.
 */
export function NativeSidebarProvider({ children }: { children: ReactNode }) {
  const { acquireRightRail, releaseRightRail } = useSidebar();
  const { user } = useAuth();
  const pathname = usePathname();
  const [content, setContent] = useState<ReactNode | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [sticky, setSticky] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const stickyRef = useRef(false);
  const restoreRef = useRef<SidebarRestoreHint | null>(null);
  const contentRef = useRef<ReactNode | null>(null);
  const widthRef = useRef<number>(DEFAULT_WIDTH);
  const titleRef = useRef<string | null>(null);
  const memoryRef = useRef<SidebarMemoryDoc>(emptySidebarMemory());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistMemory = useCallback(
    (doc: SidebarMemoryDoc) => {
      memoryRef.current = doc;
      const userId = user?.$id;
      if (!userId) return;
      void LocalEngine.cacheSet(SIDEBAR_MEMORY_CACHE_KEY(userId), doc);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const row = await getSettings(userId);
            let existing: any = {};
            if (row?.settings) {
              try {
                existing = JSON.parse(row.settings);
              } catch {
                existing = {};
              }
            }
            existing.sidebarMemory = doc;
            const payload = { settings: JSON.stringify(existing) };
            if (row) await updateSettings(userId, payload);
            else await createSettings({ userId, settings: payload.settings });
          } catch {
            /* offline / first run */
          }
        })();
      }, 800);
    },
    [user?.$id],
  );

  const writeRouteMemory = useCallback(
    (entry: RouteSidebarMemory | null) => {
      const route = routeKeyFromPathname(pathname);
      const next: SidebarMemoryDoc = {
        ...memoryRef.current,
        byRoute: { ...memoryRef.current.byRoute },
        updatedAt: Date.now(),
      };
      if (entry?.key) next.byRoute[route] = { ...entry, updatedAt: Date.now() };
      else delete next.byRoute[route];
      persistMemory(next);
    },
    [pathname, persistMemory],
  );

  const writeAgenticMemory = useCallback(
    (open: boolean, prompt?: string | null, autoRun?: boolean) => {
      const next: SidebarMemoryDoc = {
        ...memoryRef.current,
        agentic: {
          open,
          prompt: prompt ?? null,
          autoRun: Boolean(autoRun),
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      };
      persistMemory(next);
    },
    [persistMemory],
  );

  // Hydrate from LocalEngine → settings
  useEffect(() => {
    if (!user?.$id) return;
    let cancelled = false;
    (async () => {
      const local = await LocalEngine.cacheGet<SidebarMemoryDoc>(
        SIDEBAR_MEMORY_CACHE_KEY(user.$id),
      );
      if (local && !cancelled) memoryRef.current = local;
      try {
        const row = await getSettings(user.$id);
        if (!row?.settings || cancelled) return;
        const config = JSON.parse(row.settings);
        if (config.sidebarMemory) {
          memoryRef.current = {
            ...emptySidebarMemory(),
            ...config.sidebarMemory,
            byRoute: {
              ...(local?.byRoute || {}),
              ...(config.sidebarMemory.byRoute || {}),
            },
          };
          void LocalEngine.cacheSet(
            SIDEBAR_MEMORY_CACHE_KEY(user.$id),
            memoryRef.current,
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.$id]);

  const applyOpen = useCallback(
    (next: ReactNode, options?: NativeSidebarOpenOptions, mode: 'open' | 'swap' = 'open') => {
      const nextKey = options?.key ?? 'native';
      const nextSticky = Boolean(options?.sticky);
      const nextWidth = options?.width ?? DEFAULT_WIDTH;
      const nextTitle = options?.title ?? null;
      // Idempotent guard — prevents Maximum update depth when bridge re-calls open with same key/content
      // Use refs (not state) so guard is stable across renders and avoids stale closure loops.
      if (
        keyRef.current === nextKey &&
        contentRef.current === next &&
        stickyRef.current === nextSticky &&
        widthRef.current === nextWidth &&
        titleRef.current === nextTitle
      ) {
        return;
      }
      if (mode === 'open' || keyRef.current !== nextKey) {
        if (keyRef.current && keyRef.current !== nextKey) {
          releaseRightRail(keyRef.current);
        }
        keyRef.current = nextKey;
        setActiveKey((prev) => (prev === nextKey ? prev : nextKey));
        acquireRightRail(nextKey);
      }
      stickyRef.current = nextSticky;
      restoreRef.current = options?.restore ?? null;
      widthRef.current = nextWidth;
      titleRef.current = nextTitle;
      contentRef.current = next;
      setSticky((prev) => (prev === nextSticky ? prev : nextSticky));
      setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      setTitle((prev) => (prev === nextTitle ? prev : nextTitle));
      setContent((prev) => (prev === next ? prev : next));

      writeRouteMemory({
        key: nextKey,
        width: nextWidth,
        sticky: nextSticky,
        restore: options?.restore ?? null,
      });

      if (nextKey === 'agentic' || nextSticky) {
        writeAgenticMemory(
          true,
          (options?.restore?.payload?.prompt as string) || null,
          Boolean(options?.restore?.payload?.autoRun),
        );
      }
    },
    [acquireRightRail, releaseRightRail, writeRouteMemory, writeAgenticMemory],
  );

  const open = useCallback(
    (next: ReactNode, options?: NativeSidebarOpenOptions) => {
      applyOpen(next, options, 'open');
    },
    [applyOpen],
  );

  const swap = useCallback(
    (next: ReactNode, options?: NativeSidebarOpenOptions) => {
      applyOpen(next, options, 'swap');
    },
    [applyOpen],
  );

  const dismiss = useCallback(() => {
    const wasAgentic = keyRef.current === 'agentic' || stickyRef.current;
    if (keyRef.current) releaseRightRail(keyRef.current);
    keyRef.current = null;
    stickyRef.current = false;
    restoreRef.current = null;
    contentRef.current = null;
    widthRef.current = DEFAULT_WIDTH;
    titleRef.current = null;
    setActiveKey(null);
    setSticky(false);
    setContent(null);
    setTitle(null);
    setWidth(DEFAULT_WIDTH);
    writeRouteMemory(null);
    if (wasAgentic) writeAgenticMemory(false);
  }, [releaseRightRail, writeRouteMemory, writeAgenticMemory]);

  const close = useCallback(
    (key?: string) => {
      if (key && keyRef.current && key !== keyRef.current) return;
      // Soft close (no key) ignored while sticky — use dismiss()
      if (!key && stickyRef.current) return;
      dismiss();
    },
    [dismiss],
  );

  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    if (stickyRef.current) return;
    if (keyRef.current) dismiss();
  }, [pathname, dismiss]);

  useEffect(() => {
    return () => {
      if (keyRef.current) releaseRightRail(keyRef.current);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [releaseRightRail]);

  const value = useMemo(
    () => ({
      isOpen: content !== null,
      width,
      content,
      activeKey,
      sticky,
      title,
      open,
      swap,
      close,
      dismiss,
    }),
    [content, width, activeKey, sticky, title, open, swap, close, dismiss],
  );

  const apiValue = useMemo<NativeSidebarApi>(
    () => ({
      open,
      swap,
      close,
      dismiss,
      getActiveKey: () => keyRef.current,
    }),
    [open, swap, close, dismiss],
  );

  return (
    <NativeSidebarApiContext.Provider value={apiValue}>
      <NativeSidebarContext.Provider value={value}>
        {children}
      </NativeSidebarContext.Provider>
    </NativeSidebarApiContext.Provider>
  );
}

export function useNativeSidebar() {
  const ctx = useContext(NativeSidebarContext);
  if (!ctx) {
    throw new Error('useNativeSidebar must be used within a NativeSidebarProvider');
  }
  return ctx;
}

/** API-only — safe for mounts/topbar (does not re-render on content swaps). */
export function useNativeSidebarApiOptional() {
  return useContext(NativeSidebarApiContext);
}

export function useNativeSidebarOptional() {
  return useContext(NativeSidebarContext);
}

/** @deprecated use useNativeSidebar — kept for Sudo / RightRail callers */
export function useRightRail() {
  const native = useNativeSidebar();
  return {
    isOpen: native.isOpen,
    width: native.width,
    content: native.content,
    activeKey: native.activeKey,
    open: native.open,
    close: native.close,
  };
}

export function useRightRailOptional() {
  return useNativeSidebarOptional();
}

/** Alias provider name for ClientProviders migration */
export const RightRailProvider = NativeSidebarProvider;
