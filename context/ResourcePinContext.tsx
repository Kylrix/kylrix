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
  moment: new Set(),
});

const ResourcePinContext = createContext<ResourcePinContextValue | undefined>(undefined);

export function ResourcePinProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pinSets, setPinSets] = useState<Record<PinnableResourceType, Set<string>>>(defaultPinSets);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPins = useCallback(async (resourceType?: PinnableResourceType) => {
    if (!user?.$id) {
      setPinSets(defaultPinSets());
      return;
    }
    setIsLoading(true);
    try {
      const rows = await UserResourcePinService.listForUser(user.$id, resourceType);
      if (resourceType) {
        setPinSets((prev) => ({
          ...prev,
          [resourceType]: new Set(rows.map((row) => row.resourceId)),
        }));
        return;
      }

      const next = defaultPinSets();
      for (const row of rows) {
        next[row.resourceType].add(row.resourceId);
      }
      setPinSets(next);
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
      return { ...prev, [resourceType]: nextSet };
    });
  }, []);

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
      const next = await toggleResourcePin({
        actorId: user.$id,
        ownerId: params.ownerId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        currentlyPinned,
        setOwnerRowPin: params.setOwnerRowPin,
      });
      const perUserOnly = params.resourceType === 'message' || params.resourceType === 'conversation';
      if (perUserOnly || user.$id !== params.ownerId) {
        setLocalPin(params.resourceType, params.resourceId, next);
      }
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
      setLocalPin,
    }),
    [pinSets, isLoading, refreshPins, isPinned, togglePin, setLocalPin],
  );

  return <ResourcePinContext.Provider value={value}>{children}</ResourcePinContext.Provider>;
}

export function useResourcePins() {
  const ctx = useContext(ResourcePinContext);
  if (!ctx) throw new Error('useResourcePins must be used within ResourcePinProvider');
  return ctx;
}
