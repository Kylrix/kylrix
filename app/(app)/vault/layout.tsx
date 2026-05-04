import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";
import { Box } from "@mui/material";
import { EcosystemClient } from "@/components/ecosystem/EcosystemClient";
import { Suspense } from "react";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://vault.kylrix.space'),
  title: "Kylrix Vault - Premium Password Vault",
  description: "Secure, simple password management for individuals and teams. Your digital life, protected.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    images: ['/og-image.png'],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={mono.variable}>
      <head>
        {/* THE KYLRIX SIGNATURE TRIO: Satoshi (Body) & Clash Display (Headings) */}
        <link 
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap" 
          rel="stylesheet" 
        />
        <link rel="preconnect" href="https://fra.cloud.appwrite.io" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#000' }}>
        <Providers>
          <EcosystemClient nodeId="vault" />
          <Box sx={{ minHeight: '100vh', width: '100%', bgcolor: '#000' }}>
            <Suspense fallback={null}>
              <AppShell>
                {children}
              </AppShell>
            </Suspense>
          </Box>
        </Providers>
      </body>
    </html>
  );
}
