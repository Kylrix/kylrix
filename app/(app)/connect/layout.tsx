import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PresenceProvider } from '@/components/providers/PresenceProvider';
import { ProfileProvider } from '@/components/providers/ProfileProvider';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import { ChatNotificationProvider } from '@/components/providers/ChatNotificationProvider';
import { PotatoProvider } from '@/components/providers/PotatoProvider';
import { AppChromeProvider } from '@/components/providers/AppChromeProvider';
import { EcosystemClient } from '@/components/ecosystem/EcosystemClient';
import { IslandProvider } from '@/components/common/DynamicIsland';
import { SudoProvider } from '@/context/SudoContext';
import { AuthProvider } from '@/context/auth/AuthContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { DataNexusProvider } from '@/context/DataNexusContext';
import { Suspense } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://connect.kylrix.space'),
  title: "Kylrix Connect - Premium Communication",
  description: "Seamless, secure, and professional connections for the Kylrix Premium Suite.",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    images: ['/og-image.png'],
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

function ShellFallback() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', display: 'grid', placeItems: 'center' }}>
      <Stack spacing={2} alignItems="center">
        <Typography sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>Kylrix Connect</Typography>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Stack>
    </Box>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={mono.variable}>
      <head>
        {/* THE KYLRIX SIGNATURE TRIO: Satoshi (Body) & Clash Display (Headings) */}
        <link 
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap" 
          rel="stylesheet" 
        />
        <link rel="preconnect" href="https://fra.cloud.appwrite.io" />
      </head>
      <body className="antialiased">
        <EcosystemClient nodeId="connect" />
        <AuthProvider>
        <DataNexusProvider>
          <SubscriptionProvider>
            <ThemeProvider>
              <AppChromeProvider>
                <SudoProvider>
                  <IslandProvider>
                    <NotificationProvider>
                      <ProfileProvider>
                        <PresenceProvider>
                          <ChatNotificationProvider>
                            <PotatoProvider>
                              <AuthOverlay />
                              <Toaster 
                                position="bottom-right"
                                toastOptions={{
                                  style: {
                                    background: '#1A1A1A',
                                    color: '#fff',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }
                                }}
                              />
                              <Suspense fallback={<ShellFallback />}>
                                {children}
                              </Suspense>
                            </PotatoProvider>
                          </ChatNotificationProvider>
                        </PresenceProvider>
                      </ProfileProvider>
                    </NotificationProvider>
                  </IslandProvider>
                </SudoProvider>
              </AppChromeProvider>
            </ThemeProvider>
          </SubscriptionProvider>
        </DataNexusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
