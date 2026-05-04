"use client";

import { useLastActiveApp } from "@/lib/sdk/ecosystem";
import { AuthProvider } from "@/components/ui/AuthContext";
import { OverlayProvider } from "@/components/ui/OverlayContext";
import { LoadingProvider } from "@/components/ui/LoadingContext";
import { RouteGuard } from "@/components/ui/RouteGuard";
import { ThemeProvider as AppThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { IslandProvider } from "@/components/ui/DynamicIsland";
import { PotatoProvider } from "@/components/providers/PotatoProvider";
import Overlay from "@/components/ui/Overlay";
import { ContextMenuProvider } from "@/components/ui/ContextMenuContext";
import { GlobalContextMenu } from "@/components/ui/GlobalContextMenu";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import { EcosystemPortal } from "@/components/common/EcosystemPortal";
import { NotificationProvider } from "@/context/NotificationContext";
import { SudoProvider } from "@/context/SudoContext";
import { NotesProvider } from "@/context/NotesContext";
import { DrawerStateProvider } from "@/components/ui/DrawerStateContext";

import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { darkTheme, lightTheme } from "@/theme/theme";
import { EcosystemProvider } from "@/context/EcosystemContext";
import { SubscriptionProvider } from "@/context/subscription/SubscriptionContext";
import { useTheme } from "@/components/ThemeProvider";

import { DataNexusProvider } from "@/context/DataNexusContext";

function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
    const { theme } = useTheme();
    const muiTheme = theme === 'dark' ? darkTheme : lightTheme;
    
    return (
        <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    useLastActiveApp();
    
    return (
        <DrawerStateProvider>
            <DataNexusProvider>
                <SubscriptionProvider>
                    <EcosystemProvider>
                        <AppThemeProvider>
                            <AuthProvider>
                                <NotificationProvider>
                                    <NotesProvider>
                                        <MuiThemeWrapper>
                                            <SudoProvider>
                                                <IslandProvider>
                                                    <PotatoProvider>
                                                        <ToastProvider>
                                                            <OverlayProvider>
                                                                <LoadingProvider>
                                                                    <ContextMenuProvider>
                                                                        <RouteGuard>
                                                                            {children}
                                                                        </RouteGuard>
                                                                        <Overlay />
                                                                        <GlobalContextMenu />
                                                                        <GlobalShortcuts />
                                                                        <EcosystemPortal />
                                                                    </ContextMenuProvider>
                                                                </LoadingProvider>
                                                            </OverlayProvider>
                                                        </ToastProvider>
                                                    </PotatoProvider>
                                                </IslandProvider>
                                            </SudoProvider>
                                        </MuiThemeWrapper>
                                    </NotesProvider>
                                </NotificationProvider>
                            </AuthProvider>
                        </AppThemeProvider>
                    </EcosystemProvider>
                </SubscriptionProvider>
            </DataNexusProvider>
        </DrawerStateProvider>
    );
}
