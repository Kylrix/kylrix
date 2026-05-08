"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CallActionModal } from "@/components/call/CallActionModal";

export type CallScopeSource = "chat" | "group" | "note" | "task" | "moment" | "space" | "generic";

export interface CallLaunchContext {
  source?: CallScopeSource;
  conversationId?: string;
  conversationName?: string;
  participantIds?: string[];
  noteId?: string;
  taskId?: string;
  title?: string;
}

type CallLauncherContextValue = {
  openCallLauncher: (context?: CallLaunchContext) => void;
  closeCallLauncher: () => void;
};

const CallLauncherContext = createContext<CallLauncherContextValue | undefined>(undefined);

export function CallLauncherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<CallLaunchContext | undefined>(undefined);

  const openCallLauncher = useCallback((nextContext?: CallLaunchContext) => {
    setContext(nextContext);
    setOpen(true);
  }, []);

  const closeCallLauncher = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openCallLauncher,
      closeCallLauncher,
    }),
    [openCallLauncher, closeCallLauncher],
  );

  return (
    <CallLauncherContext.Provider value={value}>
      {children}
      <CallActionModal open={open} onClose={closeCallLauncher} launchContext={context} />
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

