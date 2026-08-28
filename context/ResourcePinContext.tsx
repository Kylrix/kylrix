'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import {
  PinnableResourceType,
  UserResourcePinService,
  resolveEffectivePinned,
} from '@/lib/services/user-resource-pins';
import { toggleResourcePin } from '@/lib/services/resource-pin-coordinator';

interface ResourcePinContextValue {
  pinSets: Record<PinnableResourceType, Set<string>>;
  isLoading: boolean;
  refreshPins: (resourceType?: PinnableResourceType) => Promise<void>;
  isPinned: (
    resourceType: PinnableResourceType,
    resourceId: string,
    ownerId: string | null | undefined,
    rowIsPinned: boolean | null | undefined,
  ) => boolean;
  togglePin: (params: {
    resourceType: PinnableResourceType;
    resourceId: string;
    ownerId: string;
    rowIsPinned: boolean | null | undefined;
    setOwnerRowPin: (pinned: boolean) => Promise<void>;
  }) => Promise<boolean>;
  setLocalPin: (resourceType: PinnableResourceType, resourceId: string, pinned: boolean) => void;
}

const EMPTY_SET = new Set<string>();

const defaultPinSets = (): Record<PinnableResourceType, Set<string>> => ({
  note: new Set(),
  credential: new Set(),
  totp: new Set(),
  task: new Set(),
  calendar: new Set(),
  event: new Set(),
  form: new Set(),
  project: new Set(),
  conversation: new Set(),
  message: new Set(),
  call: new Set(),
  moment: new Set()});

const ResourcePinContext = createContext<ResourcePinContextValue | undefined>(undefined);

export function ResourcePinProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pinSets, setPinSets] = useState<Record<PinnableResourceType, Set<string>>>(defaultPinSets);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLogout = () => {
      setPinSets(defaultPinSets());
    };
    window.addEventListener('kylrix:auth:logout', handleLogout);
    return () => window.removeEventListener('kylrix:auth:logout', handleLogout);
  }, []);

  // Fast initial hydration from LocalEngine / IndexedDB
  useEffect(() => {
    if (!user?.$id) return;
    const cacheKey = `user_pins_${user.$id}`;
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<Record<PinnableResourceType, string[]>>(cacheKey);
        if (cached && typeof cached === 'object') {
          const next = defaultPinSets();
          (Object.keys(cached) as PinnableResourceType[]).forEach((rt) => {
            if (Array.isArray(cached[rt])) {
              next[rt] = new Set(cached[rt]);
            }
          });
          setPinSets(next);
        }
      } catch {}
    })();
  }, [user?.$id]);

  const refreshPins = useCallback(async (resourceType?: PinnableResourceType) => {
    if (!user?.$id) {
      setPinSets(defaultPinSets());
      return;
    }
    setIsLoading(true);
    try {
      const rows = (await UserResourcePinService.listForUser(user.$id, resourceType)) ?? [];
      const safeRows = Array.isArray(rows) ? rows : [];
      if (resourceType) {
        setPinSets((prev) => {
          const updated = {
            ...prev,
            [resourceType]: new Set(safeRows.map((row) => row.resourceId)),
          };
          // Persist to LocalEngine
          void (async () => {
            try {
              const { LocalEngine } = await import('@/lib/services/LocalEngine');
              const cacheKey = `user_pins_${user.$id}`;
              const serializable: any = {};
              (Object.keys(updated) as PinnableResourceType[]).forEach((rt) => {
                serializable[rt] = Array.from(updated[rt]);
              });
              await LocalEngine.cacheSet(cacheKey, serializable);
            } catch {}
          })();
          return updated;
        });
        return;
      }

      const next = defaultPinSets();
      for (const row of safeRows) {
        if (row?.resourceType && next[row.resourceType]) {
          next[row.resourceType].add(row.resourceId);
        }
      }
      setPinSets(next);
      // Persist to LocalEngine
      void (async () => {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cacheKey = `user_pins_${user.$id}`;
          const serializable: any = {};
          (Object.keys(next) as PinnableResourceType[]).forEach((rt) => {
            serializable[rt] = Array.from(next[rt]);
          });
          await LocalEngine.cacheSet(cacheKey, serializable);
        } catch {}
      })();
    } catch (error) {
      console.error('[ResourcePin] Failed to load pins', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  const setLocalPin = useCallback((resourceType: PinnableResourceType, resourceId: string, pinned: boolean) => {
    setPinSets((prev) => {
      const nextSet = new Set(prev[resourceType]);
      if (pinned) nextSet.add(resourceId);
      else nextSet.delete(resourceId);
      const updated = { ...prev, [resourceType]: nextSet };
      if (user?.$id) {
        void (async () => {
          try {
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            const cacheKey = `user_pins_${user.$id}`;
            const serializable: any = {};
            (Object.keys(updated) as PinnableResourceType[]).forEach((rt) => {
              serializable[rt] = Array.from(updated[rt]);
            });
            await LocalEngine.cacheSet(cacheKey, serializable);
          } catch {}
        })();
      }
      return updated;
    });
  }, [user?.$id]);

  const isPinned = useCallback(
    (
      resourceType: PinnableResourceType,
      resourceId: string,
      ownerId: string | null | undefined,
      rowIsPinned: boolean | null | undefined,
    ) =>
      resolveEffectivePinned(
        user?.$id,
        ownerId,
        resourceId,
        rowIsPinned,
        pinSets[resourceType] ?? EMPTY_SET,
        resourceType,
      ),
    [user?.$id, pinSets],
  );

  const togglePin = useCallback(
    async (params: {
      resourceType: PinnableResourceType;
      resourceId: string;
      ownerId: string;
      rowIsPinned: boolean | null | undefined;
      setOwnerRowPin: (pinned: boolean) => Promise<void>;
    }) => {
      if (!user?.$id) return false;
      const currentlyPinned = isPinned(
        params.resourceType,
        params.resourceId,
        params.ownerId,
        params.rowIsPinned,
      );
      const next = !currentlyPinned;

      // 1. Optimistic LocalEngine & in-memory update (instant 0ms response)
      setLocalPin(params.resourceType, params.resourceId, next);

      // 2. Perform asynchronous remote synchronization in the background
      void (async () => {
        try {
          await toggleResourcePin({
            actorId: user.$id,
            ownerId: params.ownerId,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            currentlyPinned,
            setOwnerRowPin: params.setOwnerRowPin,
          });
        } catch (err) {
          console.warn('[ResourcePin] Background sync failed, rolling back local pin:', err);
          setLocalPin(params.resourceType, params.resourceId, currentlyPinned);
        }
      })();

      return next;
    },
    [user?.$id, isPinned, setLocalPin],
  );

  const value = useMemo<ResourcePinContextValue>(
    () => ({
      pinSets,
      isLoading,
      refreshPins,
      isPinned,
      togglePin,
      setLocalPin}),
    [pinSets, isLoading, refreshPins, isPinned, togglePin, setLocalPin],
  );

  return <ResourcePinContext.Provider value={value}>{children}</ResourcePinContext.Provider>;
}

export function useResourcePins() {
  const ctx = useContext(ResourcePinContext);
  if (!ctx) throw new Error('useResourcePins must be used within ResourcePinProvider');
  return ctx;
}
