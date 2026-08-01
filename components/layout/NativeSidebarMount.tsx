'use client';

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useNativeSidebarApiOptional } from '@/context/RightRailContext';

type Props = {
  active: boolean;
  sidebarKey: string;
  width?: number;
  title?: string;
  sticky?: boolean;
  children: ReactNode;
};

type SlotRecord = { key: string; node: ReactNode };

let slotRecord: SlotRecord | null = null;
const slotListeners = new Set<() => void>();

function publishSlot(key: string, node: ReactNode) {
  slotRecord = { key, node };
  slotListeners.forEach((listener) => listener());
}

function clearSlot(key: string) {
  if (slotRecord?.key !== key) return;
  slotRecord = null;
  slotListeners.forEach((listener) => listener());
}

function subscribeSlot(listener: () => void) {
  slotListeners.add(listener);
  return () => {
    slotListeners.delete(listener);
  };
}

function getSlotSnapshot() {
  return slotRecord;
}

/** Renders the active mount's children without going through sidebar setState. */
function NativeSidebarSlot({ sidebarKey }: { sidebarKey: string }) {
  const record = useSyncExternalStore(
    subscribeSlot,
    getSlotSnapshot,
    () => null,
  );
  if (!record || record.key !== sidebarKey) return null;
  return <>{record.node}</>;
}

/**
 * Mounts children into the unified native right sidebar while `active`.
 * Children stream through an external slot so Topbar re-renders cannot
 * re-enter applyOpen/swap and blow the update depth.
 */
export function NativeSidebarMount({
  active,
  sidebarKey,
  width = 420,
  title,
  sticky,
  children,
}: Props) {
  const api = useNativeSidebarApiOptional();
  const openedRef = useRef(false);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  // Keep slot payload fresh without touching sidebar React state.
  useEffect(() => {
    if (!active) {
      clearSlot(sidebarKey);
      return;
    }
    publishSlot(sidebarKey, children);
  }, [active, sidebarKey, children]);

  // Open / close the shell once per activation — stable Slot element.
  useEffect(() => {
    if (!api) return;
    const opts = { key: sidebarKey, width, title, sticky };
    if (!active) {
      if (openedRef.current || api.getActiveKey() === sidebarKey) {
        api.close(sidebarKey);
        openedRef.current = false;
      }
      clearSlot(sidebarKey);
      return;
    }
    if (api.getActiveKey() === sidebarKey && openedRef.current) {
      return;
    }
    publishSlot(sidebarKey, childrenRef.current);
    api.open(<NativeSidebarSlot sidebarKey={sidebarKey} />, opts);
    openedRef.current = true;
  }, [active, api, sidebarKey, width, title, sticky]);

  useEffect(() => {
    return () => {
      clearSlot(sidebarKey);
      if (!api) return;
      if (api.getActiveKey() === sidebarKey) api.close(sidebarKey);
      openedRef.current = false;
    };
  }, [api, sidebarKey]);

  return null;
}
