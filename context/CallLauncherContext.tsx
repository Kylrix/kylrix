"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";

/**
 * CallActionModal pulls in a large MUI tree (drawer, lists, avatars, controls, icons).
 * Lazy-load it so non-call surfaces never pay for it in the initial bundle, and only
 * mount it once a launch is requested.
 */
const CallActionModal = dynamic(
  () => import("@/components/call/CallActionModal").then((m) => ({ default: m.CallActionModal })),
  { ssr: false }
);

export type CallScopeSource = "chat" | "group" | "note" | "task" | "moment" | "space" | "generic";

export interface CallLaunchContext {
  source?: CallScopeSource;
  conversationId?: string;
  conversationName?: string;
  participantIds?: string[];
  noteId?: string;
  taskId?: string;
  title?: string;
  existingCallId?: string;
}

type CallLauncherContextValue = {
  isOpen: boolean;
  openCallLauncher: (context?: CallLaunchContext) => void;
  closeCallLauncher: () => void;
};

const CallLauncherContext = createContext<CallLauncherContextValue | undefined>(undefined);

export function CallLauncherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const [context, setContext] = useState<CallLaunchContext | undefined>(undefined);

  const openCallLauncher = useCallback((nextContext?: CallLaunchContext) => {
    setContext(nextContext);
    setHasEverOpened(true);
    setOpen(true);
  }, []);

  const closeCallLauncher = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen: open,
      openCallLauncher,
      closeCallLauncher,
    }),
    [open, openCallLauncher, closeCallLauncher],
  );

  return (
    <CallLauncherContext.Provider value={value}>
      {children}
      {hasEverOpened ? (
        <CallActionModal open={open} onClose={closeCallLauncher} launchContext={context} />
      ) : null}
    </CallLauncherContext.Provider>
  );
}

export function useCallLauncher() {
  const context = useContext(CallLauncherContext);
  if (!context) {
    throw new Error("useCallLauncher must be used within CallLauncherProvider");
  }
  return context;
}

