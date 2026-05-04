"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLastActiveApp } from "@/lib/sdk/ecosystem";
import { AppwriteProvider } from "./appwrite-provider";
import { BackgroundTaskProvider } from "./context/BackgroundTaskContext";
import { AIProvider } from "./context/AIContext";
import { SudoProvider } from "./context/SudoContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SubscriptionProvider } from "@/context/subscription";
import { DataNexusProvider } from "@/context/DataNexusContext";
import { Toaster } from "react-hot-toast";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { darkTheme } from "@/theme/theme";
import EcosystemPortal from "@/components/common/EcosystemPortal";
import { useEcosystemNode } from "@/hooks/useEcosystemNode";

function GlobalEcosystemHandler() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEcosystemNode('vault');

  useEffect(() => {
    const mood = pathname?.startsWith('/totp') || pathname?.startsWith('/settings')
      ? 'serious'
      : 'ambient';
    document.body.dataset.uiMood = mood;
    return () => {
      document.body.dataset.uiMood = 'ambient';
    };
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <EcosystemPortal open={open} onClose={() => setOpen(false)} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useLastActiveApp();
  
  return (
    <SubscriptionProvider>
      <MuiThemeProvider theme={darkTheme}>
        <CssBaseline />
        <DataNexusProvider>
          <AppwriteProvider>
            <NotificationProvider>
            <SudoProvider>
              <BackgroundTaskProvider>
                <AIProvider>
                  <GlobalEcosystemHandler />
                  {children}
                  <Toaster
                    position="bottom-right"
                    toastOptions={{
                      className: "font-mono border-2 border-border shadow-floating rounded-xl",
                      style: {
                        background: "var(--card)",
                        color: "var(--foreground)",
                      },
                    }}
                  />
                </AIProvider>
              </BackgroundTaskProvider>
            </SudoProvider>
          </NotificationProvider>
        </AppwriteProvider>
        </DataNexusProvider>
      </MuiThemeProvider>
    </SubscriptionProvider>
  );
}
