"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * CallActionModal pulls in a large MUI tree (drawer, lists, avatars, controls, icons).
 * Lazy-load it so non-call surfaces never pay for it in the initial bundle, and only
 * mount it once a launch is requested.
 */
const CallActionModal = dynamic(
  () => import("@/components/call/CallActionModal").then((m) => ({ default: m.CallActionModal })),
  { ssr: false }
);

/**
 * CallInterface is dynamically imported to avoid loading WebRTC overhead 
 * on non-call surfaces until a call is active in PIP.
 */
const CallInterface = dynamic(
  () => import("@/components/call/CallInterface").then((m) => ({ default: m.CallInterface })),
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

  const pathname = usePathname();
  const [activePip, setActivePip] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkPip = () => {
      // If we are currently on the call page, do not mount the global PIP component
      const isCallPage = pathname.includes("/connect/call/") || pathname.includes("/call/");
      if (isCallPage) {
        setActivePip(null);
        return;
      }

      const saved = localStorage.getItem("kylrix_active_pip");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.isPip && Date.now() - parsed.ts < 8 * 60 * 60 * 1000) {
            setActivePip(parsed);
            return;
          }
        } catch (e) {
          console.error("Failed to parse active PIP data", e);
        }
      }
      setActivePip(null);
    };

    checkPip();

    const handleCallEnded = () => {
      setActivePip(null);
    };

    window.addEventListener("kylrix_call_ended", handleCallEnded);
    window.addEventListener("storage", checkPip);

    // Poll every 2 seconds as fallback for same-tab updates not covered by events
    const interval = setInterval(checkPip, 2000);

    return () => {
      window.removeEventListener("kylrix_call_ended", handleCallEnded);
      window.removeEventListener("storage", checkPip);
      clearInterval(interval);
    };
  }, [pathname]);

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
      {activePip && (
        <CallInterface
          key={activePip.callCode || activePip.conversationId}
          callCode={activePip.callCode}
          conversationId={activePip.conversationId}
          isCaller={activePip.isCaller}
          callType={activePip.callType}
          targetId={activePip.targetId}
          initialMediaSettings={activePip.initialMediaSettings}
          autoInitiate={activePip.autoInitiate}
          callTitle={activePip.callTitle}
          expiresAt={activePip.expiresAt}
          initialPresentation="dock"
        />
      )}
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


